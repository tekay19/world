import { z } from 'zod';

/**
 * Ortam değişkeni şeması. Eksik/yanlış env ile uygulama AÇILMAZ (fail-fast).
 * Sırlar (master key, JWT) burada doğrulanır ama ASLA loglanmaz.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  API_PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().url(),
  PROCESS_ROLE: z.enum(['api', 'worker', 'scheduler']).default('api'),
  PROCESS_REPLICA_COUNT: z.coerce.number().int().positive().default(1),
  PG_POOL_MAX: z.coerce.number().int().positive().max(50).optional(),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(32).optional(),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),

  // BYOK master key (S3). S0/S1'de zorunlu değil; varsa 32 byte base64 olmalı.
  LLM_MASTER_KEY: z
    .string()
    .optional()
    .refine(
      (v) => !v || Buffer.from(v, 'base64').length === 32,
      'LLM_MASTER_KEY base64 ile 32 byte olmalı (openssl rand -base64 32)',
    ),

  EMBEDDING_URL: z.string().url().default('http://localhost:8000'),

  // FRED (St. Louis Fed) — makro/emtia serileri (Brent, faiz vb.). Opsiyonel.
  FRED_API_KEY: z.string().optional(),

  // Twelve Data — piyasa (altın, kur, BIST hisseleri). Opsiyonel.
  TWELVE_DATA_API_KEY: z.string().optional(),

  // Metaculus — dış prior (tahmin topluluğu). Opsiyonel. (Manifold anahtarsız.)
  METACULUS_TOKEN: z.string().optional(),

  // Tavily — canlı web araması (senaryo raporu için güncel kaynak + atıf). Opsiyonel.
  TAVILY_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Geçersiz ortam değişkenleri:\n${issues}`);
  }
  if (parsed.data.NODE_ENV === 'production' && !parsed.data.JWT_SECRET) {
    throw new Error('Production ortamında JWT_SECRET zorunludur (en az 32 karakter).');
  }
  return parsed.data;
}
