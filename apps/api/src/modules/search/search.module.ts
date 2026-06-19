import { Module } from '@nestjs/common';
import { TavilyClient } from './search.client';
import { SearchService } from './search.service';

/** Canlı web araması (Tavily) — senaryo raporu için güncel kaynak + atıf. */
@Module({
  providers: [TavilyClient, SearchService],
  exports: [SearchService],
})
export class SearchModule {}
