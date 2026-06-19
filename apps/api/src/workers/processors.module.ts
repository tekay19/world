import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EmbeddingModule } from '../modules/embedding/embedding.module';
import { EMBEDDING_QUEUE } from '../modules/embedding/embedding.constants';
import { EmbeddingProcessor } from '../modules/embedding/embedding.processor';
import { IngestionModule } from '../modules/ingestion/ingestion.module';
import { INGESTION_QUEUE } from '../modules/ingestion/ingestion.constants';
import { IngestionProcessor } from '../modules/ingestion/ingestion.processor';
import { PredictionsModule } from '../modules/predictions/predictions.module';
import { PREDICTIONS_QUEUE } from '../modules/predictions/predictions.constants';
import { PredictionsProcessor } from '../modules/predictions/predictions.processor';
import { SignalsModule } from '../modules/signals/signals.module';
import { SIGNALS_QUEUE } from '../modules/signals/signals.constants';
import { SignalsProcessor } from '../modules/signals/signals.processor';
import { StructuralModule } from '../modules/structural/structural.module';
import { STRUCTURAL_QUEUE } from '../modules/structural/structural.constants';
import { StructuralProcessor } from '../modules/structural/structural.processor';

@Module({
  imports: [
    IngestionModule,
    EmbeddingModule,
    SignalsModule,
    StructuralModule,
    PredictionsModule,
    BullModule.registerQueue(
      { name: INGESTION_QUEUE },
      { name: EMBEDDING_QUEUE },
      { name: SIGNALS_QUEUE },
      { name: STRUCTURAL_QUEUE },
      { name: PREDICTIONS_QUEUE },
    ),
  ],
  providers: [
    IngestionProcessor,
    EmbeddingProcessor,
    SignalsProcessor,
    StructuralProcessor,
    PredictionsProcessor,
  ],
})
export class ProcessorsModule {}
