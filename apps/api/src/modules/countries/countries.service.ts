import { Injectable, NotFoundException } from '@nestjs/common';
import { PgService } from '../../database/pg.service';
import { CountriesRepository } from './countries.repository';

@Injectable()
export class CountriesService {
  constructor(
    private readonly countries: CountriesRepository,
    private readonly pg: PgService,
  ) {}

  /** Ülke profili + konum + (varsa) gündem endeksi. Haber listesi DÖNMEZ. */
  async getCountry(iso2: string) {
    const country = await this.countries.findByIso2(iso2);
    if (!country) {
      throw new NotFoundException(`Ülke bulunamadı: ${iso2}`);
    }

    const agenda = await this.pg.queryOne<{ score: number; date: string }>(
      `SELECT score, date FROM agenda_scores
        WHERE country_id = $1 AND province_id IS NULL
        ORDER BY date DESC LIMIT 1`,
      [country.id],
    );

    return {
      country: {
        iso2: country.iso2,
        name: country.name,
        name_tr: country.name_tr,
        lat: country.lat,
        lng: country.lng,
        region: country.region,
        profile: country.profile,
      },
      agenda,
    };
  }
}
