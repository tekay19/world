-- Makalenin bahsettiği ülke, yayıncının ülkesinden farklıdır.
CREATE TABLE IF NOT EXISTS article_countries (
  article_id  BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  country_id  BIGINT NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  confidence  REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  method      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, country_id)
);

CREATE INDEX IF NOT EXISTS idx_article_countries_country
  ON article_countries (country_id, article_id);

-- Var olan içerikte açık ülke adı geçen kayıtları yüksek güvenle etiketle.
INSERT INTO article_countries (article_id, country_id, confidence, method)
SELECT a.id, c.id, 0.95, 'name-match'
  FROM articles a
 CROSS JOIN countries c
 WHERE position(lower(c.name) IN lower(concat_ws(' ', a.title, a.summary, a.content))) > 0
    OR (
      c.name_tr IS NOT NULL
      AND position(lower(c.name_tr) IN lower(concat_ws(' ', a.title, a.summary, a.content))) > 0
    )
ON CONFLICT (article_id, country_id) DO UPDATE
  SET confidence = GREATEST(article_countries.confidence, EXCLUDED.confidence),
      method = EXCLUDED.method;

-- Açık eşleşmesi olmayan yerel yayınlarda kaynak ülkesi yalnız düşük güvenli fallback'tir.
INSERT INTO article_countries (article_id, country_id, confidence, method)
SELECT a.id, c.id, 0.35, 'source-fallback'
  FROM articles a
  JOIN sources s ON s.id = a.source_id
  JOIN countries c ON c.iso2 = s.country_iso2
 WHERE NOT EXISTS (
   SELECT 1 FROM article_countries ac WHERE ac.article_id = a.id
 )
ON CONFLICT DO NOTHING;
