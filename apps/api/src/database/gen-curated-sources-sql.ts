/**
 * Ulusal + uluslararası doğrudan RSS kaynaklarını (buildCuratedExtra) ayrı
 * migration'a yazar: migrations/0008_seed_sources_curated.sql
 * Idempotent: ON CONFLICT (feed_url) DO NOTHING.
 *
 * Kullanım:  npx tsx src/database/gen-curated-sources-sql.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCuratedExtra } from './sources.data';

const q = (v: string | null): string =>
  v == null ? 'NULL' : `'${v.replace(/'/g, "''")}'`;

function main(): void {
  const sources = buildCuratedExtra();
  const rows = sources
    .map(
      (s) =>
        `  (${q(s.name)}, ${q(s.homepage)}, ${q(s.feedUrl)}, ${q(s.kind)}, ${q(
          s.orientation,
        )}, ${q(s.lang)}, ${q(s.countryIso2)})`,
    )
    .join(',\n');

  const sql = `-- =====================================================================
-- Seed: Ulusal (TR) + uluslararası kuruluşların DOĞRUDAN kategori RSS'leri.
-- OTOMATİK ÜRETİLDİ. Kaynak: sources.data.ts buildCuratedExtra
-- Idempotent: ON CONFLICT (feed_url) DO NOTHING.  Toplam: ${sources.length}
-- =====================================================================

INSERT INTO sources (name, homepage, feed_url, kind, orientation, lang, country_iso2) VALUES
${rows}
ON CONFLICT (feed_url) DO NOTHING;
`;

  const out = join(
    __dirname,
    '..',
    '..',
    'migrations',
    '0008_seed_sources_curated.sql',
  );
  writeFileSync(out, sql, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`0008_seed_sources_curated.sql yazıldı — ${sources.length} kaynak.`);
}

main();
