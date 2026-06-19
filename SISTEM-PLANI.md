# Dünya Gelecek Tahmin & Analiz Sistemi — Sistem Planı

**Sürüm:** v0.2 (genişletilmiş MVP) · v0.1'in üstüne
**Stack:** NestJS · Next.js · PostgreSQL (pgvector) · Redis · BullMQ · self-hosted embedding · **BYOK LLM** (OpenAI / Claude / Gemini / Kimi)
**Hedef:** Uzayda dönen 3D Dünya üzerinde seçilen ülke için, hem iç hem dış olayları kaynaklı, tarafsız, çok perspektifli ve ileri görüşlü biçimde analiz eden; dürüst (olasılıksal, kalibre) gelecek senaryoları üreten sistem. Türkiye pilot ülke.

### v0.1'e göre ne değişti

- Düz Türkiye haritası → **uzayda dönen 3D Dünya** (ülke seçimi + konum vurgusu).
- Tek/gömülü LLM → **BYOK çok sağlayıcılı** (kullanıcı kendi anahtarını girer).
- Yeni ve merkezi bölüm: **Analiz Doktrini** (zeki · ileri görüşlü · tarafsız · çok perspektifli · iç+dış).
- Auth artık erken faz (anahtarlar kullanıcıya bağlı).

---

## 0. Kapsam & Varsayımlar

- **Merkez görünüm:** Uzayda dönen 3D Dünya. Tüm ülkeler seçilebilir.
- **Pilot ülke:** Türkiye varsayılan seçili. Türkçe kaynak + il bazlı derinlik **yalnızca Türkiye'de**; diğer ülkeler GDELT + uluslararası kaynaklarla **ülke seviyesinde**.
- **LLM:** Uygulamada gömülü anahtar **yok**. Kullanıcı kendi anahtarını getirir (BYOK). Üretken analiz buna bağlı; kümeleme buna bağlı **değil**.
- **Tahmin:** İlk sürümde TimesFM yok. Tahmin = doktrine uygun LLM senaryo üretimi + basit momentum + kalibrasyon (Brier). Nicel zaman serisi tahmini ileri faz.
- **ORM:** Prisma yok. Ham SQL + custom repository pattern.

---

## 1. Ürün Tanımı

**Tek cümle:** Dünyayı uzaydan döndür, bir ülkeye tıkla — o ülkenin iç ve dış gündemini kaynaklı, tarafsız ve ileri görüşlü bir analizle, dürüst belirsizlikle gelecek senaryolarına bağlayarak gör.

**Değer:** Dağınık/tekrarlı haberi tek olaya indirger; coğrafyayı küre üstünde gösterir; "her şeyi bilen" değil **gerekçelendiren** bir dil kullanır; iddiasını kalibrasyonla ölçülebilir kılar; tek bir bakış açısına saplanmaz.

---

## 2. Analiz Doktrini (sistemin kalbi)

Sistemin verdiği her analiz dört ilkeye uymak zorunda. Bunlar "tavsiye" değil, **prompt mimarisi + çıktı şeması + kaynak seçimi** ile zorlanır.

### 2.1 Tarafsızlık

- **Olgu/yorum ayrımı:** Çıktı, "ne oldu (kaynaklı, nötr)" ile "bu nasıl yorumlanıyor (kim, hangi açıdan)" kısımlarını ayrı tutar.
- **Çok kaynak:** Bir olay tek kaynağa dayanamaz; kaynaklar arası uzlaşma/çelişki açıkça belirtilir.
- **Kaynak yönelimi dengesi:** Kaynaklar `orientation` ile etiketlenir (iktidara yakın / muhalif / uluslararası / nötr). Bir kümenin yalnız tek yönelimden beslenmesi işaretlenir.
- **Nötr dil:** Yüklü/partizan ifade kullanılmaz; çıktıda "framing guard" kuralı uygulanır.

### 2.2 Çok perspektiflilik

- Her olay/senaryo en az **2–4 çerçeveyle** sunulur: "X açısından… / Y açısından…", bu çerçeveleri kimin savunduğu belirtilir.
- Senaryo üretimi her zaman **birden fazla** senaryo verir (tek bir kesin tahmin değil).

### 2.3 İleri görüşlülük (analitik kalite — partizan duruş değil)

