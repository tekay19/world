import { Injectable } from '@nestjs/common';
import { PgService } from '../../database/pg.service';

export interface NeedsEmbeddingRow {
  id: string;
  title: string;
  summary: string | null;
  content: string | null;
}
export interface SimilarArticle {
  title: string;
  url: string;
  summary: string | null;
  content: string | null;
  published_at: string | null;
  source: string | null;
  orientation: string | null;
  dist: number;
}
export interface SimilarPrediction {
  id: string;
  question: string;
  probability: number | null;
  outcome: boolean | null;
  topic: string | null;
  scope: string | null;
  dist: number;
}
export interface ClusterEvent {
  id: string;
  title: string;
  article_count: number;
  last_seen: string;
}

/**
 * pgvector işlemleri. Sürücü vector tipini bilmez → vektör '[..]' string olarak
 * geçirilir ve SQL'de $n::vector ile cast edilir. Benzerlik: cosine (<=>),
 * article_embeddings ile aynı operatör sınıfı (vector_cosine_ops).
 */
@Injectable()
export class EmbeddingRepository {
  constructor(private readonly pg: PgService) {}

  private vec(v: number[]): string {
    return `[${v.join(',')}]`;
  }

  async upsertArticleEmbedding(
    articleId: string | number,
    model: string,
    v: number[],
  ): Promise<void> {
    await this.pg.query(
      `INSERT INTO article_embeddings (article_id, model, embedding)
       VALUES ($1, $2, $3::vector)
       ON CONFLICT (article_id) DO UPDATE
         SET model = EXCLUDED.model, embedding = EXCLUDED.embedding`,
      [articleId, model, this.vec(v)],
    );
  }

  articlesNeedingEmbedding(limit: number): Promise<NeedsEmbeddingRow[]> {
    return this.pg.query<NeedsEmbeddingRow>(
      `SELECT a.id, a.title, a.summary, a.content
         FROM articles a
         LEFT JOIN article_embeddings ae ON ae.article_id = a.id
        WHERE ae.article_id IS NULL
        ORDER BY COALESCE(a.published_at, a.fetched_at) DESC
        LIMIT $1`,
      [limit],
    );
  }

  /** Ülke (+uluslararası) için sorgu vektörüne en benzer haberler. */
  similarArticlesForCountry(
    iso2: string,
    v: number[],
    limit = 8,
    sinceDays = 3650,
  ): Promise<SimilarArticle[]> {
    return this.pg.query<SimilarArticle>(
      `SELECT a.title, a.url, a.summary, a.content, a.published_at,
              s.name AS source, s.orientation,
              ae.embedding <=> $2::vector AS dist
         FROM article_embeddings ae
         JOIN articles a ON a.id = ae.article_id
         JOIN sources s ON s.id = a.source_id
        WHERE EXISTS (
                SELECT 1
                  FROM article_countries ac
                  JOIN countries c ON c.id = ac.country_id
                 WHERE ac.article_id = a.id AND c.iso2 = $1
              )
          AND COALESCE(a.published_at, a.fetched_at) > now() - make_interval(days => $4)
        ORDER BY ae.embedding <=> $2::vector ASC
        LIMIT $3`,
      [iso2, this.vec(v), limit, sinceDays],
    );
  }

  /** Çözülmüş benzer geçmiş tahminler (gerçek taban oran sinyali). */
  similarPastPredictions(
    ownerUserId: string,
    v: number[],
    limit = 5,
  ): Promise<SimilarPrediction[]> {
    return this.pg.query<SimilarPrediction>(
      `SELECT p.id, p.question, p.probability, p.outcome, p.topic, p.scope,
              pe.embedding <=> $2::vector AS dist
         FROM prediction_embeddings pe
         JOIN predictions p ON p.id = pe.prediction_id
        WHERE p.resolved = TRUE AND p.owner_user_id = $1
        ORDER BY pe.embedding <=> $2::vector ASC
        LIMIT $3`,
      [ownerUserId, this.vec(v), limit],
    );
  }

  // --- Madde 6 hafıza: çözülmüş tahmin embedding'i doldurma ---
  resolvedPredictionsNeedingEmbedding(
    limit: number,
  ): Promise<Array<{ id: string; question: string }>> {
    return this.pg.query(
      `SELECT p.id, p.question
         FROM predictions p
         LEFT JOIN prediction_embeddings pe ON pe.prediction_id = p.id
        WHERE p.resolved = TRUE AND pe.prediction_id IS NULL
        ORDER BY p.id DESC
        LIMIT $1`,
      [limit],
    );
  }

