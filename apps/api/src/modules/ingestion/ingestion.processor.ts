import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { INGESTION_QUEUE, INGEST_JOBS } from './ingestion.constants';
import { IngestionService } from './ingestion.service';

/**
 * BullMQ tüketici (in-process worker). Üretimde ayrı süreç olarak da koşabilir.
 */
@Processor(INGESTION_QUEUE)
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(private readonly ingestion: IngestionService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case INGEST_JOBS.FETCH_ALL:
        return this.ingestion.fetchAll();
      case INGEST_JOBS.FETCH_SOURCE:
        return this.ingestion.fetchSourceById(
          (job.data as { sourceId: string | number }).sourceId,
        );
      case INGEST_JOBS.ENRICH_FULLTEXT:
        return this.ingestion.enrichFullText(
          (job.data as { limit?: number }).limit ?? 25,
        );
      default:
        this.logger.warn(`Bilinmeyen iş: ${job.name}`);
        return null;
    }
  }
}
