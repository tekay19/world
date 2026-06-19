-- =====================================================================
-- RAG hafıza: geçmiş analiz/tahmin embedding'leri + tahmin revizyon zinciri.
-- article_embeddings ile aynı boyut (384) ve aynı operatör (cosine, <=>).
-- Idempotent. ≥0005 benzersiz önek (migrate.ts ada göre sıralar).
-- =====================================================================

-- Geçmiş analizlerin embedding'i (benzer geçmiş analiz getirme — hafıza).
CREATE TABLE IF NOT EXISTS analysis_embeddings (
  analysis_id BIGINT PRIMARY KEY REFERENCES analyses(id) ON DELETE CASCADE,
  model       TEXT NOT NULL,
  embedding   vector(384) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analysis_embeddings_hnsw
  ON analysis_embeddings USING hnsw (embedding vector_cosine_ops);

-- Çözülmüş tahminlerin embedding'i (benzer geçmiş tahmin → gerçek taban oran).
CREATE TABLE IF NOT EXISTS prediction_embeddings (
  prediction_id BIGINT PRIMARY KEY REFERENCES predictions(id) ON DELETE CASCADE,
  model         TEXT NOT NULL,
  embedding     vector(384) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prediction_embeddings_hnsw
  ON prediction_embeddings USING hnsw (embedding vector_cosine_ops);

-- Yeniden-tahmin: eski revizyon superseded_by ile işaretlenir; aktif = NULL.
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS superseded_by BIGINT REFERENCES predictions(id) ON DELETE SET NULL;
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS revision INT NOT NULL DEFAULT 1;

-- Aktif (güncel revizyon) tahminleri hızlı listele.
CREATE INDEX IF NOT EXISTS idx_predictions_active
  ON predictions (country_id) WHERE superseded_by IS NULL;
