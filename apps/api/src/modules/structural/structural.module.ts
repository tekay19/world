import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { STRUCTURAL_QUEUE } from './structural.constants';
import { IndicatorsClient } from './indicators.client';
import { IndicatorsRepository } from './indicators.repository';
import { StructuralService } from './structural.service';
import { StructuralController } from './structural.controller';

/** Yapısal veri: ülke makro göstergeleri (uzun ufuk + gerçek taban oran zemini). */
@Module({
  imports: [BullModule.registerQueue({ name: STRUCTURAL_QUEUE })],
  controllers: [StructuralController],
  providers: [
    IndicatorsClient,
    IndicatorsRepository,
    StructuralService,
  ],
  exports: [StructuralService, IndicatorsRepository],
})
export class StructuralModule {}
