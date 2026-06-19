# Dünya Analiz — Gelecek Tahmin & Analiz Sistemi

Uzayda dönen 3D Dünya üzerinde bir ülkeye tıkla; o ülkenin iç ve dış gündemini kaynaklı, tarafsız, çok perspektifli ve ileri görüşlü bir analizle gör. Türkiye pilot ülke.

> Tam sistem planı: [`SISTEM-PLANI.md`](./SISTEM-PLANI.md). Bu repo **S0 (iskelet)** ve **S1 (3D küre)** sprint'lerini içerir; S2–S7 sonraki adımlar.

## Mimari

```
.
├── apps/
│   ├── api/            NestJS modüler monolit + ayrı worker/scheduler süreçleri
│   │   ├── migrations/ SQL şema + ülke/il seed (bağımlılıksız koşucu)
│   │   └── src/modules/ countries · globe · feed · ingestion · content · health
│   └── web/            Next.js (App Router) + react-globe.gl (dönen 3D küre)
├── packages/
│   └── contracts/      API ve web tarafından ortak kullanılan TypeScript sözleşmeleri
├── services/
│   └── embedding/      Anahtarsız self-hosted çok dilli embedding (FastAPI, S3'te aktif)
└── docker-compose.yml  PostgreSQL (pgvector) + Redis [+ embedding, profile: ai]
```

## Önkoşullar

- Node.js ≥ 20
- Docker + Docker Compose (PostgreSQL & Redis için)

## Hızlı başlangıç

```bash
# 1) Ortam değişkenleri
cp .env.example .env
#    (opsiyonel — BYOK master key, S3 için):  openssl rand -base64 32  →  LLM_MASTER_KEY

# 2) Bağımlılıklar (npm workspaces)
npm install

# 3) Altyapı: Postgres (pgvector) + Redis
npm run infra:up

# 4) Şema + seed (40+ ülke, Türkiye'nin 81 ili, örnek kaynaklar)
npm run db:migrate

# 5) API + Worker + Scheduler + Web (paralel)
npm run dev
#    API → http://localhost:4000/api
#    Web → http://localhost:3000   (açılışta Türkiye seçili + konum halkası)
```

İlk haberleri çekmek için (BullMQ işini hemen tetikler):

```bash
curl -X POST http://localhost:4000/api/ingestion/run
```

## Mevcut API uçları (S0 + S1)

| Uç | Açıklama |
|----|----------|
| `POST /api/auth/register` | İlk hesap mevcut yerel veriyi devralır ve admin olur |
| `POST /api/auth/login` | Kısa ömürlü bearer token üretir |
| `GET /api/auth/me` | Oturum kullanıcısı |
| `GET /api/health` | Sağlık + DB durumu |
| `GET /api/globe/countries` | Küre renklendirmesi (ülke + gündem endeksi) |
| `GET /api/countries/:iso2` | Profil + konum + gündem endeksi (haber listesi yok) |
| `GET /api/countries/:iso2/predictions` | Aktif (çözülmemiş) tahminler |
| `POST /api/countries/:iso2/predictions/generate` | Kategori bazlı **gelecek tahmini üret** |
| `GET /api/predictions/calibration` | Brier + kalibrasyon eğrisi + naif çizgiler |
| `GET /api/predictions/:id/votes` | Panel model oyları (çoklu-model) |
| `POST /api/predictions/:id/resolve` | Manuel çözümleme (oldu/olmadı) |
| `POST /api/predictions/resolve-run` | Vadesi gelenleri hemen çözümle (dev/admin) |
| `GET /api/turkey/provinces` | Türkiye 81 il katmanı |
| `POST /api/ingestion/run` | Haber çekimini kuyruğa al (arka plan) |
| `POST /api/countries/:iso2/analyze` | Doktrin §2.6 analiz motoru (tahminleri besler) |
| `GET /api/countries/:iso2/analysis` | Oturum kullanıcısının son doktrin analizi |
| `GET /api/me/llm/providers` | Seçilebilir sağlayıcılar + varsayılan modeller |
| `GET /api/me/llm` | Kayıtlı sağlayıcılar (maskeli) |
| `POST /api/me/llm/models` | Sağlayıcının **canlı** model kataloğu (anahtarla) |
| `POST /api/me/llm/test` | Bağlantı testi |
| `POST /api/me/llm` | Anahtarı doğrula + AES-256-GCM ile şifreli kaydet |
| `DELETE /api/me/llm/:provider` | Anahtarı sil |

## BYOK — AI sağlayıcı (NVIDIA dahil)

Uygulama hiçbir LLM anahtarı gömmez; kendi anahtarını getirirsin. Desteklenen: **OpenAI · Anthropic (Claude) · Google (Gemini) · Moonshot (Kimi) · NVIDIA NIM**.

NVIDIA ile kullanım:

