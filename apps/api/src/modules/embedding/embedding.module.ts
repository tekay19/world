import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { EMBEDDING_QUEUE } from './embedding.constants';
import { EmbeddingClient } from './embedding.client';
import { EmbeddingRepository } from './embedding.repository';
import { EmbeddingService } from './embedding.service';

/** RAG/embedding: haber+hafıza vektörleri + benzerlik getirme. */
@Module({
  imports: [ContentModule, BullModule.registerQueue({ name: EMBEDDING_QUEUE })],
  providers: [
    EmbeddingClient,
    EmbeddingRepository,
    EmbeddingService,
  ],
  exports: [EmbeddingService, EmbeddingRepository, EmbeddingClient],
})
export class EmbeddingModule {}
