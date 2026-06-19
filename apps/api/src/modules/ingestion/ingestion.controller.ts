import { InjectQueue } from '@nestjs/bullmq';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { Queue } from 'bullmq';
import { IsOptional, IsString } from 'class-validator';
import { SourcesRepository } from '../content/sources.repository';
import { INGESTION_QUEUE, INGEST_JOBS } from './ingestion.constants';
import { Roles } from '../auth/auth.decorators';

class RunIngestionDto {
  @IsOptional()
  @IsString()
  sourceId?: string;
}

/**
 * Dev/admin tetikleyici. ÜRETİMDE admin guard ile korunmalı (S2 sonrası).
 */
@Controller('ingestion')
@Roles('admin')
export class IngestionController {
  constructor(
    @InjectQueue(INGESTION_QUEUE) private readonly queue: Queue,
    private readonly sources: SourcesRepository,
  ) {}

  // POST /api/ingestion/run { sourceId? } → çekimi hemen kuyruğa al
  @Post('run')
  async run(@Body() dto: RunIngestionDto) {
    const job = dto.sourceId
      ? await this.queue.add(INGEST_JOBS.FETCH_SOURCE, {
          sourceId: dto.sourceId,
        })
      : await this.queue.add(INGEST_JOBS.FETCH_ALL, {});
    return { enqueued: true, jobId: job.id, name: job.name };
  }

  // GET /api/ingestion/sources → tanımlı kaynaklar (yönelim etiketli)
  @Get('sources')
  listSources() {
    return this.sources.findAll(200);
  }
}
