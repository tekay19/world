import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { INGESTION_QUEUE } from './ingestion.constants';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [
    ContentModule,
    BullModule.registerQueue({ name: INGESTION_QUEUE }),
  ],
  controllers: [IngestionController],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
