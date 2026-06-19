import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { EMBEDDING_QUEUE, EMBED_JOBS } from './embedding.constants';

const BACKFILL_INTERVAL_MIN = 10;

/** Periyodik embedding backfill işini kaydeder (ingestion.scheduler deseni). */
@Injectable()
export class EmbeddingScheduler implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingScheduler.name);

  constructor(
    @InjectQueue(EMBEDDING_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const repeatables = await this.queue.getRepeatableJobs();
      for (const r of repeatables) {
        if (r.name === EMBED_JOBS.BACKFILL) {
          await this.queue.removeRepeatableByKey(r.key);
        }
      }

      await this.queue.add(
        EMBED_JOBS.BACKFILL,
        {},
        {
          repeat: { every: BACKFILL_INTERVAL_MIN * 60 * 1000 },
          jobId: 'embed-backfill-repeat',
          removeOnComplete: 20,
          removeOnFail: 20,
        },
      );
      // Açılışta bir kez (ilk aralığı beklemeden embedding birikmeye başlasın).
      await this.queue.add(
        EMBED_JOBS.BACKFILL,
        {},
        {
          jobId: 'embed-backfill-initial',
          delay: 12_000,
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
      this.logger.log(
        `Embedding backfill zamanlandı: her ${BACKFILL_INTERVAL_MIN} dk + açılış.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Embedding işi kaydedilemedi (Redis?): ${msg}`);
    }
  }
}
