-- =====================================================================
-- Faz 3: Uzun-ufuk SENARYO setleri. Nokta tahmini değil — birbirini dışlayan
-- senaryolar (olasılık toplamı ~1) + sürükleyici + öncü gösterge + koşullu zincir
-- + indirgenemez belirsizlik. (5 yıl gibi ufuklar için dürüst çerçeve.)
-- =====================================================================

CREATE TABLE IF NOT EXISTS scenario_sets (
  id           BIGSERIAL PRIMARY KEY,
  country_id   BIGINT NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  topic        TEXT,
  horizon      TEXT,               -- "5 yıl"
  horizon_days INT,
  question     TEXT NOT NULL,      -- stratejik belirsizlik sorusu
  scenarios    JSONB NOT NULL,     -- [{label,description,probability,drivers[],leading_indicators[],conditional_chain}]
  uncertainty  TEXT,               -- indirgenemez belirsizlik notu
  confidence   TEXT,
  model        TEXT,
  method       JSONB,
  as_of        TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scenario_sets_country
  ON scenario_sets (country_id, created_at DESC);
