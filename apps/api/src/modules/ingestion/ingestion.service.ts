import { Injectable, Logger } from '@nestjs/common';
import Parser from 'rss-parser';
import { ArticlesRepository } from '../content/articles.repository';
import { SourcesRepository } from '../content/sources.repository';
import { SourceRow } from '../content/content.types';
import { CountryTaggingService } from '../content/country-tagging.service';
import { scoreSignal } from '../content/signal';
import { extractArticleText } from '../content/extract';

export interface FetchResult {
  source: string;
  feedUrl: string;
  items: number;
  inserted: number;
  error?: string;
}

/**
 * Aynı anda çekilecek kaynak sayısı. Çok yüksek tutmak PG bağlantı havuzunu ve
 * dış soket/DNS'i doyurup eşzamanlı kullanıcı isteklerini (BYOK, analiz) düşürür.
 * Dengeli bir değer: hızlı ama uygulamayı boğmayan.
 */
const FETCH_CONCURRENCY = 5;

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly parser = new Parser({
    timeout: 12_000,
    headers: { 'user-agent': 'DunyaAnalizBot/0.2 (+rss)' },
  });

  constructor(
    private readonly sources: SourcesRepository,
    private readonly articles: ArticlesRepository,
    private readonly countryTagging: CountryTaggingService,
  ) {}

  private parseDate(value?: string): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /** Tek kaynağı çek + idempotent kaydet. Kaynak hatası fırlatmaz (graceful). */
  async fetchSource(source: SourceRow): Promise<FetchResult> {
    try {
      // parseURL yerine fetch: 301/308 yönlendirmeleri İZLE + tarayıcı-benzeri UA.
      // Çok yayıncı RSS'i taşınmış (redirect) ya da düz "bot" UA'yı engelliyor;
      // bu yüzden parseURL ile boş dönüyorlardı. fetch → parseString bunu çözer.
      const res = await fetch(source.feed_url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(12_000),
        headers: {
          'user-agent':
            'Mozilla/5.0 (compatible; DunyaAnalizBot/0.2; +https://dunya.local/rss)',
          accept:
            'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      const feed = await this.parser.parseString(xml);
      const items = feed.items ?? [];
      let inserted = 0;

      for (const item of items) {
        const url = item.link?.trim();
        const title = item.title?.trim();
        if (!url || !title) continue;

        const extra = item as Record<string, unknown>;
        // Sinyal skoru + ülke etiketi aynı metinden — bir kez kur, ikisinde kullan.
        const bodyText = [
          title,
          item.contentSnippet,
          item.content,
          extra['content:encoded'],
        ]
          .filter(Boolean)
          .join(' ');
        const row = await this.articles.insertIfNew({
          sourceId: source.id,
          url,
          title,
          content:
            item.content ?? (extra['content:encoded'] as string) ?? null,
          summary: item.contentSnippet ?? null,
          lang: source.lang,
          author: item.creator ?? (extra.author as string) ?? null,
          publishedAt: this.parseDate(item.isoDate ?? item.pubDate),
          raw: { guid: item.guid, categories: item.categories },
          signalScore: scoreSignal(bodyText),
        });
        if (row) {
          inserted++;
          await this.countryTagging.tagArticle(
            row.id,
            source.country_iso2,
            bodyText,
          );
        }
      }

      this.logger.log(
        `[${source.name}] ${items.length} öğe, ${inserted} yeni kayıt`,
      );
      // Sağlık: başarı → hata sayacını sıfırla (kaynak panosu/kronik tespit için).
      await this.sources
        .recordSuccess(source.id, items.length)
        .catch(() => undefined);
      return {
        source: source.name,
        feedUrl: source.feed_url,
        items: items.length,
        inserted,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[${source.name}] çekilemedi: ${msg}`);
      // Sağlık: ardışık hata sayacını artır (DB yazımı kendi içinde graceful).
      await this.sources.recordFailure(source.id, msg).catch(() => undefined);
      return {
        source: source.name,
        feedUrl: source.feed_url,
        items: 0,
        inserted: 0,
        error: msg,
      };
    }
  }

  async fetchSourceById(id: string | number): Promise<FetchResult | null> {
    const source = await this.sources.findById(id);
    return source ? this.fetchSource(source) : null;
  }

  /**
   * Tüm aktif kaynakları sınırlı eşzamanlılıkla çek (kaynak biri düşse de devam).
   * 664+ kaynak: sıralı çekim dakikalarca sürerdi; havuz ile birkaç dakikaya iner.
   */
  async fetchAll(): Promise<FetchResult[]> {
    const sources = await this.sources.findActive();
    const results: FetchResult[] = new Array(sources.length);
    let cursor = 0;
    const t0 = Date.now();

    const worker = async (): Promise<void> => {
      for (;;) {
        const i = cursor++;
        if (i >= sources.length) return;
        results[i] = await this.fetchSource(sources[i]);
      }
    };

    const poolSize = Math.min(FETCH_CONCURRENCY, sources.length || 1);
    await Promise.all(Array.from({ length: poolSize }, () => worker()));

    const inserted = results.reduce((n, r) => n + (r?.inserted ?? 0), 0);
    const failed = results.filter((r) => r?.error).length;
    // Kronik-ölü kaynak sayısını da raporla (sağlık verisinin somut kullanımı).
    const chronic = await this.sources.countChronic(10).catch(() => 0);
    this.logger.log(
      `Çekim bitti: ${sources.length} kaynak, ${inserted} yeni haber, ` +
        `${failed} kaynak hatalı (${chronic} kronik ≥10 ardışık), ` +
        `${Math.round((Date.now() - t0) / 1000)} sn.`,
    );
    return results;
  }

  /** Tek makale URL'sinden gövde metni çek (graceful; HTML değilse/kısa ise null). */
  private async fetchArticleText(url: string): Promise<string | null> {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(10_000),
        headers: {
          'user-agent':
            'Mozilla/5.0 (compatible; DunyaAnalizBot/0.2; +https://dunya.local/rss)',
          accept: 'text/html,application/xhtml+xml',
        },
      });
      if (!res.ok) return null;
      if (!(res.headers.get('content-type') ?? '').includes('html')) return null;
      const text = extractArticleText(await res.text());
      return text.length >= 200 ? text : null; // çok kısa → işe yaramaz, atla
    } catch {
      return null;
    }
  }

  /**
   * Tam-metin zenginleştirme: RSS yalnız snippet verdiğinde (content boş/kısa)
   * makale gövdesini çekip doldurur. Küçük partiler, sınırlı eşzamanlılık (kibar).
   */
  async enrichFullText(limit = 25): Promise<{ scanned: number; filled: number }> {
    const rows = await this.articles.findNeedingFulltext(limit);
    if (rows.length === 0) return { scanned: 0, filled: 0 };
    let filled = 0;
    let cursor = 0;
    const t0 = Date.now();

    const worker = async (): Promise<void> => {
      for (;;) {
        const i = cursor++;
        if (i >= rows.length) return;
        const text = await this.fetchArticleText(rows[i].url);
        if (text) {
          await this.articles.fillContent(rows[i].id, text);
          filled++;
        } else {
          // Başarısız: sayaç artsın ki paywall/ölü pencereyi tıkamasın.
          await this.articles.markFulltextTried(rows[i].id);
        }
      }
    };

    const poolSize = Math.min(FETCH_CONCURRENCY, rows.length);
    await Promise.all(Array.from({ length: poolSize }, () => worker()));
    this.logger.log(
      `Tam-metin: ${rows.length} tarandı, ${filled} dolduruldu, ` +
        `${Math.round((Date.now() - t0) / 1000)} sn.`,
    );
    return { scanned: rows.length, filled };
  }
}