- **Yüzey değil yapı:** Günün başlığı değil, altındaki yapısal sürükleyiciler (ekonomik, demografik, jeopolitik).
- **İkincil/üçüncül etkiler:** "Bu olursa, sonra muhtemelen şu…"
- **Tarihsel analoji & taban oran:** Senaryolar geçmiş benzer dönemlere dayandırılır.
- **Uzun ufuk:** Haftalar değil, yapısal gidişat.

> Not: "İleri görüşlü" burada **öngörü kalitesi** demektir; bir siyasi tarafı savunmak değil. Bu yüzden tarafsızlıkla çelişmez — "nereye gidiyoruz" görüsü, tarafgirlik değil.

### 2.4 Dürüstlük (zekânın bir parçası)

- Açık belirsizlik: olasılık + güven seviyesi + **kör noktalar**.
- Kalibrasyon döngüsü (Brier) ile "geçmişte ne kadar isabetliydim" ölçülür.

### 2.5 İç + dış

Her ülke analizi iki boyutu kapsar: **iç** (siyaset, ekonomi, toplum) ve **dış** (ilişkiler, bölgesel/küresel).

### 2.6 Doktrinin somut çıktısı — analiz şeması

```json
{
  "country": "TR",
  "as_of": "2026-06-18T09:00:00Z",
  "domestic": {
    "facts": ["kaynaklı, nötr olgular"],
    "framings": [{ "perspective": "...", "held_by": "...", "claim": "..." }],
    "drivers": ["yapısal sürükleyiciler"],
    "scenarios": [{
      "description": "...",
      "probability": 0.42,
      "confidence": "orta",
      "horizon": "3 ay",
      "second_order": ["..."],
      "historical_analogy": "..."
    }],
    "blind_spots": ["belirsizlik kaynakları / bilinmeyenler"]
  },
  "foreign": { "...": "aynı şema, ilişki odaklı" },
  "sources": [{ "title": "...", "url": "...", "orientation": "muhalif" }]
}
```

### 2.7 Doktrin sistem-prompt'unun özü (LLM'e dayatılan kurallar)

- Olguyu yorumdan ayır; mümkünse her iddiaya **≥2 kaynak**.
- **≥2 çerçeve** sun, her birini kim savunuyor belirt.
- Senaryoları **olasılık + güven** ile ver; belirsizliği gizleme.
- Yapısal sürükleyicileri ve **ikincil etkileri** belirt; tarihsel analoji ekle.
- **Nötr dil**; partizan pozisyon alma.
- Kendi **kör noktalarını** açıkça yaz.

(Opsiyonel ikinci geçiş: "devil's advocate" — üretilen analize karşı argüman ürettirip dengeyi denetlemek.)

---

## 3. Kullanıcı Rolleri

| Rol | Yetki | Neden |
|-----|-------|-------|
| **Ziyaretçi (anon)** | Küre + kümelenmiş haber akışı + **cache'li** son analiz | AI anahtarı yok; sadece hazır/önbellekli içerik görür |
| **Kayıtlı kullanıcı** | Kendi BYOK anahtarıyla canlı analiz/senaryo, ülke takibi, alarm | Asıl ürün; anahtar kullanıcıya bağlı |
| **Admin** | Kaynak yönetimi, kaynak yönelimi etiketleme, küme moderasyonu | İçerik kalitesi + tarafsızlık denetimi |

Auth, BYOK'tan **önce** gelir (anahtar kullanıcıya bağlıdır).

---

## 4. LLM Katmanı — BYOK Çok Sağlayıcılı

### 4.1 İlke

Uygulama hiçbir LLM anahtarı gömmez. Her kullanıcı kendi anahtarını getirir: **OpenAI (ChatGPT) · Anthropic (Claude) · Google (Gemini) · Moonshot (Kimi)**. Üretken işler (özet, analiz, senaryo) bu anahtarla yapılır.

### 4.2 Sağlayıcı soyutlaması

NestJS'te tek bir arayüz; her sağlayıcı için implementasyon:

```ts
interface LlmProvider {
  summarize(input): Promise<string>;
  analyze(input): Promise<AnalysisResult>;   // §2.6 şeması
  // embed YOK — embedding uygulama tarafında (bkz. 4.4)
}
```

