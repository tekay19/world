-- =====================================================================
-- Tahmin sürüklenme takibi: aynı tahminin zaman içindeki revizyonlarını
-- bir "lineage" altında grupla. Her revizyon predictions'ta ayrı satır
-- (eskiler superseded_by ile); lineage_id aynı aileyi işaretler →
-- olasılık geçmişi = aynı lineage'ın (generated_at, probability) dizisi.
-- =====================================================================

ALTER TABLE predictions ADD COLUMN IF NOT EXISTS lineage_id BIGINT;

-- Mevcut tahminler: her biri kendi lineage'ının kökü.
UPDATE predictions SET lineage_id = id WHERE lineage_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_predictions_lineage
  ON predictions (lineage_id, generated_at);
