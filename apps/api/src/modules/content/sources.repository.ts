import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base.repository';
import { PgService } from '../../database/pg.service';
import { SourceRow } from './content.types';

@Injectable()
export class SourcesRepository extends BaseRepository<SourceRow> {
  protected readonly table = 'sources';

  constructor(pg: PgService) {
    super(pg);
  }

  findActive(): Promise<SourceRow[]> {
    return this.pg.query<SourceRow>(
      `SELECT * FROM sources WHERE active = TRUE ORDER BY id`,
    );
  }

  /** Başarılı çekim: hata sayacını sıfırla, başarı zamanı + öğe sayısını yaz. */
  async recordSuccess(id: string | number, itemCount: number): Promise<void> {
    await this.pg.query(
      `UPDATE sources
          SET last_attempt_at = now(), last_success_at = now(),
              last_error = NULL, last_item_count = $2, consecutive_failures = 0
        WHERE id = $1`,
      [id, itemCount],
    );
  }

  /** Başarısız çekim: ardışık hata sayacını artır, son hatayı sakla. */
  async recordFailure(id: string | number, error: string): Promise<void> {
    await this.pg.query(
      `UPDATE sources
          SET last_attempt_at = now(), last_error = $2,
              consecutive_failures = consecutive_failures + 1
        WHERE id = $1`,
      [id, error.slice(0, 500)],
    );
  }

  /** Kronik-ölü kaynak sayısı (≥ eşik ardışık hata) — çekim özet logu için. */
  async countChronic(minFailures = 10): Promise<number> {
    const row = await this.pg.queryOne<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM sources
        WHERE active = TRUE AND consecutive_failures >= $1`,
      [minFailures],
    );
    return row ? Number(row.n) : 0;
  }
}
