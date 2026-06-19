-- Tam-metin zenginleştirme izlemesi: RSS yalnız snippet verdiğinde (content NULL)
-- makale URL'sinden gövde çekilir. Kalıcı başarısızları (paywall/ölü) sonsuz
-- yeniden-denemeyle limit penceresini tıkamasın diye deneme sayacı tutulur.

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS fulltext_tries SMALLINT NOT NULL DEFAULT 0;

-- findNeedingFulltext sorgusu (eksik içerik + az denenmiş + taze) hızlı dönsün.
CREATE INDEX IF NOT EXISTS idx_articles_fulltext_todo
  ON articles (fetched_at DESC)
  WHERE content IS NULL OR length(content) < 400;
