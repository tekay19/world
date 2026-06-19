-- =====================================================================
-- Seed: ülkeler (centroid lat/lng) + Türkiye profili + 81 il
-- Idempotent: ON CONFLICT DO NOTHING. Tekrar çalıştırılabilir.
-- Not: küre poligonları frontend'de Natural Earth GeoJSON'dan gelir;
--      buradaki lat/lng "ülkeye dön + konum halkası" içindir.
-- =====================================================================

INSERT INTO countries (iso2, name, name_tr, lat, lng, region, profile) VALUES
  ('TR', 'Turkey', 'Türkiye', 39.0, 35.0, 'Batı Asya / Güneydoğu Avrupa',
    '{"baskent":"Ankara","diller":["Türkçe"],"nufus_yaklasik":85000000,"cogunluk_din":"İslam","kurulus":"1923","para_birimi":"TRY"}'::jsonb),
  ('US', 'United States', 'ABD', 39.8, -98.6, 'Kuzey Amerika', '{}'),
  ('GB', 'United Kingdom', 'Birleşik Krallık', 54.0, -2.0, 'Avrupa', '{}'),
  ('DE', 'Germany', 'Almanya', 51.2, 10.4, 'Avrupa', '{}'),
  ('FR', 'France', 'Fransa', 46.2, 2.2, 'Avrupa', '{}'),
  ('IT', 'Italy', 'İtalya', 42.8, 12.6, 'Avrupa', '{}'),
  ('ES', 'Spain', 'İspanya', 40.0, -3.7, 'Avrupa', '{}'),
  ('NL', 'Netherlands', 'Hollanda', 52.2, 5.3, 'Avrupa', '{}'),
  ('SE', 'Sweden', 'İsveç', 60.1, 18.6, 'Avrupa', '{}'),
  ('PL', 'Poland', 'Polonya', 52.0, 19.1, 'Avrupa', '{}'),
  ('UA', 'Ukraine', 'Ukrayna', 48.4, 31.2, 'Avrupa', '{}'),
  ('RU', 'Russia', 'Rusya', 61.5, 105.0, 'Avrasya', '{}'),
  ('CN', 'China', 'Çin', 35.9, 104.2, 'Doğu Asya', '{}'),
  ('JP', 'Japan', 'Japonya', 36.2, 138.3, 'Doğu Asya', '{}'),
  ('KR', 'South Korea', 'Güney Kore', 36.5, 127.8, 'Doğu Asya', '{}'),
  ('IN', 'India', 'Hindistan', 22.0, 79.0, 'Güney Asya', '{}'),
  ('PK', 'Pakistan', 'Pakistan', 30.4, 69.3, 'Güney Asya', '{}'),
  ('ID', 'Indonesia', 'Endonezya', -2.5, 118.0, 'Güneydoğu Asya', '{}'),
  ('AU', 'Australia', 'Avustralya', -25.0, 133.8, 'Okyanusya', '{}'),
  ('BR', 'Brazil', 'Brezilya', -10.0, -52.0, 'Güney Amerika', '{}'),
  ('AR', 'Argentina', 'Arjantin', -34.0, -64.0, 'Güney Amerika', '{}'),
  ('MX', 'Mexico', 'Meksika', 23.6, -102.5, 'Kuzey Amerika', '{}'),
  ('CA', 'Canada', 'Kanada', 56.1, -106.3, 'Kuzey Amerika', '{}'),
  ('EG', 'Egypt', 'Mısır', 26.8, 30.8, 'Kuzey Afrika', '{}'),
  ('ZA', 'South Africa', 'Güney Afrika', -30.6, 22.9, 'Afrika', '{}'),
  ('NG', 'Nigeria', 'Nijerya', 9.1, 8.7, 'Afrika', '{}'),
  ('SA', 'Saudi Arabia', 'Suudi Arabistan', 23.9, 45.1, 'Orta Doğu', '{}'),
  ('AE', 'United Arab Emirates', 'BAE', 23.4, 53.8, 'Orta Doğu', '{}'),
  ('QA', 'Qatar', 'Katar', 25.3, 51.2, 'Orta Doğu', '{}'),
  ('IL', 'Israel', 'İsrail', 31.0, 34.9, 'Orta Doğu', '{}'),
  ('IR', 'Iran', 'İran', 32.4, 53.7, 'Orta Doğu', '{}'),
  ('IQ', 'Iraq', 'Irak', 33.2, 43.7, 'Orta Doğu', '{}'),
  ('SY', 'Syria', 'Suriye', 34.8, 38.0, 'Orta Doğu', '{}'),
  ('GR', 'Greece', 'Yunanistan', 39.1, 21.8, 'Avrupa', '{}'),
  ('BG', 'Bulgaria', 'Bulgaristan', 42.7, 25.5, 'Avrupa', '{}'),
  ('CY', 'Cyprus', 'Kıbrıs', 35.1, 33.4, 'Akdeniz', '{}'),
  ('GE', 'Georgia', 'Gürcistan', 42.3, 43.4, 'Kafkasya', '{}'),
  ('AM', 'Armenia', 'Ermenistan', 40.1, 45.0, 'Kafkasya', '{}'),
  ('AZ', 'Azerbaijan', 'Azerbaycan', 40.1, 47.6, 'Kafkasya', '{}'),
  ('KZ', 'Kazakhstan', 'Kazakistan', 48.0, 66.9, 'Orta Asya', '{}')
