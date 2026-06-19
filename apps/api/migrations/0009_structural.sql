-- =====================================================================
-- Yapısal veri katmanı: ülke makro göstergeleri (yıllık zaman serisi).
-- Kaynak: Dünya Bankası (ücretsiz, anahtarsız). Uzun ufuk + gerçek taban oran.
-- Idempotent: (country_iso2, metric_key, year) benzersiz.
-- =====================================================================

CREATE TABLE IF NOT EXISTS indicators (
  id           BIGSERIAL PRIMARY KEY,
  country_iso2 TEXT NOT NULL,
  metric_key   TEXT NOT NULL,   -- 'GDP_GROWTH','CPI_YOY','UNEMPLOYMENT','DEBT_GDP','POPULATION','CURRENT_ACCOUNT_GDP','RESERVES'
  year         INT NOT NULL,
  value        DOUBLE PRECISION,
  source       TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_iso2, metric_key, year)
);
CREATE INDEX IF NOT EXISTS idx_indicators_country_metric
  ON indicators (country_iso2, metric_key, year DESC);
