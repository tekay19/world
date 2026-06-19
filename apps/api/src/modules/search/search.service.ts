import { Injectable } from '@nestjs/common';
import { TavilyClient } from './search.client';

export interface WebContext {
  summary: string; // modele verilecek özet (atıflı)
  sources: Array<{ title: string; url: string }>;
}

/** Senaryo raporu için canlı web bağlamı (güncel analiz/rapor/haber + kaynaklar). */
@Injectable()
export class SearchService {
  constructor(private readonly tavily: TavilyClient) {}

  get enabled(): boolean {
    return this.tavily.enabled;
  }

  /** Tahmin için: ülke + KATEGORİ odaklı tek-sorgu güncel bağlam (savaş/çatışma vb.). */
  async forTopic(
    countryName: string,
    topicTerms: string,
  ): Promise<WebContext | null> {
    if (!this.tavily.enabled) return null;
    const r = await this.tavily.search(
      `${countryName} ${topicTerms} latest developments risks 2026`,
      { maxResults: 6 },
    );
    if (!r) return null;
    const sources = r.results
      .filter((x) => x.url)
      .map((x) => ({ title: x.title || x.url, url: x.url }));
    const lines: string[] = [];
    if (r.answer) lines.push(r.answer.trim());
    for (const res of r.results) {
      lines.push(`[${res.title}] ${res.content.slice(0, 350)}`);
    }
    if (lines.length === 0) return null;
    return { summary: lines.join('\n\n').slice(0, 5000), sources: sources.slice(0, 8) };
  }

  /** Ülke + odak için çok-sorgulu arama → tekilleştirilmiş bağlam + kaynak listesi. */
  async forContext(
    countryName: string,
    focusText: string,
  ): Promise<WebContext | null> {
    if (!this.tavily.enabled) return null;
    const queries = [
      `${countryName} ${focusText} forecast outlook 2026 2027`,
      `${countryName} economy inflation growth IMF OECD 2026`,
      `${countryName} politics elections democracy analysis 2026`,
    ];
    const responses = (
      await Promise.all(
        queries.map((q) => this.tavily.search(q, { maxResults: 5 })),
      )
    ).filter((r): r is NonNullable<typeof r> => r != null);
    if (responses.length === 0) return null;

    const sources: Array<{ title: string; url: string }> = [];
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const r of responses) {
      if (r.answer) lines.push(r.answer.trim());
      for (const res of r.results) {
        if (!res.url || seen.has(res.url)) continue;
        seen.add(res.url);
        sources.push({ title: res.title || res.url, url: res.url });
        lines.push(`[${res.title}] ${res.content.slice(0, 400)}`);
      }
    }
    if (lines.length === 0) return null;
    return {
      summary: lines.join('\n\n').slice(0, 7000),
      sources: sources.slice(0, 12),
    };
  }
}
