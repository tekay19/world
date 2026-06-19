-- =====================================================================
-- Faz B — Çoklu-model panel + şeytanın avukatı
-- =====================================================================

-- Tahmin başına model oyları (B1: bağımsız panel)
CREATE TABLE IF NOT EXISTS prediction_votes (
  id            BIGSERIAL PRIMARY KEY,
  prediction_id BIGINT NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  model         TEXT NOT NULL,           -- 'nvidia/meta-llama-...' gibi
  probability   REAL,                    -- 0..1 bağımsız tahmin
  rationale     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prediction_votes_pred ON prediction_votes (prediction_id);

-- predictions: agregasyon + karşı-tez izi
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS counter_argument TEXT,         -- B2: şeytanın avukatı
  ADD COLUMN IF NOT EXISTS aggregation      TEXT,         -- 'single'|'mean-logit'|'extremized-logit'
  ADD COLUMN IF NOT EXISTS model_count      INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS prob_pre_devil   REAL;         -- karşı-tez öncesi agregasyon
