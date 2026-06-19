import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CountriesRepository } from '../countries/countries.repository';
import { CredentialsService } from '../credentials/credentials.service';
import { CATEGORY_LABELS } from '../llm/prediction.prompt';
import {
  buildScenarioReportMessages,
  parseScenarioReport,
  ScenarioReport,
} from '../llm/scenario.report';
import { LlmCoreService } from '../llm/llm.service';
import { SearchService } from '../search/search.service';
import { PredictionContextService } from './prediction-context.service';
import { PredictionsRepository } from './predictions.repository';
import { ResearchService } from './pipeline/researcher';
import { NOOP_PROGRESS, ProgressFn } from './pipeline/progress';

@Injectable()
export class PredictionScenarioService {
  private readonly logger = new Logger(PredictionScenarioService.name);

  constructor(
    private readonly repo: PredictionsRepository,
    private readonly countries: CountriesRepository,
    private readonly creds: CredentialsService,
    private readonly llm: LlmCoreService,
    private readonly research: ResearchService,
    private readonly search: SearchService,
    private readonly context: PredictionContextService,
  ) {}

  async generate(
    userId: string,
    iso2: string,
    category?: string,
    horizonDays = 1825,
    onProgress: ProgressFn = NOOP_PROGRESS,
  ): Promise<ScenarioReport & { id: string }> {
    const country = await this.countries.findByIso2(iso2);
    if (!country) throw new NotFoundException(`Ülke bulunamadı: ${iso2}`);

    const credentials = await this.creds.getAllDecrypted(userId);
    if (credentials.length === 0) {
      throw new BadRequestException(
        "Kayıtlı AI sağlayıcı yok. Ayarlar'dan bir anahtar ekleyin.",
      );
    }
    const credential =
      credentials.find((candidate) => candidate.provider === 'gemini') ??
      credentials[0];
    const model =
      credential.provider === 'gemini'
        ? 'gemini-2.5-pro'
        : credential.model || this.llm.defaultModel(credential.provider);
    const focusCategory =
      category && CATEGORY_LABELS[category]
        ? { id: category, label: CATEGORY_LABELS[category] }
        : null;

    const days = Math.min(3650, Math.max(180, Math.round(horizonDays)));
    const horizonLabel =
      days >= 1460
        ? `${Math.round(days / 365)} yıl`
        : days >= 365
          ? `${(days / 365).toFixed(1)} yıl`
          : `${Math.round(days / 30)} ay`;
    const now = new Date();
    const target = new Date(now.getTime() + days * 86_400_000);
    const targetDateLabel = new Intl.DateTimeFormat('tr-TR', {
      month: 'long',
      year: 'numeric',
    }).format(target);

    onProgress({ stage: 'context', detail: 'Güncel haber ve bağlam toplanıyor' });
    const items = await this.context.itemsFor(country.iso2);
    const countryEn = country.name ?? country.name_tr ?? country.iso2;
    const focusText = `${country.name_tr ?? country.name} ${
      focusCategory?.label ?? 'siyaset ekonomi'
    } ${horizonLabel} görünüm`;
    onProgress({
      stage: 'research',
      detail: 'RAG, makro, piyasa priorları ve canlı web taranıyor',
    });
    const [research, web] = await Promise.all([
      this.research.gather(userId, country.iso2, focusText, countryEn),
      this.search
        .forContext(
          countryEn,
          focusCategory?.label ?? 'politics economy outlook',
        )
        .catch(() => null),
    ]);

    const messages = buildScenarioReportMessages({
      countryName: country.name_tr ?? country.name,
      iso2: country.iso2,
      asOf: now.toISOString(),
      targetDateLabel,
      horizonLabel,
      horizonDays: days,
      topicLabel: focusCategory?.label ?? null,
      items,
      ragArticles: research.ragArticles,
      pastOutcomes: research.pastOutcomes,
      structural: research.structural,
      anchors: research.anchors,
      priors: research.priors.map((prior) => ({
        source: prior.source,
        question: prior.question,
        probability: prior.probability,
      })),
      webContext: web?.summary ?? null,
      webSources: web?.sources ?? [],
    });

    onProgress({
      stage: 'model',
      detail: 'Model uzun-form raporu üretiyor (derin analiz)…',
    });
    let report: ScenarioReport | null = null;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const raw = await this.llm.chat(
          credential.provider,
          credential.apiKey,
          messages,
          {
            model,
            jsonMode: true,
            temperature: 0.6,
            // 1. deneme kesilirse (finish_reason=length) 2. deneme daha bol bütçe.
            maxTokens: attempt === 1 ? 16384 : 32768,
            reasoningEffort: 'high',
          },
        );
        const parsed = parseScenarioReport(raw);
        if (parsed.scenarios.length || parsed.sections.length) {
          report = parsed;
          break;
        }
        lastError = new Error('Model rapor üretmedi.');
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Senaryo raporu deneme ${attempt} başarısız: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    if (!report) {
      throw new BadGatewayException(
        `Senaryo raporu üretilemedi (${credential.provider}/${model}): ${
          lastError instanceof Error ? lastError.message : String(lastError)
        }`,
      );
    }
    onProgress({ stage: 'save', detail: 'Rapor ayrıştırıldı, kaydediliyor' });
    report.horizon = horizonLabel;
    report.horizon_days = days;
    if (web?.sources?.length) {
      const seen = new Set(report.sources.map((source) => source.url));
      for (const source of web.sources) {
        if (!seen.has(source.url)) {
          report.sources.push(source);
          seen.add(source.url);
        }
      }
    }

    const row = await this.repo.insertScenarioReport({
      ownerUserId: userId,
      countryId: country.id,
      topic: focusCategory?.id ?? null,
      horizon: horizonLabel,
      horizonDays: days,
      title: report.title,
      framing: report.framing,
      thesis: report.thesis,
      sections: report.sections,
      scenarios: report.scenarios,
      uncertainty: report.uncertainty,
      bottomLine: report.bottom_line,
      keyQuestions: report.key_questions,
      confidence: report.confidence,
      sources: report.sources,
      model: `${credential.provider}/${model}`,
      method: {
        pipeline_trace: research.trace,
        web_sources: web?.sources?.length ?? 0,
      },
      asOf: now,
    });
    if (!row) throw new BadGatewayException('Senaryo raporu kaydedilemedi.');
    return { ...report, id: row.id };
  }

