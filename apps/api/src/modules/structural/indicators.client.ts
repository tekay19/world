import { Injectable } from '@nestjs/common';

export interface SeriesPoint {
  year: number;
  value: number;
}

/**
 * Dünya Bankası gösterge istemcisi (ücretsiz, anahtarsız).
 * ISO2 doğrudan kabul edilir. Yanıt: [meta, data[]]; data {date, value}.
 */
@Injectable()
export class IndicatorsClient {
  async fetchSeries(
    iso2: string,
    wbCode: string,
    fromYear = 1990,
  ): Promise<SeriesPoint[]> {
    const url =
      `https://api.worldbank.org/v2/country/${encodeURIComponent(iso2)}` +
      `/indicator/${wbCode}?format=json&per_page=200&date=${fromYear}:2026`;
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`World Bank HTTP ${r.status}`);
    const j = (await r.json()) as unknown;
    const data = Array.isArray(j)
      ? (j[1] as Array<{ date: string; value: number | null }> | null)
      : null;
    if (!data) return [];
    return data
      .filter((x) => x.value != null && x.date)
      .map((x) => ({ year: Number(x.date), value: Number(x.value) }))
      .filter((p) => Number.isFinite(p.year) && Number.isFinite(p.value));
  }
}
