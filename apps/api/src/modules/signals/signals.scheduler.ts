import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { SIGNALS_QUEUE, SIGNAL_JOBS } from './signals.constants';

const PULL_INTERVAL_MIN = 60;

/** Periyodik döviz çekimini kaydeder (ingestion.scheduler deseni). */
@Injectable()
export class SignalsScheduler implements OnModuleInit {
  private readonly logger = new Logger(SignalsScheduler.name);

  constructor(
    @InjectQueue(SIGNALS_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const repeatables = await this.queue.getRepeatableJobs();
      for (const r of repeatables) {
        if (r.name === SIGNAL_JOBS.PULL_FX) {
          await this.queue.removeRepeatableByKey(r.key);
        }
      }

      await this.queue.add(
        SIGNAL_JOBS.PULL_FX,
        {},
        {
          repeat: { every: PULL_INTERVAL_MIN * 60 * 1000 },
          jobId: 'pull-fx-repeat',
          removeOnComplete: 20,
          removeOnFail: 20,
        },
      );
      await this.queue.add(
        SIGNAL_JOBS.PULL_FX,
        {},
        {
          jobId: 'pull-fx-initial',
          delay: 6_000,
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
      this.logger.log(`Döviz çekimi zamanlandı: her ${PULL_INTERVAL_MIN} dk + açılış.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Sinyal işi kaydedilemedi (Redis?): ${msg}`);
    }
  }
}
