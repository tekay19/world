import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EMBEDDING_QUEUE } from '../modules/embedding/embedding.constants';
import { EmbeddingScheduler } from '../modules/embedding/embedding.scheduler';
import { INGESTION_QUEUE } from '../modules/ingestion/ingestion.constants';
import { IngestionScheduler } from '../modules/ingestion/ingestion.scheduler';
import { PREDICTIONS_QUEUE } from '../modules/predictions/predictions.constants';
import { PredictionsScheduler } from '../modules/predictions/predictions.scheduler';
import { SIGNALS_QUEUE } from '../modules/signals/signals.constants';
import { SignalsScheduler } from '../modules/signals/signals.scheduler';
import { STRUCTURAL_QUEUE } from '../modules/structural/structural.constants';
import { StructuralScheduler } from '../modules/structural/structural.scheduler';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: INGESTION_QUEUE },
      { name: EMBEDDING_QUEUE },
      { name: SIGNALS_QUEUE },
      { name: STRUCTURAL_QUEUE },
      { name: PREDICTIONS_QUEUE },
    ),
  ],
  providers: [
    IngestionScheduler,
    EmbeddingScheduler,
    SignalsScheduler,
    StructuralScheduler,
    PredictionsScheduler,
  ],
})
export class SchedulersModule {}
