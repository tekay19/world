import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { PgService } from '../../database/pg.service';

export interface CountryCandidate {
  id: string;
  iso2: string;
  name: string;
  name_tr: string | null;
}

export interface CountryTag {
  countryId: string;
  confidence: number;
  method: 'name-match' | 'source-fallback';
}

const COMMON_ALIASES: Record<string, string[]> = {
  TR: ['Türkiye', 'Turkey'],
  US: ['ABD', 'USA', 'United States', 'Amerika Birleşik Devletleri'],
  GB: ['UK', 'Britain', 'Britanya', 'İngiltere', 'United Kingdom'],
  AE: ['BAE', 'UAE', 'Birleşik Arap Emirlikleri'],
  KR: ['Güney Kore', 'South Korea'],
  KP: ['Kuzey Kore', 'North Korea'],
  RU: ['Rusya', 'Russia'],
  CN: ['Çin', 'China'],
  DE: ['Almanya', 'Germany'],
  FR: ['Fransa', 'France'],
};

const normalize = (value: string): string =>
  ` ${value
    .normalize('NFKC')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;

export function detectCountryMentions(
  text: string,
  countries: CountryCandidate[],
  sourceIso2?: string | null,
): CountryTag[] {
  const haystack = normalize(text);
  const explicit = countries.filter((country) => {
    const aliases = [
      country.name,
      country.name_tr,
      ...(COMMON_ALIASES[country.iso2] ?? []),
    ].filter((v): v is string => Boolean(v && v.trim()));
    return aliases.some((alias) => {
      const needle = normalize(alias);
      return needle.length > 3 && haystack.includes(needle);
    });
  });
  if (explicit.length) {
    return explicit.map((country) => ({
      countryId: country.id,
      confidence: 0.95,
      method: 'name-match',
    }));
  }
  const fallback = countries.find((country) => country.iso2 === sourceIso2?.toUpperCase());
  return fallback
    ? [{ countryId: fallback.id, confidence: 0.35, method: 'source-fallback' }]
    : [];
}

@Injectable()
export class CountryTaggingService {
  private countries: CountryCandidate[] = [];
  private loadedAt = 0;

  constructor(private readonly pg: PgService) {}

  async tagArticle(
    articleId: string,
    sourceIso2: string | null,
    text: string,
  ): Promise<CountryTag[]> {
    const countries = await this.countryCandidates();
    const tags = detectCountryMentions(text, countries, sourceIso2);
    await this.pg.transaction(async (client) => this.replaceTags(client, articleId, tags));
    return tags;
  }

  private async countryCandidates(): Promise<CountryCandidate[]> {
    if (this.countries.length && Date.now() - this.loadedAt < 5 * 60_000) {
      return this.countries;
    }
    this.countries = await this.pg.query<CountryCandidate>(
      'SELECT id, iso2, name, name_tr FROM countries',
    );
    this.loadedAt = Date.now();
    return this.countries;
  }

  private async replaceTags(
    client: PoolClient,
    articleId: string,
    tags: CountryTag[],
  ): Promise<void> {
    await client.query('DELETE FROM article_countries WHERE article_id = $1', [articleId]);
    for (const tag of tags) {
      await client.query(
        `INSERT INTO article_countries (article_id, country_id, confidence, method)
         VALUES ($1, $2, $3, $4)`,
        [articleId, tag.countryId, tag.confidence, tag.method],
      );
    }
  }
}
