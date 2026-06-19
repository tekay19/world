import { Injectable, Logger } from '@nestjs/common';

export interface FxPoint {
  value: number;
  ts: Date;
  source: string;
}

/**
 * Anahtarsız döviz kuru kaynağı. Birincil: open.er-api.com; yedek: frankfurter (ECB).
 * İkisi de düşerse hata fırlatır → çağıran o turu atlar (regresyon yok).
 */
@Injectable()
export class SignalsClient {
  private readonly logger = new Logger(SignalsClient.name);

  async fetchUsdTry(): Promise<FxPoint> {
    // Birincil: open.er-api.com (anahtarsız, saatlik)
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(15_000),
      });
      if (r.ok) {
        const d = (await r.json()) as {
          result?: string;
          time_last_update_unix?: number;
          rates?: Record<string, number>;
        };
        const v = d.rates?.TRY;
        if (d.result === 'success' && typeof v === 'number') {
          return {
            value: v,
            ts: d.time_last_update_unix
              ? new Date(d.time_last_update_unix * 1000)
              : new Date(),
            source: 'open.er-api',
          };
        }
      }
    } catch (e) {
      this.logger.warn(
        `open.er-api başarısız, frankfurter denenecek: ${(e as Error).message}`,
      );
    }

    // Yedek: frankfurter (ECB kaynaklı, anahtarsız)
    const r2 = await fetch(
      'https://api.frankfurter.dev/v1/latest?base=USD&symbols=TRY',
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!r2.ok) throw new Error(`Frankfurter HTTP ${r2.status}`);
    const d2 = (await r2.json()) as {
      date?: string;
      rates?: Record<string, number>;
    };
    const v2 = d2.rates?.TRY;
    if (typeof v2 !== 'number') throw new Error('Frankfurter yanıtında TRY yok');
    return {
      value: v2,
      ts: d2.date ? new Date(d2.date) : new Date(),
      source: 'frankfurter-ecb',
    };
  }
}
