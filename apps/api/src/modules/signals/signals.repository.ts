import { Injectable } from '@nestjs/common';
import { PgService } from '../../database/pg.service';

export interface SignalPoint {
  value: number;
  ts: string;
  source: string | null;
}

@Injectable()
export class SignalsRepository {
  constructor(private readonly pg: PgService) {}

  async insertPoint(
    metricKey: string,
    ts: Date,
    value: number,
    source: string,
  ): Promise<void> {
    await this.pg.query(
      `INSERT INTO signals (metric_key, ts, value, source)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (metric_key, ts)
         DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source`,
      [metricKey, ts, value, source],
    );
  }

  latest(metricKey: string): Promise<SignalPoint | null> {
    return this.pg.queryOne<SignalPoint>(
      `SELECT value, ts, source FROM signals
        WHERE metric_key = $1 ORDER BY ts DESC LIMIT 1`,
      [metricKey],
    );
  }

  seriesSince(
    metricKey: string,
    days: number,
  ): Promise<Array<{ ts: string; value: number }>> {
    return this.pg.query(
      `SELECT ts, value FROM signals
        WHERE metric_key = $1 AND ts > now() - make_interval(days => $2)
        ORDER BY ts ASC`,
      [metricKey, days],
    );
  }
}
