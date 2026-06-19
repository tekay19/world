import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResultRow } from 'pg';

export type ProcessRole = 'api' | 'worker' | 'scheduler';

const ROLE_POOL_BUDGET: Record<ProcessRole, number> = {
  api: 40,
  worker: 30,
  scheduler: 5,
};

const ROLE_INSTANCE_CAP: Record<ProcessRole, number> = {
  api: 10,
  worker: 10,
  scheduler: 2,
};

export function poolMaxForProcess(
  role: ProcessRole,
  replicas: number,
  explicitMax?: number,
): number {
  if (explicitMax != null) return explicitMax;
  const replicaCount = Math.max(1, Math.floor(replicas));
  return Math.max(
    1,
    Math.min(
      ROLE_INSTANCE_CAP[role],
      Math.floor(ROLE_POOL_BUDGET[role] / replicaCount),
    ),
  );
}

/**
 * Tek bağlantı havuzu. Tüm sorgular PARAMETRİZE edilir ($1, $2 ...).
 * String birleştirme ile SQL kurmak YASAK (SQL injection koruması).
 */
@Injectable()
export class PgService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PgService.name);
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    const role = config.get<ProcessRole>('PROCESS_ROLE', 'api');
    const replicas = config.get<number>('PROCESS_REPLICA_COUNT', 1);
    const max = poolMaxForProcess(
      role,
      replicas,
      config.get<number>('PG_POOL_MAX'),
    );
    this.pool = new Pool({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
      max,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    this.pool.on('error', (err) =>
      this.logger.error(`Beklenmeyen pool hatası: ${err.message}`),
    );
    this.logger.log(`PostgreSQL pool rol=${role} replika=${replicas} max=${max}`);
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query('SELECT 1');
    this.logger.log('PostgreSQL bağlantı havuzu hazır');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  /** Parametrize sorgu. text yalnız $n placeholder içermeli. */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const res = await this.pool.query<T>(text, params as never[]);
    return res.rows;
  }

  /** Tek satır (yoksa null). */
  async queryOne<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows[0] ?? null;
  }

  /** Transaction yardımcı: fn içinde aynı client ile çalışır. */
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