1. Web arayüzünde sağ üstten **⚙ AI Sağlayıcı**'yı aç.
2. Sağlayıcı: **NVIDIA NIM**. Anahtar: [build.nvidia.com](https://build.nvidia.com)'dan `nvapi-…`.
3. **Modelleri getir** → NVIDIA'nın **canlı kataloğundan** model seç (varsayılan `meta/llama-3.1-405b-instruct`).
4. **Bağlantıyı test et** → **Kaydet** (anahtar AES-256-GCM ile şifreli saklanır; düz metin asla dönmez/loglanmaz).
5. Bir ülke seç → panelde bir **kategori** seç (Siyaset, Ekonomi, Güvenlik & Savaş, Sağlık…) → **✨ Tahmin üret**. Uygulama arka plandaki haberlerden o kategoriye dair **çözülebilir gelecek tahminleri** (olasılık + güven aralığı + çözüm tarihi + taban oran) üretir; vade gelince çözülüp **Brier ile kalibre** edilir.

> NVIDIA OpenAI-uyumlu (`https://integrate.api.nvidia.com/v1`); aynı soyutlama OpenAI/Kimi/Gemini'yi de kapsar, Claude kendi API'siyle.
> Kümeleme/embedding kullanıcının anahtarına **bağlı değildir** — her zaman çalışır.
>
> İlk kayıtta daha önceki yerel kullanıcı hesabı güvenli biçimde devralınır; kayıtlı BYOK anahtarları korunur. Sonraki hesaplar standart kullanıcı rolüyle açılır. Silme, manuel çözümleme ve ingestion tetikleri yalnız admin rolündedir.

## Sprint durumu

- ✅ **S0 — İskelet:** Monorepo, PG+Redis, repository pattern, migration, RSS → DB.
- ✅ **S1 — 3D Dünya:** Dönen küre, ülke seçimi + konum vurgusu, Türkiye varsayılan, analiz paneli.
- 🟡 **S3 — BYOK LLM:** Sağlayıcı soyutlaması (OpenAI/Claude/Gemini/Kimi/**NVIDIA**), AES-256-GCM şifreli anahtar, ayarlar UI, canlı model listesi, bağlantı testi. (Embedding servis iskeleti hazır; pipeline'a bağlama S4.)
- 🟡 **S5 — Analiz doktrini:** Doktrin prompt mimarisi + §2.6 şeması + canlı üretim (BYOK ile). Tahminleri besleyen motor; panelde gösterilmiyor.
- 🟡 **S6 — Tahmin + kalibrasyon (Faz A):** Kategori bazlı çözülebilir tahmin üretimi (taban oran dahil), tekrarlayan çözümleme işi (manuel + llm-judge), Brier/log skoru + kalibrasyon eğrisi + naif referans çizgileri. Panel: kategori çipleri + tahmin kartları + kalibrasyon özeti.
- 🟡 **Faz B — Çoklu-model panel + şeytanın avukatı:** Aynı soru tüm kayıtlı sağlayıcılara **bağımsız** sorulur; olasılıklar **kalibrasyon-ağırlıklı logit havuzlama** (≥3 oyda extremization) ile birleşir; ayrı bir **karşı-tez** geçişi nihai olasılığı ayarlar. Panelde: agregasyon rozeti, model oyları, karşı-tez.
- ✅ **S2 — Auth:** İmzalı kısa ömürlü bearer token, scrypt parola özeti, kullanıcıya bağlı BYOK ve admin politikaları.
- 🟡 **S4 — Kümeleme + RAG:** pgvector ve makale düzeyi `article_countries` ülke etiketleme aktif; daha gelişmiş NER/GDELT zenginleştirmesi sonraki adım.
- ⏭️ **S7 — Realtime**.

> Not: Sağ panelde **haber akışı gösterilmez** — yalnız kategoriler ve gelecek tahminleri. Haberler arka planda (ingest → tahmin üretimi) kullanılır.

## Güvenlik notları

- `.env` ve `*.pem` **asla** kommitlenmez (bkz. `.gitignore`).
- BYOK anahtarları (S3) AES-256-GCM ile şifrelenir; master key repo dışında tutulur, düz metin saklanmaz/loglanmaz.
- Tüm DB sorguları **parametrize** (SQL injection koruması). Tablo adları yalnız sabit sınıf alanlarından gelir.
- HTTP'de `helmet` + sıkı CORS (`CORS_ORIGINS`).
- Tüm API uçları varsayılan olarak kimlik doğrulama ister; yalnız kayıt/giriş public'tir. Global throttling bütün uçlarda etkindir.

## Çalışma zamanı süreçleri

- `npm run start -w @dunya/api`: yalnız HTTP API.
- `npm run start:worker -w @dunya/api`: BullMQ processor'ları.
- `npm run start:scheduler -w @dunya/api`: repeatable job kayıtları; tek replika çalıştırılmalıdır.

Her süreç rolüne göre ayrı PostgreSQL havuzu kullanır. `PROCESS_REPLICA_COUNT`
süreç başına payı otomatik küçültür; dağıtım bazında açık sınır gerekiyorsa
`PG_POOL_MAX` kullanılır. Yüksek replika sayılarında PgBouncer önerilir.

## Otomatik kontroller

- `npm run lint`: API ve web için strict TypeScript + kullanılmayan kod denetimi.
- `npm test`: auth, süreç sınırı, ülke etiketleme, analiz kalıcılığı ve atomik job claim testleri.
- `npm run build`: NestJS ve Next.js üretim derlemeleri.

## Notlar

- Küre poligonları Natural Earth GeoJSON'dan (CDN) yüklenir; `react-globe.gl` yalnız istemcide (`ssr:false`).
- Earth/yıldız dokuları `three-globe` örnek varlıklarından (CDN) gelir.
- Embedding servisi kullanıcının LLM anahtarına **bağlı değildir** (kümeleme her zaman çalışır): `docker compose --profile ai up embedding`.
