import { Injectable, Logger } from '@nestjs/common';
import {
  EmbeddingService,
  RetrievedContext,
} from '../../embedding/embedding.service';
import { SignalsService } from '../../signals/signals.service';
import { StructuralService } from '../../structural/structural.service';
import { PriorsService, ExternalPrior } from '../../priors/priors.service';
import { AnalysisItem } from '../../llm/llm.prompt';
import { PastOutcome } from '../../llm/prediction.prompt';

export interface ResearchContext {
  /** RAG: benzer geçmiş haberler (kanıt olarak prompt'a girer). */
  ragArticles: AnalysisItem[];
  /** Hafıza: benzer geçmiş tahminlerin sonuçları. */
  pastOutcomes: PastOutcome[];
  /** Sayısal çıpa metinleri (kur vb.). */
  anchors: string[];
  /** Yapısal makro özet (Dünya Bankası; nowcast değil, uzun ufuk zemini). */
  structural: string | null;
  /** Faz 2 — dış priorlar (tahmin piyasası/topluluk). */
  priors: ExternalPrior[];
  /** Olay-kümeleme: çok-kaynaklı güncel olaylar (ham başlık yerine). */
  events: Array<{ title: string; count: number }>;
  /** İzlenebilirlik (predictions.method.pipeline_trace). */
  trace: Record<string, unknown>;
}

const EMPTY: ResearchContext = {
  ragArticles: [],
  pastOutcomes: [],
  anchors: [],
  structural: null,
  priors: [],
  events: [],
  trace: { rag: 'skipped', anchors: 0 },
};

/**
 * Ajan zincirinin "araştırmacı" aşaması (LLM'siz, deterministik).
 * RAG geçmişi + sayısal çıpayı toplar; her parça graceful (servis kapalıysa boş).
 */
@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name);

  constructor(
    private readonly embedding: EmbeddingService,
    private readonly signals: SignalsService,
    private readonly structuralSvc: StructuralService,
    private readonly priorsSvc: PriorsService,
  ) {}

  /** countryNameEn: Manifold/Metaculus İngilizce arama için ülke adı (EN). */
  async gather(
    ownerUserId: string,
    iso2: string,
    focusText: string,
    countryNameEn: string,
  ): Promise<ResearchContext> {
    try {
      const [rag, anchors, structural, priors, rawEvents] = await Promise.all([
        this.embedding.retrieveContext(ownerUserId, iso2, focusText, {
          articles: 8,
          predictions: 6,
        }),
        this.signals.anchors().catch(() => [] as string[]),
        this.structuralSvc.structuralSummary(iso2).catch(() => null),
        this.priorsSvc
          .forContext(countryNameEn, focusText)
          .catch(() => [] as ExternalPrior[]),
        this.embedding.topEvents(iso2, 8).catch(() => []),
      ]);
      // RAG/embedding servisi kapalıysa sessiz kalma: emsal hafıza olmadan
      // üretildiğini ayırt edici şekilde logla (trace'te de 'unavailable').
      if (!rag.available) {
        this.logger.warn(
          `RAG/embedding kullanılamıyor (${iso2}) — tahmin/senaryo benzer-geçmiş hafızası OLMADAN üretilecek.`,
        );
      }

      // Çok-kaynaklı olayları öne al (tekil = gürültü); en az 1 makale.
      const events = rawEvents
        .map((e) => ({ title: e.title, count: e.article_count }))
        .filter((e) => e.title);

      const ragArticles: AnalysisItem[] = (rag as RetrievedContext).articles.map(
        (a) => ({
          title: a.title,
          url: a.url,
          orientation: a.orientation,
          source: a.source,
          snippet: a.summary,
          content: a.content,
          publishedAt: a.published_at,
        }),
      );
      const pastOutcomes: PastOutcome[] = rag.pastPredictions.map((p) => ({
        question: p.question,
        outcome: p.outcome,
        probability: p.probability,
      }));

      return {
        ragArticles,
        pastOutcomes,
        anchors,
        structural,
        priors,
        events,
        trace: {
          rag: rag.available ? 'ok' : 'unavailable',
          rag_articles: ragArticles.length,
          past_outcomes: pastOutcomes.length,
          anchors: anchors.length,
          structural: structural ? 'ok' : 'none',
          priors: priors.length,
          events: events.length,
        },
      };
    } catch (e) {
      this.logger.warn(`Araştırmacı aşaması hata: ${(e as Error).message}`);
      return EMPTY;
    }
  }
}
