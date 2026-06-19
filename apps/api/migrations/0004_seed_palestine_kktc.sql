-- =====================================================================
-- Seed: Filistin (PS) ve KKTC (NC) varlıkları + haber kaynakları.
-- - Filistin: Natural Earth poligonu ISO_A2=PS ile zaten gelir → tıklanabilir.
-- - KKTC: Natural Earth'te "N. Cyprus" (ISO yok); frontend featureIso2
--   CYN(ADM0_A3) → 'NC' eşlemesiyle tıklanabilir hale getirir.
-- İsrail (IL) ve Kıbrıs (CY) korunur. Idempotent: ON CONFLICT DO NOTHING.
-- =====================================================================

INSERT INTO countries (iso2, name, name_tr, lat, lng, region, profile) VALUES
  ('PS', 'Palestine', 'Filistin', 31.95, 35.23, 'Orta Doğu',
    '{"baskent":"Ramallah (idari)","diller":["Arapça"],"nufus_yaklasik":5300000,"cogunluk_din":"İslam","kurulus":"1988","para_birimi":"ILS / JOD"}'::jsonb),
  ('NC', 'Northern Cyprus', 'KKTC', 35.30, 33.55, 'Doğu Akdeniz',
    '{"baskent":"Lefkoşa","diller":["Türkçe"],"nufus_yaklasik":390000,"cogunluk_din":"İslam","kurulus":"1983","para_birimi":"TRY"}'::jsonb)
ON CONFLICT (iso2) DO NOTHING;

-- ---------------------------------------------------------------------
-- Haber kaynakları (Google Haberler arama beslemeleri — ülke etiketli)
-- ---------------------------------------------------------------------
INSERT INTO sources (name, homepage, feed_url, kind, orientation, lang, country_iso2) VALUES
  ('Google Haberler — Filistin (Arapça)', 'https://news.google.com',
    'https://news.google.com/rss/search?q=%D9%81%D9%84%D8%B3%D8%B7%D9%8A%D9%86&hl=ar&gl=EG&ceid=EG:ar', 'rss', 'notr', 'ar', 'PS'),
  ('Google Haberler — Filistin (Türkçe)', 'https://news.google.com',
    'https://news.google.com/rss/search?q=Filistin&hl=tr&gl=TR&ceid=TR:tr', 'rss', 'notr', 'tr', 'PS'),
  ('Google Haberler — Palestine (English)', 'https://news.google.com',
    'https://news.google.com/rss/search?q=Palestine&hl=en-US&gl=US&ceid=US:en', 'rss', 'uluslararasi', 'en', 'PS'),
  ('Google Haberler — KKTC (Türkçe)', 'https://news.google.com',
    'https://news.google.com/rss/search?q=%22Kuzey+K%C4%B1br%C4%B1s%22+OR+KKTC&hl=tr&gl=TR&ceid=TR:tr', 'rss', 'notr', 'tr', 'NC'),
  ('Google Haberler — KKTC Gündem (Türkçe)', 'https://news.google.com',
    'https://news.google.com/rss/search?q=KKTC+OR+Lefko%C5%9Fa&hl=tr&gl=TR&ceid=TR:tr', 'rss', 'notr', 'tr', 'NC')
ON CONFLICT (feed_url) DO NOTHING;