  async upsertPredictionEmbedding(
    predictionId: string | number,
    model: string,
    v: number[],
  ): Promise<void> {
    await this.pg.query(
      `INSERT INTO prediction_embeddings (prediction_id, model, embedding)
       VALUES ($1, $2, $3::vector)
       ON CONFLICT (prediction_id) DO UPDATE
         SET model = EXCLUDED.model, embedding = EXCLUDED.embedding`,
      [predictionId, model, this.vec(v)],
    );
  }

  // ----- Olay-kümeleme (embedding benzerliğiyle haberleri olaylara grupla) -----

  /** Son N saatte embed edilmiş ama henüz hiçbir kümeye girmemiş haberler. */
  recentUnclusteredArticles(
    hours: number,
    limit: number,
  ): Promise<Array<{ id: string; title: string }>> {
    return this.pg.query(
      `SELECT a.id, a.title
         FROM articles a
         JOIN article_embeddings ae ON ae.article_id = a.id
        WHERE COALESCE(a.published_at, a.fetched_at) > now() - make_interval(hours => $1)
          AND NOT EXISTS (
            SELECT 1 FROM article_clusters ac WHERE ac.article_id = a.id
          )
        ORDER BY COALESCE(a.published_at, a.fetched_at) ASC
        LIMIT $2`,
      [hours, limit],
    );
  }

  articleCountryIds(articleId: string | number): Promise<Array<{ country_id: string }>> {
    return this.pg.query(
      'SELECT country_id FROM article_countries WHERE article_id = $1',
      [articleId],
    );
  }

  /** Bir haberin embedding'ine en yakın mevcut küme (son N saat) + kosinüs benzerliği. */
  nearestClusterForArticle(
    articleId: string | number,
    hours: number,
  ): Promise<{ cluster_id: string; sim: number } | null> {
    return this.pg.queryOne(
      `SELECT ac.cluster_id, (1 - (ae.embedding <=> q.embedding))::float8 AS sim
         FROM article_embeddings q
         JOIN article_embeddings ae ON ae.article_id <> q.article_id
         JOIN article_clusters ac ON ac.article_id = ae.article_id
         JOIN articles a ON a.id = ae.article_id
        WHERE q.article_id = $1
          AND COALESCE(a.published_at, a.fetched_at) > now() - make_interval(hours => $2)
        ORDER BY ae.embedding <=> q.embedding
        LIMIT 1`,
      [articleId, hours],
    );
  }

  async createCluster(
    leadArticleId: string | number,
    title: string,
  ): Promise<string> {
    const row = await this.pg.queryOne<{ id: string }>(
      `INSERT INTO clusters (title, lead_article_id, status, article_count)
       VALUES ($1, $2, 'clustered', 0) RETURNING id`,
      [title.slice(0, 300), leadArticleId],
    );
    return row!.id;
  }

  async addArticleToCluster(
    articleId: string | number,
    clusterId: string | number,
    sim: number,
  ): Promise<void> {
    await this.pg.query(
      `INSERT INTO article_clusters (article_id, cluster_id, similarity)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [articleId, clusterId, sim],
    );
    await this.pg.query(
      `UPDATE clusters SET article_count = article_count + 1, last_seen = now()
        WHERE id = $1`,
      [clusterId],
    );
  }

  async linkClusterCountry(
    clusterId: string | number,
    countryId: string | number,
  ): Promise<void> {
    await this.pg.query(
      `INSERT INTO cluster_countries (cluster_id, country_id, confidence)
       VALUES ($1, $2, 1) ON CONFLICT DO NOTHING`,
      [clusterId, countryId],
    );
  }

  /** Ülke için en önemli olaylar (çok-makaleli = gerçek olay, tekil = gürültü). */
  topEventsForCountry(iso2: string, limit: number): Promise<ClusterEvent[]> {
    return this.pg.query<ClusterEvent>(
      `SELECT cl.id, cl.title, cl.article_count, cl.last_seen
         FROM clusters cl
         JOIN cluster_countries cc ON cc.cluster_id = cl.id
         JOIN countries c ON c.id = cc.country_id
        WHERE c.iso2 = $1 AND cl.last_seen > now() - interval '14 days'
        ORDER BY cl.article_count DESC, cl.last_seen DESC
        LIMIT $2`,
      [iso2.toUpperCase(), limit],
    );
  }
}
