import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SIGNALS_QUEUE } from './signals.constants';
import { SignalsClient } from './signals.client';
import { FredClient } from './fred.client';
import { TwelveDataClient } from './twelvedata.client';
import { SignalsRepository } from './signals.repository';
import { SignalsService } from './signals.service';
import { SignalsController } from './signals.controller';

/** Sayısal çıpa: kur/petrol/faiz zaman serileri (tahmin grounding + metric çözümleme). */
@Module({
  imports: [BullModule.registerQueue({ name: SIGNALS_QUEUE })],
  controllers: [SignalsController],
  providers: [
    SignalsClient,
    FredClient,
    TwelveDataClient,
    SignalsRepository,
    SignalsService,
  ],
  exports: [SignalsService, SignalsRepository],
})
export class SignalsModule {}
