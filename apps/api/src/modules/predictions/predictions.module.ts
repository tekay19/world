import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { CountriesModule } from '../countries/countries.module';
import { CredentialsModule } from '../credentials/credentials.module';
import { LlmModule } from '../llm/llm.module';
import { EmbeddingModule } from '../embedding/embedding.module';
import { SignalsModule } from '../signals/signals.module';
import { StructuralModule } from '../structural/structural.module';
import { PriorsModule } from '../priors/priors.module';
import { SearchModule } from '../search/search.module';
import { PREDICTIONS_QUEUE } from './predictions.constants';
import { PredictionsController } from './predictions.controller';
import { PredictionsRepository } from './predictions.repository';
import { PredictionsService } from './predictions.service';
import { ResearchService } from './pipeline/researcher';
import { PredictionCalibrationService } from './prediction-calibration.service';
import { PredictionChatService } from './prediction-chat.service';
import { PredictionContextService } from './prediction-context.service';
import { PredictionLifecycleService } from './prediction-lifecycle.service';
import { PredictionResolutionService } from './prediction-resolution.service';
import { PredictionScenarioService } from './prediction-scenario.service';

@Module({
  imports: [
    CountriesModule,
    ContentModule,
    CredentialsModule,
    LlmModule,
    EmbeddingModule,
    SignalsModule,
    StructuralModule,
    PriorsModule,
    SearchModule,
    BullModule.registerQueue({ name: PREDICTIONS_QUEUE }),
  ],
  controllers: [PredictionsController],
  providers: [
    PredictionsRepository,
    PredictionsService,
    ResearchService,
    PredictionContextService,
    PredictionResolutionService,
    PredictionLifecycleService,
    PredictionScenarioService,
    PredictionChatService,
    PredictionCalibrationService,
  ],
  exports: [
    PredictionsService,
    PredictionResolutionService,
    PredictionLifecycleService,
    PredictionScenarioService,
  ],
})
export class PredictionsModule {}
