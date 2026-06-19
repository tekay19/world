-- =====================================================================
-- Zengin uzun-form senaryo raporu: tez + çerçeve + tematik bölümler +
-- kapanış + anahtar sorular + atıflı kaynaklar. (scenarios JSONB artık
-- {label,probability,summary,consequences[]} tutar.)
-- =====================================================================

ALTER TABLE scenario_sets
  ADD COLUMN IF NOT EXISTS title         TEXT,
  ADD COLUMN IF NOT EXISTS framing       TEXT,
  ADD COLUMN IF NOT EXISTS thesis        TEXT,
  ADD COLUMN IF NOT EXISTS sections      JSONB,
  ADD COLUMN IF NOT EXISTS bottom_line   TEXT,
  ADD COLUMN IF NOT EXISTS key_questions JSONB,
  ADD COLUMN IF NOT EXISTS sources       JSONB;