- Bir **router/factory** kullanıcının seçtiği sağlayıcıyı seçer; istek/yanıt sağlayıcılar arası normalize edilir.
- **Kimi (Moonshot)** ve **OpenAI** OpenAI-uyumlu; aynı istemci farklı `baseURL` ile. Gemini ve Anthropic kendi SDK'leri (veya OpenAI-uyumlu uçları).
- Kullanıcı model de seçebilir (sağlayıcının güncel modelleri).

### 4.3 Anahtar güvenliği

- **Şifreli saklama:** Master key (KMS veya güçlü env anahtarı, repo'da değil) ile her kullanıcının anahtarı **AES-256-GCM** ile şifrelenir. DB'de yalnız ciphertext + IV + auth tag + key_version durur.
- **Asla:** düz metin saklanmaz, loglanmaz, frontend'e dönmez. Arayüzde maskeli (`sk-…abcd`), write-only alan.
- **Doğrulama:** Anahtar kaydedilmeden önce ucuz bir "test" çağrısıyla geçerliliği kontrol edilir.
- **Yaşam döngüsü:** Anahtar yalnız çağrı anında bellekte çözülür; rotasyon (yeni key_version ile yeniden şifreleme) ve kullanıcı tarafından silme desteklenir.

### 4.4 Embedding neden BYOK değil

Anthropic ve Kimi first-party embedding sunmuyor. Kümelemeyi kullanıcının anahtarına bağlamak pipeline'ı kırardı. Çözüm: **self-hosted çok dilli embedding** (örn. `multilingual-e5`, ONNX/transformers.js veya küçük bir Python servis — VoiceTask'taki ayrı servis kalıbı). Böylece kümeleme **anahtarsız** ve her zaman çalışır.

### 4.5 UX sonucu

Anon kullanıcı son **önbellekli** analizi görür; **taze** analiz/senaryo için kullanıcının kendi anahtarını eklemesi gerekir. Maliyet kullanıcıya ait → uygulamanın LLM gideri ~sıfır.

---

## 5. 3D Dünya Arayüzü

- **Kütüphane:** `react-globe.gl` (Three.js). Next.js'te `dynamic(..., { ssr: false })` ile sadece istemcide yüklenir (Three.js client-only).
- **Görünüm:** Dokulu Dünya (gündüz/gece), yıldız arka planı, **otomatik rotasyon** ("uzaktan uzayda dönen"). Etkileşimde durur, boşta tekrar döner.
- **Ülke katmanı:** Natural Earth GeoJSON poligonları, seçilebilir. İstenirse poligonlar ülke gündem/gerilim endeksine göre renklenir.
- **Seçim davranışı:** Ülkeye tıkla → poligon vurgulanır, küre `pointOfView` ile o ülkeye döner/yaklaşır, konumuna marker/ring düşer ("konumu dünyada gözüksün") → analiz paneli açılır.
- **Varsayılan:** Açılışta Türkiye seçili/vurgulu.
- **Türkiye derinliği:** Türkiye seçiliyken il bazlı bir alt katman (81 il) açılabilir.

---

## 6. Akışlar & State Machine

**İçerik:** `fetched → normalized → [duplicate?] → merged | clustered → enriched → published | discarded` (dedup: URL hash + pgvector benzerliği; zenginleştirme **küme bazında**).

**Tahmin:** `generated → active → resolved (correct/incorrect/partial) → scored (Brier)`. Her senaryo `resolve_at` ile doğar.

**Gerçek zamanlı:** `BullMQ repeatable job → fetch → process → enrich → DB → yeni küme → WebSocket/SSE push → küre/feed güncellenir`.

**Analiz (BYOK):** `kullanıcı ülke seçer → ilgili kümeler + profil toplanır → kullanıcının sağlayıcısıyla doktrin prompt'u çalışır → §2.6 şeması → panel + (ops.) önbelleğe`.

---

## 7. Ekranlar

