import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SearchResult {
  title: string;
  url: string;
  content: string;
}
export interface SearchResponse {
  answer: string | null;
  results: SearchResult[];
}

/** Tavily canlı web araması — senaryo raporu için güncel kaynak + atıf. */
@Injectable()
export class TavilyClient {
  private readonly logger = new Logger(TavilyClient.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return !!this.config.get<string>('TAVILY_API_KEY');
  }

  async search(
    query: string,
    opts?: { maxResults?: number; days?: number },
  ): Promise<SearchResponse | null> {
    const key = this.config.get<string>('TAVILY_API_KEY');
    if (!key) return null;
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          query,
          search_depth: 'advanced',
          include_answer: true,
          max_results: opts?.maxResults ?? 6,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        this.logger.warn(`Tavily ${res.status}: ${(await res.text()).slice(0, 120)}`);
        return null;
      }
      const data = (await res.json()) as {
        answer?: string;
        results?: Array<{ title?: string; url?: string; content?: string }>;
      };
      return {
        answer: data.answer ?? null,
        results: (data.results ?? []).map((r) => ({
          title: r.title ?? '',
          url: r.url ?? '',
          content: r.content ?? '',
        })),
      };
    } catch (e) {
      this.logger.warn(`Tavily arama hatası: ${(e as Error).message}`);
      return null;
    }
  }
}
