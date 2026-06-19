import { Injectable, Logger } from '@nestjs/common';
import { SignalsClient } from './signals.client';
import { FredClient } from './fred.client';
import { TwelveDataClient } from './twelvedata.client';
import { SignalsRepository } from './signals.repository';
import { METRICS, FRED_SERIES, TWELVE_SERIES } from './signals.constants';

@Injectable()
export class SignalsService {
  private readonly logger = new Logger(SignalsService.name);

  constructor(
    private readonly client: SignalsClient,
    private readonly fred: FredClient,
    private readonly twelve: TwelveDataClient,
    private readonly repo: SignalsRepository,
  ) {}

  /** Döviz kurunu çek + kaydet (graceful: kaynak düşerse o tur atlanır). */
  async pullFx(): Promise<void> {
    try {
      const { value, ts, source } = await this.client.fetchUsdTry();
      await this.repo.insertPoint(METRICS.USDTRY, ts, value, source);
      this.logger.log(`USDTRY=${value} (${source}) kaydedildi.`);
    } catch (e) {
      this.logger.warn(`FX çekilemedi: ${(e as Error).message}`);
    }
  }

  /** FRED serilerini çek (Brent/WTI/faiz). FRED_API_KEY yoksa atlanır. */
  async pullFred(): Promise<void> {
    if (!this.fred.enabled) return;
    for (const f of FRED_SERIES) {
      try {
        const p = await this.fred.latest(f.series);
        if (p) {
          await this.repo.insertPoint(f.metric, new Date(p.date), p.value, 'fred');
          this.logger.log(`${f.metric}=${p.value} (FRED ${f.series}).`);
        }
      } catch (e) {
        this.logger.warn(`FRED ${f.metric} çekilemedi: ${(e as Error).message}`);
      }
    }
  }

  /** Twelve Data serilerini çek (altın/gümüş). Anahtar yoksa atlanır. */
  async pullTwelve(): Promise<void> {
    if (!this.twelve.enabled) return;
    for (const t of TWELVE_SERIES) {
      try {
        const v = await this.twelve.price(t.symbol);
        if (v != null) {
          await this.repo.insertPoint(t.metric, new Date(), v, 'twelvedata');
          this.logger.log(`${t.metric}=${v} (TwelveData ${t.symbol}).`);
        }
      } catch (e) {
        this.logger.warn(`TwelveData ${t.metric} çekilemedi: ${(e as Error).message}`);
      }
      await new Promise((r) => setTimeout(r, 1500)); // rate-limit (8/dk)
    }
  }

  /** Son değer (eşik çözümlemesi için). */
  latest(metricKey: string): ReturnType<SignalsRepository['latest']> {
    return this.repo.latest(metricKey);
  }

  /** UI için tüm metriklerin son değeri + 30g değişim (boş olanlar atlanır). */
  async latestAll(): Promise<
    Array<{
      key: string;
      label: string;
      value: number;
      ts: string;
      source: string | null;
      changePct: number | null;
    }>
  > {
    const labels: Record<string, string> = {
      [METRICS.USDTRY]: 'Dolar / TL',
      [METRICS.BRENT]: 'Brent petrol',
      [METRICS.WTI]: 'WTI petrol',
      [METRICS.FED_RATE]: 'ABD Fed faizi',
      [METRICS.GOLD]: 'Altın ($/ons)',
      [METRICS.SILVER]: 'Gümüş ($/ons)',
    };
    const keys = [
      METRICS.USDTRY,
      METRICS.BRENT,
      METRICS.WTI,
      METRICS.FED_RATE,
      METRICS.GOLD,
      METRICS.SILVER,
    ];
    const out: Array<{
      key: string;
      label: string;
      value: number;
      ts: string;
      source: string | null;
      changePct: number | null;
    }> = [];
    for (const k of keys) {
      const p = await this.repo.latest(k);
      if (!p) continue;
      let changePct: number | null = null;
      const series = await this.repo.seriesSince(k, 30);
      if (series.length >= 2 && series[0].value) {
        const first = series[0].value;
        const last = series[series.length - 1].value;
        changePct = ((last - first) / first) * 100;
      }
      out.push({
        key: k,
        label: labels[k] ?? k,
        value: p.value,
        ts: String(p.ts),
        source: p.source,
        changePct,
      });
    }
    return out;
  }

  /** Modele verilecek sayısal çıpa metni (son değer + 30g trend). null = veri yok. */
  async anchorFor(metricKey: string): Promise<string | null> {
    const latest = await this.repo.latest(metricKey);
    if (!latest) return null;
    let trend = '';
    const series = await this.repo.seriesSince(metricKey, 30);
    if (series.length >= 2) {
      const first = series[0].value;
      const last = series[series.length - 1].value;
      if (first) {
        const pct = ((last - first) / first) * 100;
        trend = ` (30g: ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`;
      }
    }
    return `${metricKey}=${latest.value}${trend} [${latest.source}, ${String(
      latest.ts,
    ).slice(0, 10)}]`;
  }

  /** İzlenen tüm metrikler için çıpa metinleri (boş olanlar atlanır). */
  async anchors(): Promise<string[]> {
    const keys = [
      METRICS.USDTRY,
      METRICS.BRENT,
      METRICS.WTI,
      METRICS.FED_RATE,
      METRICS.GOLD,
      METRICS.SILVER,
    ];
    const out: string[] = [];
    for (const k of keys) {
      const a = await this.anchorFor(k);
      if (a) out.push(a);
    }
    return out;
  }
}
