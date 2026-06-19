import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CountriesRepository } from '../countries/countries.repository';
import { CredentialsService } from '../credentials/credentials.service';
import { LlmCoreService } from '../llm/llm.service';
import {
  buildExtractionMessages,
  CATEGORY_IDS,
  CATEGORY_LABELS,
  parsePredictions,
} from '../llm/prediction.prompt';
import { ProviderId } from '../llm/llm.types';
import { DecryptedCredential } from '../credentials/credentials.service';
import { ResearchService } from './pipeline/researcher';
import { SearchService } from '../search/search.service';
import { PredictionRow, PredictionsRepository } from './predictions.repository';
import { PredictionContextService } from './prediction-context.service';
import { NOOP_PROGRESS, ProgressFn } from './pipeline/progress';

const clampP = (p: number) => Math.min(0.999, Math.max(0.001, p));
const ALLOWED_SOURCES = new Set(['manual', 'metric', 'llm-judge']);
const CATEGORY_SET = new Set<string>(CATEGORY_IDS);

// Kategori → Tavily arama terimleri (güncel, ilgili bağlam için — özellikle güvenlik/dış pol.).
const CATEGORY_SEARCH: Record<string, string> = {
  siyaset: 'politics elections government opposition polls',
  ekonomi: 'economy inflation currency central bank growth IMF',
  dispolitika: 'foreign policy diplomacy international relations',
  guvenlik: 'security military defense conflict war tension operation terrorism',
  toplum: 'society protests social unrest rights',
  saglik: 'health healthcare epidemic',
  enerji: 'energy oil gas pipeline electricity',
  teknoloji: 'technology defense industry drones semiconductors',
};

@Injectable()
export class PredictionsService {
  private readonly logger = new Logger(PredictionsService.name);

  constructor(
    private readonly repo: PredictionsRepository,
    private readonly countries: CountriesRepository,
    private readonly creds: CredentialsService,
    private readonly llm: LlmCoreService,
    private readonly research: ResearchService,
    private readonly search: SearchService,
    private readonly context: PredictionContextService,
  ) {}

