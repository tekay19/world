import { QueryResultRow } from 'pg';
import { PgService } from './pg.service';

/**
 * Custom repository pattern (Prisma yok).
 * Alt sınıflar tablo adını verir; tüm sorgular PgService üzerinden parametrize çalışır.
 */
export abstract class BaseRepository<T extends QueryResultRow> {
  protected abstract readonly table: string;

  constructor(protected readonly pg: PgService) {}

  async findById(id: number | string): Promise<T | null> {
    return this.pg.queryOne<T>(
      `SELECT * FROM ${this.table} WHERE id = $1`,
      [id],
    );
  }

  async findAll(limit = 100, offset = 0): Promise<T[]> {
    return this.pg.query<T>(
      `SELECT * FROM ${this.table} ORDER BY id DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
  }

  async deleteById(id: number | string): Promise<void> {
    await this.pg.query(`DELETE FROM ${this.table} WHERE id = $1`, [id]);
  }

  async count(): Promise<number> {
    const row = await this.pg.queryOne<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM ${this.table}`,
    );
    return row ? Number(row.n) : 0;
  }
}
