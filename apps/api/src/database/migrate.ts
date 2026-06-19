/**
 * Basit, bağımlılıksız SQL migration koşucusu.
 * - migrations/*.sql dosyalarını ada göre sıralı çalıştırır.
 * - Uygulananları schema_migrations tablosunda izler (idempotent).
 * Kullanım:  npm run migrate -w @dunya/api
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

// Bu betik daima CommonJS olarak çalışır (tsx ve nest build); __dirname her zaman tanımlı.
const here = __dirname;

const MIGRATIONS_DIR = join(here, '..', '..', 'migrations');

/** Minimal .env yükleyici (repo kökü). Harici bağımlılık yok. */
function loadDotenv(): void {
  for (const p of [
    join(here, '..', '..', '..', '..', '.env'), // repo kökü
    join(here, '..', '..', '.env'), // apps/api/.env
  ]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

async function main(): Promise<void> {
  loadDotenv();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL tanımlı değil (.env dosyanızı kontrol edin)');
  }

  const client = new Client({ connectionString });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const applied = new Set(
    (
      await client.query<{ filename: string }>(
        'SELECT filename FROM schema_migrations',
      )
    ).rows.map((r) => r.filename),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    process.stdout.write(`→ uygulanıyor: ${file} ... `);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [file],
      );
      await client.query('COMMIT');
      console.log('ok');
      count++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.log('HATA');
      throw err;
    }
  }

  await client.end();
  console.log(
    count === 0
      ? 'Güncel — uygulanacak yeni migration yok.'
      : `${count} migration uygulandı.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
