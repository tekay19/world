import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { STRUCTURAL_QUEUE, STRUCTURAL_JOBS } from './structural.constants';
import { StructuralService } from './structural.service';

@Processor(STRUCTURAL_QUEUE)
export class StructuralProcessor extends WorkerHost {
  private readonly logger = new Logger(StructuralProcessor.name);

  constructor(private readonly structural: StructuralService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name === STRUCTURAL_JOBS.PULL_INDICATORS) {
      return this.structural.pullAll();
    }
    this.logger.warn(`Bilinmeyen iş: ${job.name}`);
    return null;
  }
}
