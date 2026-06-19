import { Injectable } from '@nestjs/common';

export interface MarketPrior {
  question: string;
  probability: number | null;
  url: string;
}

/**
 * Manifold Markets istemcisi — anahtarsız. Her ikili piyasa olasılığı doğrudan
 * verir (community odds). Dış prior (tahmin-piyasası çapası) için birincil kaynak.
 */
@Injectable()
export class ManifoldClient {
  async search(term: string, limit = 5): Promise<MarketPrior[]> {
    const url =
      `https://api.manifold.markets/v0/search-markets?term=${encodeURIComponent(
        term,
      )}&limit=${limit}&filter=open&contractType=BINARY&sort=score`;
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`Manifold HTTP ${r.status}`);
    const a = (await r.json()) as Array<{
      question?: string;
      probability?: number;
      url?: string;
    }>;
    if (!Array.isArray(a)) return [];
    return a
      .filter((m) => m.question)
      .map((m) => ({
        question: m.question as string,
        probability: typeof m.probability === 'number' ? m.probability : null,
        url: m.url ?? '',
      }));
  }
}
