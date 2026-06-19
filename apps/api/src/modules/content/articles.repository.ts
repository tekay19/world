import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { BaseRepository } from '../../database/base.repository';
import { PgService } from '../../database/pg.service';
import { ArticleRow } from './content.types';

export interface NewArticle {
  sourceId: string | number;
  url: string;
  title: string;
  content?: string | null;
  summary?: string | null;
  lang?: string | null;
  author?: string | null;
  publishedAt?: Date | null;
  raw?: unknown;
  /** Stratejik sinyal skoru (content/signal.ts); gürültüyü süzmek için. */
  signalScore?: number;
}

@Injectable()
export class ArticlesRepository extends BaseRepository<ArticleRow> {
  protected readonly table = 'articles';

  constructor(pg: PgService) {
    super(pg);
  }

  static hashUrl(url: string): string {
    return createHash('sha256').update(url.trim()).digest('hex');
  }

  /**
   * İdempotent ekleme: url_hash çakışırsa atlanır (ON CONFLICT DO NOTHING).
   * Eklendi ise satırı, atlandıysa null döner.
   */
  async insertIfNew(a: NewArticle): Promise<ArticleRow | null> {
    const urlHash = ArticlesRepository.hashUrl(a.url);
    return this.pg.queryOne<ArticleRow>(
      `INSERT INTO articles
         (source_id, url, url_hash, title, content, summary, lang, author, published_at, raw, signal_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (url_hash) DO NOTHING
       RETURNING *`,
      [
        a.sourceId,
        a.url,
        urlHash,
        a.title,
        a.content ?? null,
        a.summary ?? null,
        a.lang ?? null,
        a.author ?? null,
        a.publishedAt ?? null,
        a.raw ? JSON.stringify(a.raw) : null,
        a.signalScore ?? 0,
      ],
    );
  }

  /**
   * Tam-metin zenginleştirme kuyruğu: içeriği eksik/çok kısa + az denenmiş + taze
   * makaleler. fulltext_tries kalıcı başarısızı (paywall/ölü) pencereden düşürür.
   */
  findNeedingFulltext(
    limit = 25,
  ): Promise<Array<{ id: string; url: string }>> {
    return this.pg.query(
      `SELECT id, url
         FROM articles
        WHERE (content IS NULL OR length(content) < 400)
          AND fulltext_tries < 2
        ORDER BY fetched_at DESC
        LIMIT $1`,
      [limit],
    );
  }

  /** Çekilen tam metni yaz + deneme sayacını artır (başarı). */
  async fillContent(id: string | number, content: string): Promise<void> {
    await this.pg.query(
      `UPDATE articles SET content = $2, fulltext_tries = fulltext_tries + 1 WHERE id = $1`,
      [id, content],
    );
  }

  /** Çekim başarısız: yalnız deneme sayacını artır (2'de pencereden düşer). */
  async markFulltextTried(id: string | number): Promise<void> {
    await this.pg.query(
      `UPDATE articles SET fulltext_tries = fulltext_tries + 1 WHERE id = $1`,
      [id],
    );
  }

  /** Analiz/tahmin girdisi: ülkeye ait + uluslararası haberler, kaynak adı/yönelimiyle. */
  recentWithSourceByCountry(
    iso2: string,
    limit = 12,
  ): Promise<
    Array<{
      title: string;
      url: string;
      summary: string | null;
      content: string | null;
      published_at: string | null;
      source: string | null;
      orientation: string | null;
    }>
  > {
    // ÖNEMLİ: ülke haberlerini öne al (COALESCE(...,FALSE)); Spor/Kültür-Sanat
    // akışlarını dışla. ÇEŞİTLİLİK: ROW_NUMBER ile KAYNAK BAŞINA en çok 3 haber —
    // yoksa çok beslemeli/sık yayınlayan birkaç kuruluş (CNN, Yeni Şafak…) tüm
    // tepeyi dolduruyordu. content (tam metin) zengin kanıt için taşınır.
    // SİNYAL: açık gürültüyü (signal_score<0: kaza/maç/dizi) tamamen at; stratejik
    // (>0) haberleri öne al, grup içinde tazelik. Böylece prompt'a yalnız anlamlı
    // sinyal girer (gürültü → alakasız bağ + token şişmesi/kesilme).
    // TEKRAR ELEME: aynı olay (embedding kümesi) 10 kaynaktan gelince modele 10×
    // tekrarlanıyordu → küme başına TEK temsilci (en yüksek sinyal+tazelik) tut.
    // Kümesiz haber (embedding kapalı/çok yeni) tekil kalır → graceful.
    return this.pg.query(
      `SELECT title, url, summary, content, published_at, source, orientation
         FROM (
           SELECT t.*,
                  ROW_NUMBER() OVER (
                    PARTITION BY dedup_key
                    ORDER BY is_country DESC, (signal_score > 0) DESC, rec DESC
                  ) AS rn_event
             FROM (
               SELECT a.id, a.title, a.url, a.summary, a.content, a.published_at,
                      s.name AS source, s.orientation, a.signal_score,
                      COALESCE(a.published_at, a.fetched_at) AS rec,
                      COALESCE(s.country_iso2 = $1, FALSE) AS is_country,
                      COALESCE('c' || acl.cluster_id::text, 'a' || a.id::text)
                        AS dedup_key,
                      ROW_NUMBER() OVER (
                        PARTITION BY a.source_id
                        ORDER BY COALESCE(a.published_at, a.fetched_at) DESC
                      ) AS rn
                 FROM articles a
                 JOIN sources s ON s.id = a.source_id
                 LEFT JOIN LATERAL (
                   SELECT cluster_id FROM article_clusters
                    WHERE article_id = a.id LIMIT 1
                 ) acl ON TRUE
                WHERE EXISTS (
                        SELECT 1
                          FROM article_countries ac
                          JOIN countries c ON c.id = ac.country_id
                         WHERE ac.article_id = a.id AND c.iso2 = $1
                      )
                  AND s.name NOT ILIKE '%(spor)%'
                  AND s.name NOT ILIKE '%(kültür-sanat)%'
             ) t
            WHERE rn <= 3
              AND signal_score >= 0
         ) d
        WHERE rn_event = 1
        ORDER BY is_country DESC, (signal_score > 0) DESC, rec DESC
        LIMIT $2`,
      [iso2, limit],
    );
  }
}
