/**
 * sources.data.ts'teki kataloğu, tekrar üretilebilir bir SQL migration'a yazar:
 *   migrations/0003_seed_sources.sql
 *
 * Kullanım:  npx tsx src/database/gen-sources-sql.ts
 * Böylece kaynak listesi kod olarak tutulur (URL'ler doğru üretilir) ama
 * dağıtım/yeniden kurulum SQL migration akışıyla (db:migrate) uyumlu kalır.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSeedSources } from './sources.data';

const q = (v: string | null): string =>
  v == null ? 'NULL' : `'${v.replace(/'/g, "''")}'`;

function main(): void {
  const sources = buildSeedSources();

  const rows = sources
    .map(
      (s) =>
        `  (${q(s.name)}, ${q(s.homepage)}, ${q(s.feedUrl)}, ${q(s.kind)}, ${q(
          s.orientation,
        )}, ${q(s.lang)}, ${q(s.countryIso2)})`,
    )
    .join(',\n');

  const sql = `-- =====================================================================
-- Seed: 500+ haber kaynağı (RSS).  OTOMATİK ÜRETİLDİ — elle düzenlemeyin.
-- Kaynak: src/database/sources.data.ts  ·  Üretici: gen-sources-sql.ts
-- Idempotent: ON CONFLICT (feed_url) DO NOTHING.
-- Toplam kaynak: ${sources.length}
-- =====================================================================

INSERT INTO sources (name, homepage, feed_url, kind, orientation, lang, country_iso2) VALUES
${rows}
ON CONFLICT (feed_url) DO NOTHING;
`;

  const out = join(__dirname, '..', '..', 'migrations', '0003_seed_sources.sql');
  writeFileSync(out, sql, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`0003_seed_sources.sql yazıldı — ${sources.length} kaynak.`);
}

main();
