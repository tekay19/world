# Tahmin & Kalibrasyon — Uygulama Planı

> Amaç: "kâhin" değil; **iyi kalibre olmuş, kanıta dayalı, belirsizliğine dürüst ve
> naif taban-orandan ölçülebilir biçimde daha iyi** bir tahmin sistemi.
> Tek sihir yok — sihir **süreç + geri bildirim** döngüsünde.
>
> Bu doküman **kod içermez**; sıralı, bağımlılık-farkında bir uygulama haritasıdır.
> Sprint adlandırması `SISTEM-PLANI.md` ile uyumludur (S2–S7).

## Mevcut durumun envanteri (neyin üstüne kuruyoruz)

Şema şaşırtıcı derecede hazır — `0001_init.sql` zaten kalibrasyonu öngörmüş:

| Varlık | Durum | Notu |
|---|---|---|
| `predictions` (`resolve_at`, `resolved`, `outcome`, `brier`) | **Şema var, bağlı değil** | Kalibrasyon döngüsünün veri modeli neredeyse tamam |
| `analyses` (`result` JSONB, `provider`) | Şema var | LLM analiz çıktısı; çoklu-model için `provider` kolonu mevcut |
| `clusters`, `article_embeddings` (pgvector) | Şema var (S4) | Kümeleme + RAG için temel |
| `agenda_scores`, `relations` | Şema var | Sinyal & ülke-çifti boyutu |
| BullMQ scheduler (`ingestion.scheduler.ts`) | **Çalışıyor** | Tekrarlayan iş deseni → çözümleme/yeniden-tahmin işlerine birebir uyar |
| BYOK kimlik (`credentials` modülü: openai/anthropic/gemini/kimi/nvidia…) | **Çalışıyor** | Çoklu-model panelinin altyapısı hazır |
| Keyless embedding servisi (`services/embedding`) | Var | RAG/kümeleme kullanıcı anahtarına bağlı değil |

**Sonuç:** En yüksek getirili parça (kalibrasyon döngüsü) aynı zamanda altyapısı en hazır olan
parça. Doğru başlangıç noktası bu.

---

## Faz A — Kalibrasyon döngüsü + taban oran  *(öncelik #1, "asıl sihir")*

