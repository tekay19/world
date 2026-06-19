import { Module } from '@nestjs/common';
import { ArticlesRepository } from './articles.repository';
import { SourcesRepository } from './sources.repository';
import { CountryTaggingService } from './country-tagging.service';

/** Paylaşılan içerik repository'leri (ingestion + analysis + predictions kullanır). */
@Module({
  providers: [SourcesRepository, ArticlesRepository, CountryTaggingService],
  exports: [SourcesRepository, ArticlesRepository, CountryTaggingService],
})
export class ContentModule {}
