import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EMBEDDING_QUEUE, EMBED_JOBS } from './embedding.constants';
import { EmbeddingService } from './embedding.service';

/** Haber + hafıza (analiz/tahmin) embedding'lerini dolduran in-process worker. */
@Processor(EMBEDDING_QUEUE)
export class EmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingProcessor.name);

  constructor(private readonly embedding: EmbeddingService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case EMBED_JOBS.BACKFILL: {
        const articles = await this.embedding.embedNewArticles();
        const memory = await this.embedding.embedNewMemory();
        // Embed'den sonra son haberleri olay kümelerine grupla.
        const clusters = await this.embedding.clusterRecent();
        return { ...articles, ...memory, ...clusters };
      }
      default:
        this.logger.warn(`Bilinmeyen iş: ${job.name}`);
        return null;
    }
  }
}
