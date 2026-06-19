import { Injectable, Logger } from '@nestjs/common';
import { IndicatorsClient } from './indicators.client';
import { IndicatorsRepository } from './indicators.repository';
import { INDICATORS, IndicatorDef } from './structural.constants';

function fmtValue(v: number, ind: IndicatorDef): string {
  if (ind.key === 'POPULATION') return `${(v / 1e6).toFixed(1)}M`;
  if (ind.key === 'RESERVES') return `${(v / 1e9).toFixed(0) }B$`;
  return `${v.toFixed(1)}${ind.unit}`;
}

@Injectable()
export class StructuralService {
  private readonly logger = new Logger(StructuralService.name);

  constructor(
    private readonly client: IndicatorsClient,
    private readonly repo: IndicatorsRepository,
  ) {}

  async pullForCountry(iso2: string): Promise<{ indicators: number; points: number }> {
    let indicators = 0;
    let points = 0;
    for (const ind of INDICATORS) {
      try {
        const series = await this.client.fetchSeries(iso2, ind.wb, 1990);
        if (series.length) {
          points += await this.repo.upsertSeries(iso2, ind.key, series, 'worldbank');
          indicators++;
        }
      } catch (e) {
        this.logger.warn(
          `Gösterge çekilemedi (${iso2}/${ind.key}): ${(e as Error).message}`,
        );
      }
    }
    return { indicators, points };
  }

  async pullAll(): Promise<{ countries: number; points: number }> {
    const isos = await this.repo.countriesWithData();
    let countries = 0;
    let points = 0;
    for (const iso of isos) {
      const r = await this.pullForCountry(iso); // veri yoksa (ör. KKTC) graceful
      if (r.points) {
        points += r.points;
        countries++;
      }
    }
    this.logger.log(`Yapısal veri çekildi: ${countries} ülke, ${points} nokta.`);
    return { countries, points };
  }

  /** UI için yapılandırılmış son değerler (gösterge → değer + yön). */
  async latest(iso2: string): Promise<
    Array<{
      key: string;
      label: string;
      unit: string;
      value: number;
      year: number;
      display: string;
      trend: 'up' | 'down' | 'flat' | null;
    }>
  > {
    const latest = await this.repo.latestByCountry(iso2);
    if (latest.length === 0) return [];
    const map = new Map(latest.map((l) => [l.metric_key, l]));
    const out = [];
    for (const ind of INDICATORS) {
      const l = map.get(ind.key);
      if (!l) continue;
      let trend: 'up' | 'down' | 'flat' | null = null;
      const series = await this.repo.series(iso2, ind.key, l.year - 6);
      if (series.length >= 2) {
        const prev = series[0].value;
        const cur = series[series.length - 1].value;
        trend = cur > prev * 1.05 ? 'up' : cur < prev * 0.95 ? 'down' : 'flat';
      }
      out.push({
        key: ind.key,
        label: ind.label,
        unit: ind.unit,
        value: l.value,
        year: l.year,
        display: fmtValue(l.value, ind),
        trend,
      });
    }
    return out;
  }

  /**
   * Modele verilecek YAPISAL ÖZET: her gösterge için son değer + ~5 yıllık yön.
   * Haber (nowcast) değil; uzun ufuk ve gerçek taban oran için zemin.
   */
  async structuralSummary(iso2: string): Promise<string | null> {
    const latest = await this.repo.latestByCountry(iso2);
    if (latest.length === 0) return null;
    const map = new Map(latest.map((l) => [l.metric_key, l]));
    const lines: string[] = [];
    for (const ind of INDICATORS) {
      const l = map.get(ind.key);
      if (!l) continue;
      let trend = '';
      const series = await this.repo.series(iso2, ind.key, l.year - 6);
      if (series.length >= 2) {
        const prev = series[0].value;
        const cur = series[series.length - 1].value;
        const dir = cur > prev * 1.05 ? '↑' : cur < prev * 0.95 ? '↓' : '→';
        trend = ` (${series[0].year}: ${fmtValue(prev, ind)} ${dir})`;
      }
      lines.push(`- ${ind.label}: ${l.year}=${fmtValue(l.value, ind)}${trend}`);
    }
    return lines.length ? lines.join('\n') : null;
  }
}
