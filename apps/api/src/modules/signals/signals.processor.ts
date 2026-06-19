import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SIGNALS_QUEUE, SIGNAL_JOBS } from './signals.constants';
import { SignalsService } from './signals.service';

@Processor(SIGNALS_QUEUE)
export class SignalsProcessor extends WorkerHost {
  private readonly logger = new Logger(SignalsProcessor.name);

  constructor(private readonly signals: SignalsService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case SIGNAL_JOBS.PULL_FX:
        await this.signals.pullFx();
        await this.signals.pullFred();
        await this.signals.pullTwelve();
        return { ok: true };
      default:
        this.logger.warn(`Bilinmeyen iş: ${job.name}`);
        return null;
    }
  }
}
