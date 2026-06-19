import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { STRUCTURAL_QUEUE, STRUCTURAL_JOBS } from './structural.constants';

const PULL_INTERVAL_HOURS = 24 * 7; // haftalık (makro yıllık güncellenir)

/** Dünya Bankası makro çekimini zamanlar (ingestion.scheduler deseni). */
@Injectable()
export class StructuralScheduler implements OnModuleInit {
  private readonly logger = new Logger(StructuralScheduler.name);

  constructor(
    @InjectQueue(STRUCTURAL_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const repeatables = await this.queue.getRepeatableJobs();
      for (const r of repeatables) {
        if (r.name === STRUCTURAL_JOBS.PULL_INDICATORS) {
          await this.queue.removeRepeatableByKey(r.key);
        }
      }
      await this.queue.add(
        STRUCTURAL_JOBS.PULL_INDICATORS,
        {},
        {
          repeat: { every: PULL_INTERVAL_HOURS * 60 * 60 * 1000 },
          jobId: 'pull-indicators-repeat',
          removeOnComplete: 5,
          removeOnFail: 5,
        },
      );
      // Açılışta bir kez (veri boşsa hemen dolsun).
      await this.queue.add(
        STRUCTURAL_JOBS.PULL_INDICATORS,
        {},
        {
          jobId: 'pull-indicators-initial',
          delay: 15_000,
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
      this.logger.log('Yapısal veri çekimi zamanlandı: haftalık + açılış.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Yapısal iş kaydedilemedi (Redis?): ${msg}`);
    }
  }
}
