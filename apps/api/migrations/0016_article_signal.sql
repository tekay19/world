-- Haber stratejik-sinyal skoru: ham RSS gürültüsünü (kaza/maç/dizi) tahmin/senaryo
-- girdisinden süzmek/önceliklemek için. Yetkili skorlayıcı: content/signal.ts.

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS signal_score INTEGER NOT NULL DEFAULT 0;

-- recentWithSourceByCountry sıralaması (sinyal + tazelik) hızlansın.
CREATE INDEX IF NOT EXISTS idx_articles_signal
  ON articles (signal_score DESC, COALESCE(published_at, fetched_at) DESC);

-- Tek-seferlik geri-doldurma (YAKLAŞIK; çekim ekleri/ikircikli sözcükler için
-- content/signal.ts yetkilidir). Mevcut satırlar all-zero başlamasın diye kaba ILIKE.
UPDATE articles SET signal_score =
  (CASE WHEN (COALESCE(title,'') || ' ' || COALESCE(summary,'')) ILIKE ANY (ARRAY[
     '%seçim%','%enflasyon%','%faiz%','%merkez bankas%','%muhalefet%','%kabine%',
     '%cumhurbaşkan%','%savaş%','%çatışma%','%operasyon%','%yaptırım%','%ateşkes%',
     '%müzakere%','%anayasa%','%resesyon%','%devalüasyon%','%nato%','%nükleer%','%darbe%'
   ]) THEN 2 ELSE 0 END)
  -
  (CASE WHEN (COALESCE(title,'') || ' ' || COALESCE(summary,'')) ILIKE ANY (ARRAY[
     '%transfer%','%şampiyon%','%fikstür%','%derbi%','%galibiyet%','%penaltı%',
     '%kaza%','%yangın%','%cinayet%','%hırsız%','%magazin%','%konser%',
     '%hava durumu%','%burç%','%tarif%','%festival%','%kruvaziyer%','%turist%'
   ]) THEN 3 ELSE 0 END);
