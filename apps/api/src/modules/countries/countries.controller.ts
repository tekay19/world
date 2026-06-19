import { Controller, Get, Param, Query } from '@nestjs/common';
import { CountriesService } from './countries.service';
import { ArticlesRepository } from '../content/articles.repository';

@Controller('countries')
export class CountriesController {
  constructor(
    private readonly service: CountriesService,
    private readonly articles: ArticlesRepository,
  ) {}

  // GET /api/countries/:iso2 → profil + konum + gündem endeksi
  @Get(':iso2')
  getCountry(@Param('iso2') iso2: string) {
    return this.service.getCountry(iso2);
  }

  // GET /api/countries/:iso2/feed → son haberler (CANLI HAT akışı)
  @Get(':iso2/feed')
  async feed(@Param('iso2') iso2: string, @Query('limit') limit?: string) {
    const n = Math.min(30, Math.max(1, Number(limit) || 12));
    const rows = await this.articles.recentWithSourceByCountry(iso2, n);
    return rows.map((r) => ({
      title: r.title,
      url: r.url,
      source: r.source,
      orientation: r.orientation,
      published_at: r.published_at,
    }));
  }
}
