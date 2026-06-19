/**
 * Türkiye'ye özel ek kaynakları (buildTurkeyExtra) ayrı bir SQL migration'a yazar:
 *   migrations/0007_seed_sources_tr.sql
 * 0003 zaten uygulandığı için (migrate.ts ada göre izler) ek kaynaklar yeni
 * dosyaya konur. Idempotent: ON CONFLICT (feed_url) DO NOTHING.
 *
 * Kullanım:  npx tsx src/database/gen-tr-sources-sql.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTurkeyExtra } from './sources.data';

const q = (v: string | null): string =>
  v == null ? 'NULL' : `'${v.replace(/'/g, "''")}'`;

function main(): void {
  const sources = buildTurkeyExtra();
  const rows = sources
    .map(
      (s) =>
        `  (${q(s.name)}, ${q(s.homepage)}, ${q(s.feedUrl)}, ${q(s.kind)}, ${q(
          s.orientation,
        )}, ${q(s.lang)}, ${q(s.countryIso2)})`,
    )
    .join(',\n');

  const sql = `-- =====================================================================
-- Seed: Türkiye'ye özel EK haber kaynakları (il + ilçe + konu/aktör).
-- OTOMATİK ÜRETİLDİ — elle düzenlemeyin. Kaynak: sources.data.ts buildTurkeyExtra
-- Idempotent: ON CONFLICT (feed_url) DO NOTHING.  Toplam: ${sources.length}
-- =====================================================================

INSERT INTO sources (name, homepage, feed_url, kind, orientation, lang, country_iso2) VALUES
${rows}
ON CONFLICT (feed_url) DO NOTHING;
`;

  const out = join(__dirname, '..', '..', 'migrations', '0007_seed_sources_tr.sql');
  writeFileSync(out, sql, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`0007_seed_sources_tr.sql yazıldı — ${sources.length} TR kaynağı.`);
}

main();
