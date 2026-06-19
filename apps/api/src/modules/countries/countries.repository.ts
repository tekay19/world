import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base.repository';
import { PgService } from '../../database/pg.service';

export interface CountryRow {
  id: string;
  iso2: string;
  name: string;
  name_tr: string | null;
  lat: number | null;
  lng: number | null;
  region: string | null;
  profile: Record<string, unknown>;
}

export interface CountryGlobeRow extends CountryRow {
  agenda_score: number | null;
}

@Injectable()
export class CountriesRepository extends BaseRepository<CountryRow> {
  protected readonly table = 'countries';

  constructor(pg: PgService) {
    super(pg);
  }

  findByIso2(iso2: string): Promise<CountryRow | null> {
    return this.pg.queryOne<CountryRow>(
      `SELECT * FROM countries WHERE iso2 = $1`,
      [iso2.toUpperCase()],
    );
  }

  /** Küre renklendirmesi için: ülke + ülke genelinin en güncel gündem skoru. */
  listForGlobe(): Promise<CountryGlobeRow[]> {
    return this.pg.query<CountryGlobeRow>(
      `SELECT c.*, a.score AS agenda_score
         FROM countries c
         LEFT JOIN LATERAL (
           SELECT score FROM agenda_scores
            WHERE country_id = c.id AND province_id IS NULL
            ORDER BY date DESC LIMIT 1
         ) a ON TRUE
        ORDER BY c.name`,
    );
  }

}
