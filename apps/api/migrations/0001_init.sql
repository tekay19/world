-- =====================================================================
-- Dünya Analiz — v0.2 init şeması
-- Ham SQL. Prisma yok. Tüm uygulama sorguları parametrize edilir.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- Ülke (analizin merkezi)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS countries (
  id       BIGSERIAL PRIMARY KEY,
  iso2     TEXT UNIQUE NOT NULL,
  name     TEXT NOT NULL,
  name_tr  TEXT,
  lat      DOUBLE PRECISION,
  lng      DOUBLE PRECISION,
  region   TEXT,
  profile  JSONB DEFAULT '{}'::jsonb   -- tarih/din/milliyet/demografi (Wikidata seed)
);

-- Türkiye il katmanı (pilot derinlik)
CREATE TABLE IF NOT EXISTS provinces (
  id          SERIAL PRIMARY KEY,
  country_id  BIGINT NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  plate       INT,                     -- 01..81
  name        TEXT NOT NULL,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  UNIQUE (country_id, plate)
);

-- ---------------------------------------------------------------------
-- Kaynaklar (yönelim etiketli — tarafsızlık dengesi)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sources (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  homepage      TEXT,
  feed_url      TEXT UNIQUE NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'rss',     -- 'rss'|'gdelt'
  orientation   TEXT,                            -- 'iktidar'|'muhalefet'|'uluslararasi'|'notr'
  lang          TEXT DEFAULT 'tr',
  country_iso2  TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Haberler (idempotent: url_hash unique)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS articles (
  id            BIGSERIAL PRIMARY KEY,
  source_id     BIGINT REFERENCES sources(id) ON DELETE SET NULL,
  url           TEXT NOT NULL,
  url_hash      TEXT UNIQUE NOT NULL,            -- sha256(url) — idempotent ingest
  title         TEXT NOT NULL,
  content       TEXT,
  summary       TEXT,
  lang          TEXT,
  author        TEXT,
  published_at  TIMESTAMPTZ,
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw           JSONB
);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_source ON articles (source_id);

-- Embedding (anahtarsız self-hosted multilingual-e5-small = 384 dim)
CREATE TABLE IF NOT EXISTS article_embeddings (
  article_id  BIGINT PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
  model       TEXT NOT NULL,
  embedding   vector(384) NOT NULL
);
-- HNSW yaklaşık komşuluk indeksi
CREATE INDEX IF NOT EXISTS idx_article_embeddings_hnsw
  ON article_embeddings USING hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------
-- Kümeler (tekrarlı haberi tek olaya indirger)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clusters (
  id              BIGSERIAL PRIMARY KEY,
  title           TEXT,
  summary         TEXT,
  lead_article_id BIGINT REFERENCES articles(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'published',  -- 'clustered'|'enriched'|'published'|'discarded'
  article_count   INT NOT NULL DEFAULT 0,
  first_seen      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clusters_last_seen ON clusters (last_seen DESC);

CREATE TABLE IF NOT EXISTS article_clusters (
  article_id  BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  cluster_id  BIGINT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  similarity  REAL,
  PRIMARY KEY (article_id, cluster_id)
);

-- Küme → ülke (ve TR için il)
CREATE TABLE IF NOT EXISTS cluster_countries (
  cluster_id  BIGINT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  country_id  BIGINT NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  confidence  REAL,
  PRIMARY KEY (cluster_id, country_id)
);
CREATE INDEX IF NOT EXISTS idx_cluster_countries_country ON cluster_countries (country_id);

CREATE TABLE IF NOT EXISTS cluster_provinces (
  cluster_id   BIGINT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  province_id  INT NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
  confidence   REAL,
  PRIMARY KEY (cluster_id, province_id)
);

-- Konular
CREATE TABLE IF NOT EXISTS topics (
  id     BIGSERIAL PRIMARY KEY,
  label  TEXT UNIQUE NOT NULL,
  kind   TEXT
);
CREATE TABLE IF NOT EXISTS cluster_topics (
  cluster_id  BIGINT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  topic_id    BIGINT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  weight      REAL,
  PRIMARY KEY (cluster_id, topic_id)
);

-- ---------------------------------------------------------------------
-- Gündem/gerilim endeksi (ülke; TR için province_id dolu)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agenda_scores (
  id          BIGSERIAL PRIMARY KEY,
  country_id  BIGINT NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  province_id INT REFERENCES provinces(id) ON DELETE CASCADE,  -- NULL = ülke geneli
  date        DATE NOT NULL,
  score       REAL NOT NULL,            -- 0..100
  components  JSONB,
  UNIQUE (country_id, province_id, date)
);

-- ---------------------------------------------------------------------
-- Kullanıcılar (S2) + takip
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,          -- Argon2id
  role          TEXT NOT NULL DEFAULT 'user',  -- 'user'|'admin'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_follows (
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country_id  BIGINT NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, country_id)
);

-- ---------------------------------------------------------------------
-- BYOK: kullanıcı LLM kimlik bilgileri (ŞİFRELİ — AES-256-GCM)
-- DB'de yalnız ciphertext + iv + tag + key_version durur. Düz metin ASLA.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_llm_credentials (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider     TEXT NOT NULL,           -- 'openai'|'anthropic'|'gemini'|'kimi'
  model        TEXT,
  key_cipher   BYTEA NOT NULL,
  key_iv       BYTEA NOT NULL,
  key_tag      BYTEA NOT NULL,
  key_hint     TEXT,                    -- maskeli gösterim için son 4 hane (sk-…abcd)
  key_version  INT NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

-- ---------------------------------------------------------------------
-- Analiz çıktısı (doktrin şeması §2.6)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analyses (
  id          BIGSERIAL PRIMARY KEY,
  country_id  BIGINT NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  scope       TEXT NOT NULL DEFAULT 'both',   -- 'domestic'|'foreign'|'both'
  result      JSONB NOT NULL,                 -- facts/framings/drivers/scenarios/blind_spots
  provider    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analyses_country ON analyses (country_id, created_at DESC);

-- ---------------------------------------------------------------------
-- Tahmin + kalibrasyon (resolve_at'siz yayınlanmaz)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS predictions (
  id           BIGSERIAL PRIMARY KEY,
  country_id   BIGINT NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  scope        TEXT,                   -- 'domestic'|'foreign'
  question     TEXT NOT NULL,
  probability  REAL,
  confidence   TEXT,
  rationale    TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolve_at   TIMESTAMPTZ NOT NULL,
  resolved     BOOLEAN NOT NULL DEFAULT FALSE,
  outcome      BOOLEAN,
  brier        REAL
);
CREATE INDEX IF NOT EXISTS idx_predictions_country ON predictions (country_id);
CREATE INDEX IF NOT EXISTS idx_predictions_resolve ON predictions (resolved, resolve_at);

-- ---------------------------------------------------------------------
-- İlişkiler (ülke çifti, çok boyut)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS relations (
  id          BIGSERIAL PRIMARY KEY,
  a_country   BIGINT NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  b_country   BIGINT NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  dimension   TEXT,                   -- 'siyasi'|'ekonomik'|'dini'|'tarihi'|'kulturel'
  status      TEXT,
  summary     TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (a_country, b_country, dimension)
);
