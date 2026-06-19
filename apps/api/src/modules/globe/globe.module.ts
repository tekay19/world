import { Module } from '@nestjs/common';
import { CountriesModule } from '../countries/countries.module';
import { GlobeController } from './globe.controller';
import { GlobeService } from './globe.service';

@Module({
  imports: [CountriesModule],
  controllers: [GlobeController],
  providers: [GlobeService],
})
export class GlobeModule {}