1. **Ana ekran — 3D Dünya:** Dönen küre, ülke seç, konum vurgusu. Üstte seçili ülkenin kısa gündem özeti.
2. **Ülke analiz paneli:** İç + dış sekmeleri; her biri olgular / çerçeveler / sürükleyiciler / senaryolar (olasılık+güven) / kör noktalar; kaynaklar (yönelim etiketli).
3. **Türkiye derinlik (il):** 81 il katmanı, il bazlı gündem.
4. **Konu/küme detayı:** Zaman çizgisi, ilgili haberler, çok perspektifli analiz.
5. **Tahmin & Kalibrasyon:** Aktif senaryolar + Brier/isabet geçmişi.
6. **Ayarlar — AI Sağlayıcı (BYOK):** Sağlayıcı seç (OpenAI/Claude/Gemini/Kimi), anahtar gir (maskeli), model seç, "bağlantıyı test et", sil/rotasyon.
7. **Hesap:** Giriş/kayıt, takip, alarm.
8. **Admin:** Kaynak CRUD + **kaynak yönelimi etiketleme**, küme moderasyonu.

---

## 8. Backend Mimarisi (NestJS)

Modüler monolit + ayrı worker süreçleri (mikroservis değil; solo geliştirici, ölçek gelince worker'lar zaten ayrı).

**Modüller:** Ingestion (RSS/GDELT fetcher, BullMQ) · Processing (normalize, dedup, kümeleme) · **Embedding** (self-hosted servis istemcisi) · Enrichment (özet/konu/duygu/coğrafya) · **Llm** (BYOK sağlayıcı soyutlaması + router) · Analysis (doktrin prompt'u, senaryo, kalibrasyon) · Geo (ülke + Türkiye il etiketleme) · Feed (cache'li okuma API) · Realtime (WS/SSE) · Relations (ülke profili + ilişki) · Auth (JWT RS256) · Credentials (şifreli anahtar yönetimi) · Admin.

**Süreç ayrımı:** Stateless API (okuma + auth + push, yatay ölçek) · Worker (fetch/process/enrich) · Redis (kuyruk + cache + oran sınırlama) · Embedding servisi (ayrı, anahtarsız).

---

## 9. Veri Modeli (PostgreSQL — değişen/yeni tablolar)

> v0.1'deki `sources, articles, article_embeddings, clusters, article_clusters, topics, users, user_follows` korunur. Aşağıdakiler **yeni/değişen**: ülke merkezli hale getirme + BYOK + analiz çıktısı.

```sql
-- Ülke (artık analizin merkezi)
CREATE TABLE countries (
  id       BIGSERIAL PRIMARY KEY,
  iso2     TEXT UNIQUE NOT NULL,
  name     TEXT NOT NULL,
  lat      DOUBLE PRECISION,
  lng      DOUBLE PRECISION,
  region   TEXT,
  profile  JSONB                      -- tarih/din/milliyet/demografi (Wikidata seed)
);

-- Küme artık ülkeye (ve Türkiye için ile) bağlanır
CREATE TABLE cluster_countries (
  cluster_id  BIGINT REFERENCES clusters(id),
  country_id  BIGINT REFERENCES countries(id),
  confidence  REAL,
  PRIMARY KEY (cluster_id, country_id)
);

-- (Türkiye il katmanı v0.1'deki provinces + cluster_provinces ile)

-- Kaynak yönelimi (tarafsızlık dengesi için)
ALTER TABLE sources ADD COLUMN orientation TEXT;  -- 'iktidar'|'muhalefet'|'uluslararasi'|'notr'

-- Gündem/gerilim endeksi (ülke; Türkiye için province_id)
CREATE TABLE agenda_scores (
  id          BIGSERIAL PRIMARY KEY,
  country_id  BIGINT REFERENCES countries(id),
  province_id INT,                    -- NULL = ülke geneli (TR detayında dolu)
  date        DATE NOT NULL,
  score       REAL NOT NULL,          -- 0..100
  components  JSONB,
  UNIQUE (country_id, province_id, date)
);

-- BYOK: kullanıcı LLM kimlik bilgileri (ŞİFRELİ)
CREATE TABLE user_llm_credentials (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT REFERENCES users(id) ON DELETE CASCADE,
  provider     TEXT NOT NULL,         -- 'openai'|'anthropic'|'gemini'|'kimi'
  model        TEXT,
  key_cipher   BYTEA NOT NULL,        -- AES-256-GCM ciphertext
  key_iv       BYTEA NOT NULL,
  key_tag      BYTEA NOT NULL,
  key_version  INT NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, provider)
);

-- Analiz çıktısı (doktrin şeması, §2.6)
CREATE TABLE analyses (
  id          BIGSERIAL PRIMARY KEY,
  country_id  BIGINT REFERENCES countries(id),
  scope       TEXT,                   -- 'domestic'|'foreign'|'both'
  result      JSONB NOT NULL,         -- facts/framings/drivers/scenarios/blind_spots
  provider    TEXT,                   -- hangi sağlayıcı üretti
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Tahmin + kalibrasyon (ülke bazlı)
CREATE TABLE predictions (
  id           BIGSERIAL PRIMARY KEY,
  country_id   BIGINT REFERENCES countries(id),
  scope        TEXT,                  -- 'domestic'|'foreign'
  question     TEXT NOT NULL,
  probability  REAL,
  confidence   TEXT,
  rationale    TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  resolve_at   TIMESTAMPTZ,
  resolved     BOOLEAN DEFAULT FALSE,
  outcome      BOOLEAN,
  brier        REAL
);

-- İlişkiler (ülke çifti, çok boyut)
CREATE TABLE relations (
  id          BIGSERIAL PRIMARY KEY,
  a_country   BIGINT REFERENCES countries(id),
  b_country   BIGINT REFERENCES countries(id),
  dimension   TEXT,                   -- 'siyasi'|'ekonomik'|'dini'|'tarihi'|'kulturel'
  status      TEXT,
  summary     TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

---

## 10. API + JSON

```
# Küre & ülke
GET  /api/globe/countries                 → poligon endeks verisi (renklendirme)
GET  /api/countries/:iso2                  → profil + konum + son gündem
GET  /api/countries/:iso2/analysis?scope=both   → §2.6 analiz (cache veya BYOK ile taze)
GET  /api/countries/:iso2/predictions?status=active
GET  /api/predictions/calibration          → Brier/isabet
GET  /api/turkey/provinces?date=           → TR il katmanı (pilot derinlik)
GET  /api/clusters/:id

# BYOK
GET    /api/me/llm                         → kayıtlı sağlayıcılar (maskeli)
POST   /api/me/llm   { provider, model, apiKey }   → doğrula + şifreli kaydet
POST   /api/me/llm/test
DELETE /api/me/llm/:provider

# Auth / takip
POST /api/auth/register · /login · /refresh
GET/POST/DELETE /api/follows

# Admin
GET/POST/PUT/DELETE /api/admin/sources     (orientation dahil)
POST /api/admin/clusters/:id/merge

# Realtime
WS   /ws/feed
```

**Analiz isteği (BYOK ile taze) — yanıt:** §2.6'daki şema.

---

## 11. Güvenlik

- **BYOK anahtarları:** AES-256-GCM + master key (KMS/env, repo'da değil); düz metin saklanmaz/loglanmaz/geri dönmez; maskeli gösterim; doğrulama + rotasyon + silme.
- **Parola:** Argon2id. **JWT:** RS256, kısa access + refresh rotasyonu.
- **SQL injection:** Ham SQL → **her sorgu parametrize**; repository katmanında zorunlu.
- **Girdi doğrulama:** DTO + class-validator/zod, whitelist.
- **Oran sınırlama:** `@nestjs/throttler` + Redis; özellikle AI tetikleyen yollar (kullanıcının faturasını da korur).
- **Sırlar:** env/secret manager; **hardcoded secret yasak** (geçmiş audit bulgularının tekrarı olmasın).
- **HTTP:** helmet, sıkı CORS.
- **İçerik & LLM:** scraped HTML sanitize; LLM'e verilen metinde **prompt injection** farkındalığı (kaynak metni talimat sanma).
- **Tarafsızlık güvenliği:** kaynak yönelim dengesi izlenir; tek-yönelim beslenen kümeler işaretlenir.
- **Hukuki:** kaynak ToS/robots'a saygı, haber atıf + linki.

---

## 12. MVP Fazlama (yeniden sıralı)

| Sprint | Kapsam | "Bitti" |
|--------|--------|---------|
| **S0 — İskelet** | Nest+Next+PG+Redis; repository pattern; migration; 1 RSS → DB | Tek kaynaktan haber DB'de |
| **S1 — 3D Dünya** | `react-globe.gl`, uzayda dönen küre, ülke seç + konum vurgu + ülkeye dön; Türkiye varsayılan | Küre dönüyor, ülke seçilip vurgulanıyor |
| **S2 — Auth** | users, JWT (RS256), kayıt/giriş | Hesap açılıyor (BYOK'un ön koşulu) |
| **S3 — BYOK LLM** | Sağlayıcı soyutlaması (OpenAI/Claude/Gemini/Kimi), şifreli anahtar, ayarlar UI, test; self-hosted embedding servisi | Kullanıcı anahtar ekliyor; embedding anahtarsız çalışıyor |
| **S4 — Ingest + kümeleme** | Çoklu RSS + GDELT; dedup + pgvector kümeleme; ülke (ve TR il) etiketleme; küme bazlı özet | Ülke seçince güncel kümeler + özet geliyor |
| **S5 — Analiz doktrini** | Doktrin prompt mimarisi + §2.6 şeması; iç+dış; çok perspektif + nötr dil + kör noktalar | Ülke için tarafsız, çok çerçeveli analiz üretiliyor |
| **S6 — Tahmin + kalibrasyon** | Senaryo üretimi (olasılık+güven), resolve/Brier; TR il derinliği | Senaryolar + isabet geçmişi |
| **S7 — Realtime + kullanıcı** | WS/SSE canlı push; takip/alarm; cilalama | Yeni olay anında küreye/feed'e düşüyor |
| **Sonra** | TimesFM ile nicel tahmin; ilişki ağı görselleştirme; tüm dünya derinliği | — |

İlk görünür "wow": **S1 + S4** (dönen küre + canlı kümelenmiş gündem). Analiz/senaryo onun üstüne biner.

---

## 13. Teknoloji Yığını

**Frontend (Next.js, App Router):** `react-globe.gl` (Three.js, `ssr:false`), Natural Earth GeoJSON; React Query; WebSocket/SSE.
**Backend (NestJS):** BullMQ + Redis; `pg`/`postgres.js` + custom repository (Prisma yok); `node-pg-migrate`.
**LLM (BYOK):** OpenAI/Kimi (OpenAI-uyumlu), Gemini, Anthropic — sağlayıcı soyutlaması arkasında.
**Embedding (anahtarsız):** self-hosted çok dilli model (`multilingual-e5`; Türkçe sondan-eklemeli morfoloji için çok dilli model şart).
**Veri:** RSS (`rss-parser`), GDELT (DOC 2.0 API), Wikidata (ülke profili). Sonra Ekşi/Twitter.
**Altyapı:** Hetzner + Docker; BullMQ board; sağlık uçları.

---

## 14. Production Hazırlığı

- İdempotent ingest (`url_hash`).
- Maliyet: özet/analiz **küme bazında**; BYOK olduğu için gider kullanıcıda ama yine de kullanıcı başına throttle.
- Cache: küre/ülke özetleri Redis'te; anon trafiği LLM'e indirme.
- DB: `published_at`, `country_id` indeksleri; embedding için HNSW.
- Gözlemlenebilirlik: yapısal log (anahtarlar **asla** loglanmaz), hata izleme, fetch/queue metrikleri.
- Graceful degradation: kaynak/sağlayıcı düşerse ayakta kal; son iyi (cache) analizi göster.
- Tahmin disiplini: `resolve_at`'siz senaryo yayınlanmaz (kalibrasyon anlamlı olsun).
- Yedekleme: düzenli PG yedeği (şifreli anahtar tablosu dahil — master key ayrı saklanır).

---

## Sonraki Adım

İlk somut iş **S1 (dönen 3D küre + ülke seçimi)**. `react-globe.gl` ile küreyi kurup Türkiye'yi varsayılan seçili + konum vurgulu hale getiren iskeleti uçtan uca çıkarırız. Alternatif: önce **S2+S3 (auth + BYOK + şifreli anahtar)** omurgasını dikip AI tarafını sağlama almak.

**Uygulama durumu:** S0 (monorepo iskeleti) + S1 (3D küre) bu repoda kuruldu. Sonraki sprintler S2→S7 olarak ilerleyecek.
