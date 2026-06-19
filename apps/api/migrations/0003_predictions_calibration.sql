-- =====================================================================
-- Faz A — Kalibrasyon döngüsü + taban oran
-- predictions tablosunu çözülebilir-tahmin sözleşmesine (A1) genişletir.
-- =====================================================================

ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS resolution_criteria TEXT,
  ADD COLUMN IF NOT EXISTS resolution_source   TEXT DEFAULT 'llm-judge',  -- 'manual'|'metric'|'llm-judge'
  ADD COLUMN IF NOT EXISTS metric_key          TEXT,                      -- sayısal çıpaya bağlanacaksa (Faz C)
  ADD COLUMN IF NOT EXISTS model               TEXT,                      -- üreten sağlayıcı/model
  ADD COLUMN IF NOT EXISTS topic               TEXT,                      -- 'ekonomi'|'siyaset'|'dispolitika'|'toplum'...
  ADD COLUMN IF NOT EXISTS base_rate           REAL,                      -- referans sınıfı taban oranı (A4)
  ADD COLUMN IF NOT EXISTS prob_low            REAL,                      -- güven aralığı alt
  ADD COLUMN IF NOT EXISTS prob_high           REAL,                      -- güven aralığı üst
  ADD COLUMN IF NOT EXISTS method              JSONB,                     -- taban oran + ayarlama izi / çözümleme kanıtı
  ADD COLUMN IF NOT EXISTS analysis_id         BIGINT REFERENCES analyses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS log_score           REAL,                      -- -log(p_outcome)
  ADD COLUMN IF NOT EXISTS horizon             TEXT;                      -- "3 ay" gibi okunur ufuk

CREATE INDEX IF NOT EXISTS idx_predictions_model ON predictions (model);
CREATE INDEX IF NOT EXISTS idx_predictions_topic ON predictions (topic);
CREATE INDEX IF NOT EXISTS idx_predictions_resolved ON predictions (resolved, resolve_at);
