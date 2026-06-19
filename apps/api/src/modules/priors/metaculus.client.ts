import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketPrior } from './manifold.client';

/**
 * Metaculus istemcisi — METACULUS_TOKEN ile. Topluluk olasılığı yeni API'de
 * iç içe; çoklu-yol denenir, bulunamazsa soru BAŞLIĞI bağlam olarak döner
 * ("topluluk şu soruyu izliyor"). Token yoksa devre dışı (graceful).
 */
@Injectable()
export class MetaculusClient {
  private readonly token: string | undefined;

  constructor(config: ConfigService) {
    this.token = config.get<string>('METACULUS_TOKEN')?.trim() || undefined;
  }

  get enabled(): boolean {
    return Boolean(this.token);
  }

  async search(term: string, limit = 4): Promise<MarketPrior[]> {
    if (!this.token) return [];
    const url =
      `https://www.metaculus.com/api2/questions/?search=${encodeURIComponent(
        term,
      )}&limit=${limit}&type=binary&status=open&order_by=-activity`;
    const r = await fetch(url, {
      headers: { Authorization: `Token ${this.token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) throw new Error(`Metaculus HTTP ${r.status}`);
    const j = (await r.json()) as { results?: unknown[] };
    const res = (j.results ?? []) as Array<Record<string, unknown>>;
    return res
      .filter((q) => q.title)
      .map((q) => {
        const cp = extractCp(q);
        const id = q.id as number | undefined;
        return {
          question: q.title as string,
          probability: cp,
          url: id ? `https://www.metaculus.com/questions/${id}/` : '',
        };
      });
  }
}

/** Topluluk olasılığını birden çok olası yoldan dener (API şekli değişken). */
function extractCp(q: Record<string, unknown>): number | null {
  const paths: Array<unknown> = [
    (q.community_prediction as Record<string, unknown>)?.['full'] &&
      ((q.community_prediction as Record<string, Record<string, unknown>>).full
        .q2 as unknown),
    (q.question as Record<string, Record<string, Record<string, Record<string, unknown[]>>>>)
      ?.aggregations?.recency_weighted?.latest?.centers?.[0],
  ];
  for (const v of paths) {
    if (typeof v === 'number' && v >= 0 && v <= 1) return v;
  }
  return null;
}
