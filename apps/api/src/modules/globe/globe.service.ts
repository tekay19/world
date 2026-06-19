import { Injectable } from '@nestjs/common';
import { CountriesRepository } from '../countries/countries.repository';

@Injectable()
export class GlobeService {
  constructor(private readonly countries: CountriesRepository) {}

  /** Küre poligonlarını renklendirmek için ülke + gündem endeksi. */
  async listForGlobe() {
    const rows = await this.countries.listForGlobe();
    return rows.map((c) => ({
      iso2: c.iso2,
      name: c.name,
      name_tr: c.name_tr,
      lat: c.lat,
      lng: c.lng,
      region: c.region,
      agendaScore: c.agenda_score, // null olabilir (veri yok)
    }));
  }
}