  list(userId: string, iso2: string) {
    return this.repo.listScenarioSetsByIso(iso2, userId);
  }

  delete(id: string): Promise<void> {
    return this.repo.deleteScenarioSet(id);
  }

  async refreshMonthly(): Promise<{ countries: number; refreshed: number }> {
    const stale = await this.repo.staleScenarioSets(30);
    let refreshed = 0;
    for (const scenario of stale) {
      try {
        const credential = await this.creds.getLatestDecrypted(
          scenario.owner_user_id,
        );
        if (!credential) continue;
        // Önce yeniyi üret. Başarısızsa eski rapor KALIR (veri kaybı yok) ve
        // aşağıdaki silmeye geçilmez.
        await this.generate(
          scenario.owner_user_id,
          scenario.iso2,
          scenario.topic ?? undefined,
          1825,
        );
        refreshed++;
      } catch (error) {
        this.logger.warn(
          `Senaryo yenileme hatası (${scenario.iso2}): ${(error as Error).message}`,
        );
        continue; // üretim başarısız → eskiyi SİLME
      }
      // Üretim başarılı: eskiyi ayrı try ile sil. Silme hatası "üretim hatası"yla
      // karışmasın ve çift-kayıt riski net görünsün diye error seviyesinde logla.
      try {
        await this.repo.deleteScenarioSet(scenario.id);
      } catch (error) {
        this.logger.error(
          `Eski senaryo silinemedi (çift kayıt riski, id=${scenario.id}): ${(error as Error).message}`,
        );
      }
    }
    return { countries: stale.length, refreshed };
  }
}
