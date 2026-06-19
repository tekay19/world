import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PREDICTIONS_QUEUE, PREDICTION_JOBS } from './predictions.constants';
import { PredictionLifecycleService } from './prediction-lifecycle.service';
import { PredictionResolutionService } from './prediction-resolution.service';
import { PredictionScenarioService } from './prediction-scenario.service';

/** Tekrarlayan çözümleme işini tüketir (in-process worker). */
@Processor(PREDICTIONS_QUEUE)
export class PredictionsProcessor extends WorkerHost {
  private readonly logger = new Logger(PredictionsProcessor.name);

  constructor(
    private readonly resolution: PredictionResolutionService,
    private readonly lifecycle: PredictionLifecycleService,
    private readonly scenarios: PredictionScenarioService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name === PREDICTION_JOBS.RESOLVE_DUE) {
      const summary = await this.resolution.resolveDue();
      this.logger.log(`Çözümleme: ${JSON.stringify(summary)}`);
      return summary;
    }
    if (job.name === PREDICTION_JOBS.REPREDICT_STALE) {
      const summary = await this.lifecycle.repredictStale();
      this.logger.log(`Yeniden-tahmin: ${JSON.stringify(summary)}`);
      return summary;
    }
    if (job.name === PREDICTION_JOBS.REFRESH_SCENARIOS) {
      const summary = await this.scenarios.refreshMonthly();
      this.logger.log(`Senaryo yenileme: ${JSON.stringify(summary)}`);
      return summary;
    }
    return null;
  }
}
