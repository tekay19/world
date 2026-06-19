-- RSS kaynak sağlık takibi: 664+ kaynaktan hangisi çalışıyor/ölü görünür olsun,
-- ardışık hata sayısıyla kronik-ölü kaynaklar tespit edilebilsin (ingestion.service).

ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS last_attempt_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_success_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error             TEXT,
  ADD COLUMN IF NOT EXISTS last_item_count        INTEGER,
  ADD COLUMN IF NOT EXISTS consecutive_failures   INTEGER NOT NULL DEFAULT 0;

-- Sağlık panosu/filtre için: en çok hata veren kaynakları hızlı listele.
CREATE INDEX IF NOT EXISTS idx_sources_health
  ON sources (consecutive_failures DESC, last_success_at);
