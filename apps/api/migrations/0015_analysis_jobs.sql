-- Analiz sahipliği ve tahmin çözümleme job claim alanları.

ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS owner_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS model TEXT;

UPDATE analyses a
   SET owner_user_id = u.id
  FROM users u
 WHERE a.owner_user_id IS NULL AND u.email = 'local@dunya.local';

CREATE INDEX IF NOT EXISTS idx_analyses_owner_country
  ON analyses (owner_user_id, country_id, created_at DESC);

ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS resolution_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_claim_token UUID;

CREATE INDEX IF NOT EXISTS idx_predictions_resolution_claim
  ON predictions (resolve_at, resolution_claimed_at)
  WHERE resolved = FALSE AND superseded_by IS NULL;
