import { Injectable } from '@nestjs/common';
import { PgService } from '../../database/pg.service';
import { SeriesPoint } from './indicators.client';

export interface LatestIndicator {
  metric_key: string;
  year: number;
  value: number;
}

@Injectable()
export class IndicatorsRepository {
  constructor(private readonly pg: PgService) {}

  /** Bir göstergenin tüm yıllık noktalarını idempotent yaz. */
  async upsertSeries(
    iso2: string,
    metricKey: string,
    points: SeriesPoint[],
    source: string,
  ): Promise<number> {
    if (points.length === 0) return 0;
    return this.pg.transaction(async (c) => {
      for (const p of points) {
        await c.query(
          `INSERT INTO indicators (country_iso2, metric_key, year, value, source)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (country_iso2, metric_key, year)
             DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source,
                           updated_at = now()`,
          [iso2, metricKey, p.year, p.value, source],
        );
      }
      return points.length;
    });
  }

  /** Ülkenin her göstergesi için en güncel değer. */
  latestByCountry(iso2: string): Promise<LatestIndicator[]> {
    return this.pg.query<LatestIndicator>(
      `SELECT DISTINCT ON (metric_key) metric_key, year, value
         FROM indicators
        WHERE country_iso2 = $1 AND value IS NOT NULL
        ORDER BY metric_key, year DESC`,
      [iso2],
    );
  }

  series(
    iso2: string,
    metricKey: string,
    sinceYear: number,
  ): Promise<SeriesPoint[]> {
    return this.pg.query<SeriesPoint>(
      `SELECT year, value FROM indicators
        WHERE country_iso2 = $1 AND metric_key = $2 AND year >= $3
          AND value IS NOT NULL
        ORDER BY year ASC`,
      [iso2, metricKey, sinceYear],
    );
  }

  /** Gerçek referans-sınıf frekansı: metrik geçmişte eşiği kaç yıl aştı? */
  async frequencyAbove(
    iso2: string,
    metricKey: string,
    threshold: number,
    sinceYear: number,
  ): Promise<{ hits: number; total: number }> {
    const row = await this.pg.queryOne<{ hits: number; total: number }>(
      `SELECT COUNT(*) FILTER (WHERE value > $3)::int AS hits,
              COUNT(*)::int AS total
         FROM indicators
        WHERE country_iso2 = $1 AND metric_key = $2 AND year >= $4
          AND value IS NOT NULL`,
      [iso2, metricKey, threshold, sinceYear],
    );
    return { hits: row?.hits ?? 0, total: row?.total ?? 0 };
  }

  countriesWithData(): Promise<string[]> {
    return this.pg
      .query<{ iso2: string }>(`SELECT iso2 FROM countries ORDER BY iso2`)
      .then((rows) => rows.map((r) => r.iso2));
  }
}
