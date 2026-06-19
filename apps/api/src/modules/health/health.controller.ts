import { Controller, Get } from '@nestjs/common';
import { PgService } from '../../database/pg.service';

@Controller('health')
export class HealthController {
  constructor(private readonly pg: PgService) {}

  @Get()
  async check(): Promise<{ status: string; db: string; ts: string }> {
    let db = 'down';
    try {
      await this.pg.query('SELECT 1');
      db = 'up';
    } catch {
      db = 'down';
    }
    return { status: 'ok', db, ts: new Date().toISOString() };
  }
}
