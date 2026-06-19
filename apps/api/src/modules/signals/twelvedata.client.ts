import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Twelve Data istemcisi — piyasa (altın/gümüş/kur). Ücretsiz tier: forex+metal+hisse.
 * TWELVE_DATA_API_KEY yoksa devre dışı (graceful). Rate-limit 8/dk → az sembol çek.
 */
@Injectable()
export class TwelveDataClient {
  private readonly key: string | undefined;

  constructor(config: ConfigService) {
    this.key = config.get<string>('TWELVE_DATA_API_KEY')?.trim() || undefined;
  }

  get enabled(): boolean {
    return Boolean(this.key);
  }

  /** Sembolün anlık fiyatı (ör. XAU/USD). */
  async price(symbol: string): Promise<number | null> {
    if (!this.key) return null;
    const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(
      symbol,
    )}&apikey=${this.key}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`TwelveData HTTP ${r.status}`);
    const j = (await r.json()) as { price?: string; code?: number; message?: string };
    if (j.code || j.price == null) {
      throw new Error(j.message ? j.message.slice(0, 60) : 'fiyat yok');
    }
    const v = Number(j.price);
    return Number.isFinite(v) ? v : null;
  }
}
