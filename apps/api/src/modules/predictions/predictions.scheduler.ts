import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PREDICTIONS_QUEUE, PREDICTION_JOBS } from './predictions.constants';

/** Vadesi gelen tahminleri çözümlemek için tekrarlayan iş (saatlik). */
@Injectable()
export class PredictionsScheduler implements OnModuleInit {
  private readonly logger = new Logger(PredictionsScheduler.name);

  constructor(
    @InjectQueue(PREDICTIONS_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.queue.add(
        PREDICTION_JOBS.RESOLVE_DUE,
        {},
        {
          repeat: { every: 60 * 60 * 1000 },
          jobId: 'resolve-due-repeat',
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      );
      // Madde 6: eskimiş tahminleri periyodik yeniden üret (6 saatte bir).
      await this.queue.add(
        PREDICTION_JOBS.REPREDICT_STALE,
        {},
        {
          repeat: { every: 6 * 60 * 60 * 1000 },
          jobId: 'repredict-stale-repeat',
          removeOnComplete: 20,
          removeOnFail: 20,
        },
      );
      // Senaryo setlerini aylık olarak güncel haber/veriyle yenile (30 günde bir).
      await this.queue.add(
        PREDICTION_JOBS.REFRESH_SCENARIOS,
        {},
        {
          repeat: { every: 30 * 24 * 60 * 60 * 1000 },
          jobId: 'refresh-scenarios-repeat',
          removeOnComplete: 10,
          removeOnFail: 10,
        },
      );
      this.logger.log(
        'Tekrarlayan çözümleme (60 dk) + yeniden-tahmin (6 sa) + senaryo yenileme (30 g) kaydedildi.',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Çözümleme işi kaydedilemedi (Redis?): ${msg}`);
    }
  }
}
