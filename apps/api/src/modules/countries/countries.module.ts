import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { CountriesController } from './countries.controller';
import { CountriesRepository } from './countries.repository';
import { CountriesService } from './countries.service';

@Module({
  imports: [ContentModule],
  controllers: [CountriesController],
  providers: [CountriesService, CountriesRepository],
  exports: [CountriesRepository],
})
export class CountriesModule {}
