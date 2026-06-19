import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface FredPoint {
  value: number;
  date: string;
}

/**
 * FRED (St. Louis Fed) istemcisi — makro/emtia serileri (Brent, faiz vb.).
 * FRED_API_KEY yoksa devre dışı (graceful). Bu ortamdan erişilebilir (doğrulandı).
 */
@Injectable()
export class FredClient {
  private readonly key: string | undefined;

  constructor(config: ConfigService) {
    this.key = config.get<string>('FRED_API_KEY')?.trim() || undefined;
  }

  get enabled(): boolean {
    return Boolean(this.key);
  }

  /** Serinin en güncel geçerli gözlemi. */
  async latest(seriesId: string): Promise<FredPoint | null> {
    if (!this.key) return null;
    const url =
      `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}` +
      `&api_key=${this.key}&file_type=json&sort_order=desc&limit=1`;
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`FRED HTTP ${r.status}`);
    const j = (await r.json()) as {
      observations?: Array<{ date: string; value: string }>;
    };
    const o = j.observations?.[0];
    if (!o || o.value === '.' || o.value == null) return null;
    const v = Number(o.value);
    return Number.isFinite(v) ? { value: v, date: o.date } : null;
  }
}