**Bağımlılık:** Üretilmiş tahminler (S6'nın asgari hali). Tahmin üretimi henüz yoksa,
önce "tahmin üreten" minimal bir adım gerekir (analizden 3–5 çözülebilir senaryo çıkarımı).

### A1. Çözülebilir tahmin sözleşmesi
- Her tahmin **çözülebilir** doğmalı: net kriter + `resolve_at` + çözümleme yöntemi.
- `predictions`'a eklenecek alanlar: `resolution_criteria TEXT`, `resolution_source TEXT`
  (`manual` | `metric` | `llm-judge`), `metric_key TEXT` (sayısal çıpaya bağlanacaksa),
  `model TEXT`, `base_rate REAL`, `method JSONB` (taban oran + ayarlama izi).
- Kural: `resolution_criteria` ve ölçüm yöntemi olmadan tahmin **yayınlanmaz**.

### A2. Çözümleme işi (resolution job)
- BullMQ tekrarlayan iş (`ingestion.scheduler.ts` deseni): `resolve_at <= now() AND NOT resolved`
  olan tahminleri tarar.
- Çözümleme kaynakları, kademeli:
  1. `metric` → sayısal seri eşiği (Faz C'deki seriden; örn. "USD/TRY > X").
  2. `llm-judge` → kanıt (ilgili kümeler/haberler) + soru → LLM "gerçekleşti mi?" + atıf.
  3. `manual` → operatör onayı (UI'da "çözümle" kuyruğu).
- Çıktı: `outcome BOOLEAN`, `resolved=TRUE`, çözümleme kanıtı `method`'a yazılır.

### A3. Skorlama
- **Brier** = (p − outcome)²  → tahmin başına `brier` kolonuna.
- **Log skoru** (opsiyonel ek): −log(p_outcome) — uçları daha sert cezalandırır.
- Agregasyon görünümleri (materialized view veya rapor sorgusu):
  - model × konu (scope/topic) × zaman penceresi bazında ortalama Brier.
  - **Kalibrasyon eğrisi**: olasılık kovaları (0.0–0.1 … 0.9–1.0) → gerçekleşme oranı.
  - **Referans çizgileri**: taban-oran-her-zaman ve 0.5-her-zaman ile karşılaştırma
    (sistemin naiften gerçekten iyi olduğunu kanıtlamak için).

### A4. Taban oran (referans sınıfı) + ayarlama
- Tahmin üretimi "ne hissediyorsun" yerine **"benzer geçmiş durumlarda ne sıklıkta oldu"**
  ile başlar: referans sınıfı → `base_rate`. Sonra güncel kanıta göre ayarla, izi `method`'a yaz.
- Geçmiş kalibrasyona göre **güven düzeltmesi**: bir model/konuda geçmişte "%80 derken %60
  tutturuyorsa", yayınlanan olasılık aşağı çekilir (post-hoc recalibration: Platt/isotonic
  ileri aşamada; başlangıçta basit kova-bazlı düzeltme yeterli).

### A5. Uçlar & UI
- `GET /api/predictions/calibration` (model/konu/pencere filtreli skor & eğri).
- Ülke panelinde tahmin kartı: olasılık + güven aralığı + "çözüm: <tarih>" + çözümlendiğinde
  ✓/✗ ve isabet rozeti ("ekonomi tahminlerinde %72 kalibre").

**Kabul kriteri:** Geçmiş tahminler otomatik çözülüyor; model/konu başına Brier ve kalibrasyon
eğrisi raporlanıyor; sistem **taban-oran-her-zaman** çizgisini ölçülebilir biçimde geçiyor.

---

## Faz B — Çoklu-model panel + şeytanın avukatı

**Bağımlılık:** BYOK (hazır). Faz A skorlaması (ağırlıklandırma için faydalı, şart değil).

### B1. Bağımsız panel + agregasyon
- Aynı soruyu birden çok sağlayıcıya **bağımsız** sor (NVIDIA + OpenAI + Claude…).
- Olasılıkları birleştir: **medyan** (sağlam) veya **extremizing average** (bağımsız
  tahminlerin agregasyonu varyansı düşürür, kalibrasyonu artırır — bilinen sonuç).
- Faz A geçmişi varsa modelleri **kalibrasyon performansına göre ağırlıkla**.
- `analyses.provider` zaten var; tahmin başına model dökümünü `predictions.model` + bir
  `prediction_votes` tablosuyla sakla (model, p, rationale).

### B2. Şeytanın avukatı (kırmızı takım)
- Üretilen analize/tahmine karşı **karşı-tez** ürettiren ayrı bir geçiş; sonra uzlaştırma
  (reconcile). Tek modelin/anlatının kör noktasını başka model + karşı-tez kapatır.
- Çıktı: nihai olasılık + "bunu çürüten en güçlü argüman" + güncellenmiş gerekçe.

**Kabul kriteri:** Tek-model tahminine kıyasla panel agregasyonu Faz A skorlarında ölçülebilir
iyileşme; her tahminde karşı-tez kaydı görünür.

---

## Faz C — Kanıt + sayısal çıpa + dış priorlar  *(çöp girer → çöp çıkar'ı kır)*

**Bağımlılık:** S4 kümeleme/embedding'in bağlanması.

### C1. Kümeleme & denge (S4'ü bitir)
- Tekrarlı haber tek olaya insin (**hacim ≠ doğruluk**); `clusters` + `article_clusters` doldur.
- Kaynak-yönelim dengesi otomatik denetimi: tek taraftan (`orientation`) beslenen kümeyi işaretle.

### C2. RAG (pgvector)
- `article_embeddings` + geçmiş `analyses` üzerinde benzerlik araması; modele **gerçek, atıflı**
  bağlam ver ("2018'de benzer kur şoku şununla sonuçlandı").
- Anlık görüntü değil **zaman çizgisi**: olay çıkarımı + tarihleme → yön/ivme görünür.

### C3. Sayısal seriler & dış olasılık priorları
- Ölçülebilir sinyaller (kur, enflasyon, anketler, çatışma olayları) için LLM'e "his" bıraktırma
  — **gerçek seri** ver. Basit momentum/Prophet/ARIMA → ileride TimesFM.
- Dış priorlar: tahmin piyasaları & agregatörler (**Polymarket, Metaculus, Good Judgment**),
  olay veri tabanları (**GDELT/ACLED**). Model bunları çapa alır ve sapmasını **gerekçelendirir**.
- Yeni tablolar: `signals` (metric_key, ts, value, source), `external_priors` (question_ref, p, source).
- A2'deki `metric` çözümlemesi bu serilerden beslenir (döngü kapanır).

**Kabul kriteri:** Tahminler atıflı kanıta ve en az bir sayısal çıpaya dayanıyor; dış prior
mevcutsa sapma gerekçelendiriliyor.

---

## Faz D — Çok-ajanlı hat + hafıza + belirsizlik mühendisliği  *(yatay, her faza dokunur)*

**Bağımlılık:** A–C parçalarının olgunlaşması.

### D1. Hat (pipeline)
Tek prompt yerine zincir:
`araştırmacı (RAG/kanıt) → analist (§2.6 üretir) → kırmızı takım (karşı-tez) → agregatör
(çoklu-model birleştirir) → kalibratör (geçmiş Brier'a göre ayarlar)`.
- Orkestrasyon BullMQ iş zinciri olarak; her aşama izlenebilir (audit trail).

### D2. Hafıza
- Ülke başına geçmiş **tahmin + sonuç + kalibrasyon** her yeni tahmine bağlam olur.
- Haber geldikçe **yeniden-tahmin** (olasılık zamanla kayar) → güven aralığının daralması/trendi
  UI'da gösterilir.

### D3. Belirsizlik mühendisliği (baştan itibaren uygulanır)
- Tek olasılık değil **aralık**; "fikrimi ne değiştirir" (yanlışlayıcılar);
  kanıt zayıfsa **çekinme/abstain**; bilinen-bilinmeyen ayrımı.
- Skorlama aşırı güveni cezalandırır, dürüstlüğü ödüllendirir (log skoru + abstain politikası).

---

## Sıralama özeti & gerekçe

1. **Faz A (kalibrasyon + taban oran)** — neredeyse bedava, altyapısı hazır, "kâhinlik"
   hissini en çok artıran; çünkü sistemi *tahmin etmekten* çok **kendini ölçüp düzeltmeye** geçirir.
2. **Faz B (çoklu-model + şeytanın avukatı)** — ucuz, varyansı düşürür, kör nokta kapatır.
3. **Faz C (RAG + sayısal/dış veri)** — en çok mühendislik; girdi kalitesini yükseltir.
4. **Faz D (hat + hafıza + belirsizlik)** — yatay; A–C'yi tek akışta birleştirir.

## Riskler / dürüst sınırlar
- Çözülebilir kriter yazmak zordur; kötü kriter → kirli skor. Başta `manual`/`llm-judge` ağırlıklı.
- Dış kaynaklar (GDELT/ACLED/piyasalar) hız limiti/lisans gerektirir; prior olarak opsiyonel.
- LLM "his" olasılıkları sistematik aşırı-güven taşır; Faz A recalibration bunu düzeltmeden
  güven sayılarına güvenilmemeli.
- Kalibrasyon ancak yeterli **çözülmüş** tahmin biriktiğinde anlamlı (soğuk başlangıç problemi).

## İlk somut adım (onay verince)
Faz A1+A2+A3'ün dikey dilimi: `predictions` alan eklemeleri → çözümleme işi (manual + llm-judge)
→ Brier + kalibrasyon eğrisi uçları → panelde isabet rozeti. Tahmin üretimi yoksa, analizden
çözülebilir senaryo çıkaran minimal üretim adımı bu dilime dahil edilir.

---

## Uygulama durumu (kuruldu)

**Faz A dikey dilimi tamam** (+ ürün pivotu: panelde haber yok, kategori bazlı tahmin):

- **A1** `0003_predictions_calibration.sql`: `resolution_criteria/_source`, `metric_key`, `model`, `topic`,
  `base_rate`, `prob_low/high`, `method`, `analysis_id`, `resolved_at`, `log_score`, `horizon`.
- **A1/A4 üretim:** `predictions` modülü — analiz/haberden **çözülebilir tahmin** çıkarımı, referans
  sınıfı + taban oran + `method` izi. **Kategori odaklı** (siyaset/ekonomi/güvenlik/dışpol/toplum/sağlık/enerji/teknoloji).
- **A2 çözümleme:** BullMQ tekrarlayan iş (saatlik) + manuel uç; `llm-judge` (kanıtla, decidable),
  `manual` operatör kuyruğu; `metric` Faz C'ye bırakıldı.
- **A3 skorlama:** Brier + log skoru; `GET /predictions/calibration` → ortalama Brier, kalibrasyon
  eğrisi (10 kova), **naif çizgiler** (0.5-her-zaman + taban oran) ile karşılaştırma + verdict.
- **A5 UI:** kategori çipleri → tahmin kartları (olasılık + aralık + çözüm tarihi + kriter) →
  çözümlenince ✓/✗ + Brier; kalibrasyon özeti.

**Faz B tamam** (çoklu-model panel + şeytanın avukatı):

- **B1 bağımsız panel:** `getAllDecrypted` ile tüm kayıtlı sağlayıcılara aynı soru **bağımsız**
  sorulur (`buildVoteMessages`); oylar `prediction_votes`'a yazılır.
- **Agregasyon:** kalibrasyon-ağırlıklı (`brierWeight`) **logit havuzlama**; ≥3 oyda
  **extremization** (`aggregate`). `predictions.aggregation` + `model_count` + `prob_pre_devil`.
- **B2 şeytanın avukatı:** `buildDevilMessages` ile karşı-tez + (gerekirse) ayarlanmış olasılık;
  `predictions.counter_argument`.
- **Uçlar/UI:** `GET /predictions/:id/votes`; kartta agregasyon rozeti + model oyları + karşı-tez.

**Sırada:** Faz C (kümeleme/RAG + sayısal çıpa + dış priorlar) ve Faz D (çok-ajanlı hat + hafıza).
