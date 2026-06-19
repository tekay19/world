import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingClient } from './embedding.client';
import {
  EmbeddingRepository,
  SimilarArticle,
  SimilarPrediction,
} from './embedding.repository';
import { EMBEDDING_MODEL_TAG } from './embedding.constants';

export interface RetrievedContext {
  available: boolean;
  articles: SimilarArticle[];
  pastPredictions: SimilarPrediction[];
}

const EMPTY: RetrievedContext = {
  available: false,
  articles: [],
  pastPredictions: [],
};

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    private readonly client: EmbeddingClient,
    private readonly repo: EmbeddingRepository,
  ) {}

  /** Embedding'i olmayan haberleri toplu embed et (graceful: servis kapalıysa atla).
   *  En yeniler önce embed edilir → RAG güncel konularda hızla ısınır. */
  async embedNewArticles(batch = 400): Promise<{ embedded: number }> {
    if (!(await this.client.health())) {
      this.logger.warn('Embedding servisi kapalı — backfill atlandı.');
      return { embedded: 0 };
    }
    const rows = await this.repo.articlesNeedingEmbedding(batch);
    if (rows.length === 0) return { embedded: 0 };

    let embedded = 0;
    const CHUNK = 32;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const texts = slice.map(
        (r) => `${r.title}. ${(r.summary || r.content || '').slice(0, 500)}`,
      );
      try {
        const vecs = await this.client.embed(texts, 'passage');
        for (let j = 0; j < slice.length; j++) {
          if (vecs[j]) {
            await this.repo.upsertArticleEmbedding(
              slice[j].id,
              EMBEDDING_MODEL_TAG,
              vecs[j],
            );
            embedded++;
          }
        }
      } catch (e) {
        this.logger.warn(
          `Embedding batch hatası: ${e instanceof Error ? e.message : String(e)}`,
        );
        break;
      }
    }
    if (embedded) this.logger.log(`${embedded} haber embed edildi.`);
    return { embedded };
  }

  /** Madde 6 hafıza: çözülmüş tahminleri embed et (RAG taban-oran sinyali). */
  async embedNewMemory(batch = 60): Promise<{ predictions: number }> {
    if (!(await this.client.health())) return { predictions: 0 };
    let predictions = 0;

    const prRows = await this.repo.resolvedPredictionsNeedingEmbedding(batch);
    if (prRows.length) {
      const texts = prRows.map((r) => r.question);
      try {
        const vecs = await this.client.embed(texts, 'passage');
        for (let i = 0; i < prRows.length; i++) {
          if (vecs[i]) {
            await this.repo.upsertPredictionEmbedding(
              prRows[i].id,
              EMBEDDING_MODEL_TAG,
              vecs[i],
            );
            predictions++;
          }
        }
      } catch (e) {
        this.logger.warn(`Tahmin embedding hatası: ${(e as Error).message}`);
      }
    }
    return { predictions };
  }

  /**
   * RAG: odak metni (ülke gündemi/soru) için en benzer geçmiş haber + tahmin.
   * Embedding servisi kapalıysa available:false döner → zincir RAG'sız çalışır.
   */
  async retrieveContext(
    ownerUserId: string,
    iso2: string,
    focusText: string,
    opts?: { articles?: number; predictions?: number },
  ): Promise<RetrievedContext> {
    if (!focusText.trim() || !(await this.client.health())) return EMPTY;
    let qv: number[] | undefined;
    try {
      const [v] = await this.client.embed([focusText.slice(0, 1500)], 'query');
      qv = v;
    } catch {
      return EMPTY;
    }
    if (!qv) return EMPTY;

    try {
      const [articles, pastPredictions] = await Promise.all([
        this.repo.similarArticlesForCountry(iso2, qv, opts?.articles ?? 8),
        this.repo.similarPastPredictions(
          ownerUserId,
          qv,
          opts?.predictions ?? 5,
        ),
      ]);
      return { available: true, articles, pastPredictions };
    } catch (e) {
      this.logger.warn(`RAG getirme hatası: ${(e as Error).message}`);
      return EMPTY;
    }
  }

  /**
   * Olay-kümeleme: son haberleri embedding benzerliğiyle olay kümelerine grupla
   * (online/greedy — zaman sırasıyla; en yakın kümeye eşik üstüyse ekle, yoksa yeni).
   * Tekil küme = gürültü (yerel kaza/spor), çok-makaleli = gerçek olay.
   */
  async clusterRecent(): Promise<{ processed: number; newClusters: number }> {
    const arts = await this.repo.recentUnclusteredArticles(72, 300);
    let processed = 0;
    let newClusters = 0;
    for (const a of arts) {
      try {
        const near = await this.repo.nearestClusterForArticle(a.id, 72);
        let clusterId: string;
        if (near && near.sim >= 0.8) {
          clusterId = near.cluster_id;
          await this.repo.addArticleToCluster(a.id, clusterId, near.sim);
        } else {
          clusterId = await this.repo.createCluster(a.id, a.title);
          await this.repo.addArticleToCluster(a.id, clusterId, 1);
          newClusters++;
        }
        const countryIds = await this.repo.articleCountryIds(a.id);
        for (const { country_id: countryId } of countryIds) {
          await this.repo.linkClusterCountry(clusterId, countryId);
        }
        processed++;
      } catch (e) {
        this.logger.warn(
          `Kümeleme hatası (article ${a.id}): ${(e as Error).message}`,
        );
      }
    }
    if (processed) {
      this.logger.log(`Kümeleme: ${processed} haber → ${newClusters} yeni olay.`);
    }
    return { processed, newClusters };
  }

  /** Ülke için en önemli güncel olaylar (tahmin grounding'i; graceful boş). */
  async topEvents(iso2: string, limit = 8) {
    try {
      return await this.repo.topEventsForCountry(iso2, limit);
    } catch {
      return [];
    }
  }

  /**
   * Yeni tahmin sorularını eski sorularla embedding-kosinüs eşle (revizyon zinciri).
   * Her yeni soru için en yakın eski soru + benzerlik; servis kapalıysa hepsi null.
   * (Embedding'ler normalize → kosinüs = nokta çarpımı.)
   */
  async matchQuestions(
    oldTexts: string[],
    newTexts: string[],
  ): Promise<Array<{ oldIdx: number; sim: number } | null>> {
    if (!oldTexts.length || !newTexts.length) return newTexts.map(() => null);
    if (!(await this.client.health())) return newTexts.map(() => null);
    try {
      const [oldVecs, newVecs] = await Promise.all([
        this.client.embed(oldTexts, 'passage'),
        this.client.embed(newTexts, 'passage'),
      ]);
      const dot = (a: number[], b: number[]) => {
        let s = 0;
        for (let i = 0; i < a.length && i < b.length; i++) s += a[i] * b[i];
        return s;
      };
      return newVecs.map((nv) => {
        if (!nv) return null;
        let best = -1;
        let bestSim = -1;
        for (let i = 0; i < oldVecs.length; i++) {
          if (!oldVecs[i]) continue;
          const sim = dot(nv, oldVecs[i]);
          if (sim > bestSim) {
            bestSim = sim;
            best = i;
          }
        }
        return best >= 0 ? { oldIdx: best, sim: bestSim } : null;
      });
    } catch {
      return newTexts.map(() => null);
    }
  }
}
