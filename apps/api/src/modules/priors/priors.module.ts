import { Module } from '@nestjs/common';
import { CountriesModule } from '../countries/countries.module';
import { ManifoldClient } from './manifold.client';
import { MetaculusClient } from './metaculus.client';
import { PriorsService } from './priors.service';
import { PriorsController } from './priors.controller';

/** Faz 2 — dış priorlar (Manifold + Metaculus). Tahmin-piyasası/topluluk çapası. */
@Module({
  imports: [CountriesModule],
  controllers: [PriorsController],
  providers: [ManifoldClient, MetaculusClient, PriorsService],
  exports: [PriorsService],
})
export class PriorsModule {}