  // --- B1+B2: çoklu-model panel + agregasyon + şeytanın avukatı ---
  async generate(
    userId: string,
    iso2: string,
    scope: 'domestic' | 'foreign' | 'both' = 'both',
    providerOverride?: ProviderId,
    category?: string,
    onProgress: ProgressFn = NOOP_PROGRESS,
  ): Promise<{
    country: string;
    created: number;
    panel: string[];
    predictions: PredictionRow[];
  }> {
    const country = await this.countries.findByIso2(iso2);
    if (!country) throw new NotFoundException(`Ülke bulunamadı: ${iso2}`);

    const all = await this.creds.getAllDecrypted(userId);
    if (all.length === 0) {
      throw new BadRequestException(
        "Kayıtlı AI sağlayıcı yok. Ayarlar'dan bir anahtar ekleyin (ör. NVIDIA).",
      );
    }
    // Tek GÜÇLÜ model (hız + derinlik): override > gemini-2.5-pro > ilk kayıtlı.
    let lead: DecryptedCredential;
    let leadModel: string;
    if (providerOverride) {
      lead = all.find((c) => c.provider === providerOverride) ?? all[0];
      leadModel = lead.model || this.llm.defaultModel(lead.provider);
    } else {
      const gem = all.find((c) => c.provider === 'gemini');
      if (gem) {
        lead = gem;
        leadModel = 'gemini-2.5-pro';
      } else {
        lead = all[0];
        leadModel = lead.model || this.llm.defaultModel(lead.provider);
      }
    }
    const leadId = `${lead.provider}/${leadModel}`;

    onProgress({ stage: 'context', detail: 'Güncel haber ve bağlam toplanıyor' });
    const items = await this.context.itemsFor(country.iso2);
    const asOf = new Date().toISOString();
    // Süreklilik: bu ülke için açık (çözülmemiş) tahminler — model hattı sürdürür.
    const active = await this.repo.listActiveByIso(country.iso2, userId);
    // Dösye ucuz modelle damıtılır: Gemini'de flash, değilse lead model.
    const dossierModel =
      lead.provider === 'gemini' ? 'gemini-2.5-flash' : leadModel;
    const focusCategory =
      category && CATEGORY_LABELS[category]
        ? { id: category, label: CATEGORY_LABELS[category] }
        : null;

    // 0) Araştırmacı aşaması (LLM'siz): RAG geçmişi + sayısal çıpa topla (graceful).
    const focusText = focusCategory
      ? `${country.name_tr ?? country.name} ${focusCategory.label} gündemi ve gelecek riskleri`
      : `${country.name_tr ?? country.name} gündem: ${items
          .slice(0, 6)
          .map((i) => i.title)
          .join('; ')}`;
    const countryEn = country.name ?? country.name_tr ?? country.iso2;
    onProgress({
      stage: 'research',
      detail: 'RAG, makro, piyasa priorları, canlı web ve bağlam dösyesi hazırlanıyor',
    });
    // Dösye araştırmayla PARALEL üretilir (ek seri gecikme yok); buildDossier
    // hatayı kendi içinde yutar → null döner, pipeline ham haberle devam eder.
    const [research, web, dossier] = await Promise.all([
      this.research.gather(userId, country.iso2, focusText, countryEn),
      focusCategory
        ? this.search
            .forTopic(countryEn, CATEGORY_SEARCH[focusCategory.id] ?? focusCategory.label)
            .catch(() => null)
        : Promise.resolve(null),
      this.context.buildDossier(
        country.name_tr ?? country.name,
        asOf,
        items,
        lead.provider,
        lead.apiKey,
        dossierModel,
      ),
    ]);

    // 1) Lead model çözülebilir soru setini üretir.
    //    LLM bazen yarım/bozuk JSON döndürür (düşünen model + uzun çıktı). Bu durumda
    //    bir kez daha dene; yine olmazsa TEMİZ hata fırlat (çıplak 500 yerine 502).
    const extractionMessages = buildExtractionMessages({
      countryName: country.name_tr ?? country.name,
      iso2: country.iso2,
      asOf,
      items,
      focusCategory,
      ragArticles: research.ragArticles,
      pastOutcomes: research.pastOutcomes,
      anchors: research.anchors,
      structural: research.structural,
      priors: research.priors,
      webContext: web?.summary ?? null,
      events: research.events,
      dossier,
      activePredictions: active.map((p) => ({
        question: p.question,
        probability: p.probability,
        topic: p.topic,
        generatedAt: p.generated_at,
        resolveAt: p.resolve_at,
      })),
    });
    onProgress({
      stage: 'model',
      detail: 'Model tahminleri üretiyor (derin analiz)…',
    });
    let candidates: ReturnType<typeof parsePredictions> = [];
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const raw = await this.llm.chat(
          lead.provider,
          lead.apiKey,
          extractionMessages,
          {
            model: leadModel,
            jsonMode: true,
            temperature: 0.3,
            // 1. deneme kesilirse (finish_reason=length) 2. deneme daha bol bütçe.
            maxTokens: attempt === 1 ? 16384 : 32768,
            reasoningEffort: 'high',
          },
        );
        const base = parsePredictions(raw)
          .filter((p) => p.question && p.resolution_criteria)
          .filter((p) => scope === 'both' || p.scope === scope);
        // Odak kategori varsa, modelin konu DIŞINA çıkardığını DÜŞÜR (eskiden
        // candTopic ile zorla yeniden-etiketleniyordu → spor "güvenlik" görünüyordu).
        // Ama filtre HEPSİNİ elerse (model etiketi tamamen kaçırdı) boş sonuç yerine
        // base'e geri düş — relabel yolu son çare olarak korunur.
        const focused = focusCategory
          ? base.filter((p) => !p.topic || p.topic === focusCategory.id)
          : base;
        candidates = (focused.length ? focused : base).slice(0, 5);
        if (candidates.length) break;
        lastErr = new Error('Model çözülebilir tahmin üretmedi.');
      } catch (e) {
        lastErr = e;
        this.logger.warn(
          `Tahmin çıkarımı deneme ${attempt} başarısız: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }
    if (!candidates.length) {
      throw new BadGatewayException(
        `Tahmin üretilemedi (${lead.provider}/${leadModel}): ${
          lastErr instanceof Error ? lastErr.message : String(lastErr)
        }`,
      );
    }

    // 2) Tek güçlü model çıktısı doğrudan kullanılır — panel/oy/devil/narrative YOK.
    //    Karşı-tez ve kalibrasyon extraction'da tek geçişte yapıldı. Yalnız gerçek
    //    referans-sınıf oranı (DB, ucuz) eklenir. ~16 LLM çağrısı → 1.
    onProgress({
      stage: 'save',
      detail: 'Tahminler kalibre ediliyor ve kaydediliyor',
    });
    const now = Date.now();
    const inserted: PredictionRow[] = [];
    for (const p of candidates) {
      const candScope: 'domestic' | 'foreign' =
        p.scope === 'foreign' ? 'foreign' : 'domestic';
      const candTopic = focusCategory
        ? focusCategory.id
        : CATEGORY_SET.has(p.topic)
          ? p.topic
          : 'toplum';
      const empirical = await this.repo.baseRateByTopicScope(candTopic, candScope);
      const days = Math.min(1825, Math.max(1, Math.round(p.horizon_days || 90)));
      const source = ALLOWED_SOURCES.has(p.resolution_source)
        ? p.resolution_source
        : 'llm-judge';
      const finalP = clampP(Number(p.probability) || 0.5);

      const row = await this.repo.insert({
        ownerUserId: userId,
        countryId: country.id,
        scope: candScope,
        question: p.question,
        probability: finalP,
        probLow: p.prob_low != null ? clampP(p.prob_low) : null,
        probHigh: p.prob_high != null ? clampP(p.prob_high) : null,
        confidence: p.confidence || 'orta',
        rationale: p.rationale || '',
        topic: candTopic,
        baseRate: p.base_rate != null ? clampP(Number(p.base_rate)) : null,
        model: leadId,
        resolutionCriteria: p.resolution_criteria,
        resolutionSource: source,
        metricKey: p.metric_key ?? null,
        method: {
          ...(p.method ?? {}),
          reference_base_rate: p.base_rate ?? null,
          empirical_base_rate: empirical,
          pipeline_trace: {
            ...research.trace,
            web: web ? 'ok' : 'none',
            single_model: true,
          },
          metric_op: p.metric_op ?? null,
          metric_threshold: p.metric_threshold ?? null,
        },
        horizon: p.horizon || `${days} gün`,
        resolveAt: new Date(now + days * 86_400_000),
        analysisId: null,
        counterArgument: p.counter_argument || null,
        aggregation: 'single',
        modelCount: 1,
        probPreDevil: finalP,
      });
      if (row) inserted.push(row);
    }

    return {
      country: country.iso2,
      created: inserted.length,
      panel: [leadId],
      predictions: inserted,
    };
  }

  listActive(userId: string, iso2: string): Promise<PredictionRow[]> {
    return this.repo.listActiveByIso(iso2, userId);
  }

  // --- Silme (eski tahminleri temizle) ---
  deletePrediction(id: string): Promise<void> {
    return this.repo.deleteById(id);
  }

  async clearPredictions(iso2: string): Promise<{ deleted: number }> {
    return { deleted: await this.repo.deleteByCountry(iso2) };
  }

}