ON CONFLICT (iso2) DO NOTHING;

-- ---------------------------------------------------------------------
-- Türkiye'nin 81 ili (plaka + yaklaşık merkez koordinatı)
-- ---------------------------------------------------------------------
INSERT INTO provinces (country_id, plate, name, lat, lng)
SELECT c.id, v.plate, v.name, v.lat, v.lng
FROM countries c
CROSS JOIN (VALUES
  (1,'Adana',37.00,35.32),(2,'Adıyaman',37.76,38.28),(3,'Afyonkarahisar',38.76,30.54),
  (4,'Ağrı',39.72,43.05),(5,'Amasya',40.65,35.83),(6,'Ankara',39.93,32.85),
  (7,'Antalya',36.90,30.70),(8,'Artvin',41.18,41.82),(9,'Aydın',37.85,27.84),
  (10,'Balıkesir',39.65,27.88),(11,'Bilecik',40.15,29.98),(12,'Bingöl',38.88,40.50),
  (13,'Bitlis',38.40,42.11),(14,'Bolu',40.74,31.61),(15,'Burdur',37.72,30.29),
  (16,'Bursa',40.19,29.06),(17,'Çanakkale',40.15,26.41),(18,'Çankırı',40.60,33.62),
  (19,'Çorum',40.55,34.95),(20,'Denizli',37.78,29.09),(21,'Diyarbakır',37.91,40.24),
  (22,'Edirne',41.68,26.56),(23,'Elazığ',38.68,39.22),(24,'Erzincan',39.75,39.50),
  (25,'Erzurum',39.90,41.27),(26,'Eskişehir',39.78,30.52),(27,'Gaziantep',37.07,37.38),
  (28,'Giresun',40.91,38.39),(29,'Gümüşhane',40.46,39.48),(30,'Hakkari',37.57,43.74),
  (31,'Hatay',36.20,36.16),(32,'Isparta',37.76,30.55),(33,'Mersin',36.81,34.64),
  (34,'İstanbul',41.01,28.98),(35,'İzmir',38.42,27.14),(36,'Kars',40.60,43.10),
  (37,'Kastamonu',41.39,33.78),(38,'Kayseri',38.73,35.49),(39,'Kırklareli',41.74,27.22),
  (40,'Kırşehir',39.15,34.16),(41,'Kocaeli',40.77,29.92),(42,'Konya',37.87,32.48),
  (43,'Kütahya',39.42,29.98),(44,'Malatya',38.36,38.31),(45,'Manisa',38.61,27.43),
  (46,'Kahramanmaraş',37.58,36.93),(47,'Mardin',37.31,40.74),(48,'Muğla',37.22,28.36),
  (49,'Muş',38.74,41.49),(50,'Nevşehir',38.62,34.71),(51,'Niğde',37.97,34.68),
  (52,'Ordu',40.98,37.88),(53,'Rize',41.02,40.52),(54,'Sakarya',40.78,30.40),
  (55,'Samsun',41.29,36.33),(56,'Siirt',37.93,41.94),(57,'Sinop',42.03,35.15),
  (58,'Sivas',39.75,37.02),(59,'Tekirdağ',40.98,27.51),(60,'Tokat',40.31,36.55),
  (61,'Trabzon',41.00,39.72),(62,'Tunceli',39.11,39.55),(63,'Şanlıurfa',37.17,38.79),
  (64,'Uşak',38.68,29.41),(65,'Van',38.49,43.41),(66,'Yozgat',39.82,34.81),
  (67,'Zonguldak',41.45,31.79),(68,'Aksaray',38.37,34.03),(69,'Bayburt',40.26,40.23),
  (70,'Karaman',37.18,33.22),(71,'Kırıkkale',39.85,33.52),(72,'Batman',37.88,41.13),
  (73,'Şırnak',37.52,42.46),(74,'Bartın',41.64,32.34),(75,'Ardahan',41.11,42.70),
  (76,'Iğdır',39.92,44.04),(77,'Yalova',40.65,29.27),(78,'Karabük',41.20,32.62),
  (79,'Kilis',36.72,37.12),(80,'Osmaniye',37.07,36.25),(81,'Düzce',40.84,31.16)
) AS v(plate, name, lat, lng)
WHERE c.iso2 = 'TR'
ON CONFLICT (country_id, plate) DO NOTHING;

-- ---------------------------------------------------------------------
-- Örnek kaynaklar (yönelim etiketli — denge için karışık)
-- feed_url'ler örnektir; admin panelinden yönetilir.
-- ---------------------------------------------------------------------
INSERT INTO sources (name, homepage, feed_url, kind, orientation, lang, country_iso2) VALUES
  ('TRT Haber', 'https://www.trthaber.com', 'https://www.trthaber.com/sondakika.rss', 'rss', 'iktidar', 'tr', 'TR'),
  ('BBC Türkçe', 'https://www.bbc.com/turkce', 'https://feeds.bbci.co.uk/turkce/rss.xml', 'rss', 'uluslararasi', 'tr', 'TR'),
  ('Deutsche Welle Türkçe', 'https://www.dw.com/tr', 'https://rss.dw.com/rdf/rss-tur-all', 'rss', 'uluslararasi', 'tr', 'TR'),
  ('Reuters World', 'https://www.reuters.com', 'https://www.reutersagency.com/feed/?best-topics=world&post_type=best', 'rss', 'uluslararasi', 'en', NULL)
ON CONFLICT (feed_url) DO NOTHING;
