import { Controller, Get, Param } from '@nestjs/common';
import { CountriesRepository } from '../countries/countries.repository';
import { PriorsService } from './priors.service';

@Controller('countries')
export class PriorsController {
  constructor(
    private readonly countries: CountriesRepository,
    private readonly priors: PriorsService,
  ) {}

  // GET /api/countries/:iso2/priors → tahmin-piyasası/topluluk priorları (Manifold/Metaculus)
  @Get(':iso2/priors')
  async list(@Param('iso2') iso2: string) {
    const c = await this.countries.findByIso2(iso2);
    if (!c) return [];
    const name = c.name ?? c.name_tr ?? iso2;
    return this.priors.forContext(name, `${name} politics economy elections conflict`);
  }
}
