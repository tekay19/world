-- =====================================================================
-- Sayısal çıpa: zaman serisi sinyalleri (kur, enflasyon vb.).
-- metric_key, prediction'lardaki metric_key ile aynı (örn. 'USDTRY','CPI_YOY').
-- Idempotent. (metric_key, ts) benzersiz → tekrar çekim çakışmaz.
-- =====================================================================

CREATE TABLE IF NOT EXISTS signals (
  id         BIGSERIAL PRIMARY KEY,
  metric_key TEXT NOT NULL,
  ts         TIMESTAMPTZ NOT NULL,
  value      DOUBLE PRECISION NOT NULL,
  source     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (metric_key, ts)
);
CREATE INDEX IF NOT EXISTS idx_signals_key_ts ON signals (metric_key, ts DESC);
