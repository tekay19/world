-- Kimlik doğrulama sonrası kullanıcıya ait üretimleri birbirinden ayır.

ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS owner_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE scenario_sets
  ADD COLUMN IF NOT EXISTS owner_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

-- Yerel modda üretilmiş mevcut kayıtlar, devralınacak yerel kullanıcıya bağlanır.
UPDATE predictions p
   SET owner_user_id = u.id
  FROM users u
 WHERE p.owner_user_id IS NULL AND u.email = 'local@dunya.local';

UPDATE scenario_sets s
   SET owner_user_id = u.id
  FROM users u
 WHERE s.owner_user_id IS NULL AND u.email = 'local@dunya.local';

CREATE INDEX IF NOT EXISTS idx_predictions_owner_active
  ON predictions (owner_user_id, country_id, resolve_at)
  WHERE resolved = FALSE AND superseded_by IS NULL;

CREATE INDEX IF NOT EXISTS idx_scenario_sets_owner_country
  ON scenario_sets (owner_user_id, country_id, created_at DESC);
