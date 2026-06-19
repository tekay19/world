/**
 * Haber "stratejik sinyal" skoru — deterministik, LLM'siz.
 *
 * Neden: 664+ RSS kaynağından gelen ham akışın çoğu yerel/önemsiz (kaza, maç,
 * dizi, hava durumu). Bu gürültü prompt'a girince hem modeli alakasız bağ
 * kurmaya iter (kullanıcının 1. kırmızı çizgisi) hem de token bütçesini şişirip
 * çıktının kesilmesine/gecikmeye yol açar. Skor; tahmin/senaryo/sohbet girdisini
 * süzmek ve öne almak için kullanılır (articles.repository.recentWithSourceByCountry).
 *
 * Pozitif = stratejik (seçim/faiz/savaş…). Negatif = açık gürültü (kaza/maç/dizi…).
 * Nötr (0) = belirsiz; korunur ama önceliklenmez. Bu YETKİLİ skorlayıcıdır;
 * 0016 migration'daki SQL geri-doldurma yalnızca tek-seferlik yaklaşıktır.
 */

// Ülkenin GELECEĞİNİ etkileyen, manşet-düzeyi konular. (tr-TR küçük harf.)
const STRATEGIC = [
  // Siyaset / kurumlar
  'seçim',
  'sandık',
  'anayasa',
  'kabine',
  'cumhurbaşkan',
  'başbakan',
  'meclis',
  'koalisyon',
  'muhalefet',
  'iktidar',
  'ittifak',
  'referandum',
  'darbe',
  'istifa',
  'mahkeme',
  // Yargısal-siyasi (siyasetçiye/kuruma yönelik hukuki süreç = stratejik).
  // NOT: kaza/cinayet gibi asayiş zaten NOISE'ta; "kaza soruşturması" net negatif kalır.
  'tutukl', // tutuklama/tutuklandı/tutuklu
  'gözaltı',
  'soruşturma',
  'iddianame',
  'yargı', // yargıtay/yargılama
  'dava',
  'beraat',
  'dokunulmazlık',
  'kayyum',
  'kayyım',
  'fezleke',
  'siyasi yasak',
  // Ekonomi
  'enflasyon',
  'faiz',
  'merkez bankas',
  'dolar',
  'euro',
  'resesyon',
  'büyüme',
  'bütçe',
  'asgari ücret',
  'tahvil',
  'borsa',
  'devalüasyon',
  'kredi notu',
  'cari açık',
  'işsizlik',
  // Dış politika / güvenlik
  'savaş',
  'çatışma',
  'operasyon',
  'saldırı',
  'ateşkes',
  'yaptırım',
  'müzakere',
  'diplomasi',
  'füze',
  'ordu',
  'nato',
  'sınır',
  'işgal',
  'soykırım',
  'nükleer',
  'terör',
  'suikast',
  // Toplum (büyük)
  'protesto',
  'grev',
  'olağanüstü hal',
  // Kısa/ikircikli (tam kelime eşleşir):
  'kur',
  'zam',
  'imf',
];

// Açıkça düşük-sinyal: asayiş, spor, magazin, yaşam, niş. (tr-TR küçük harf.)
const NOISE = [
  // Asayiş / yerel
  'kaza',
  'yangın',
  'cinayet',
  'hırsız',
  'dolandırıcı',
  'yaralandı',
  'hayatını kaybetti',
  'ölü bulundu',
  // Spor
  'transfer',
  'şampiyon',
  'fikstür',
  'galibiyet',
  'mağlubiyet',
  'derbi',
  'teknik direktör',
  'penaltı',
  // Magazin / hafif kültür
  'magazin',
  'oyuncu',
  'şarkıcı',
  'konser',
  'evlilik',
  'boşanma',
  'sevgili',
  // Hava / yaşam / niş
  'hava durumu',
  'sıcaklık',
  'yağış',
  'meteoroloji',
  'burç',
  'astroloji',
  'tarif',
  'festival',
  'kruvaziyer',
  'turist',
  'sergi',
  // Kısa/ikircikli (tam kelime eşleşir):
  'maç',
  'gol',
  'lig',
  'dizi',
  'film',
];

/** country-tagging ile aynı normalizasyon: kenar boşluklu, tr-TR küçük harf, alfanümerik. */
function normalize(value: string): string {
  return ` ${value
    .normalize('NFKC')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

/**
 * Eşleşme: uzun (≥4) terimler ALT-DİZİ (çekim eklerini yakalar: "enflasyonu",
 * "seçimler"); kısa (≤3) terimler TAM KELİME ("maç" → "amaç"/"ihtiyaç" yanlış
 * eşleşmesini önler). Her listede en çok 5 vuruş sayılır (tek haber baskınlaşmasın).
 */
function hits(norm: string, words: string[]): number {
  let n = 0;
  for (const w of words) {
    const hit = w.length <= 3 ? norm.includes(` ${w} `) : norm.includes(w);
    if (hit && ++n >= 5) break;
  }
  return n;
}

/**
 * Stratejik vuruş +2, gürültü vuruşu −4. Gürültü ağırlığı stratejikten yüksek:
 * yargısal terimler (soruşturma/gözaltı) hem siyasi hem asayiş haberinde geçtiğinden,
 * asayiş ismi (kaza/cinayet) varsa net pozitife çıkmasın → "trafik kazası
 * soruşturması" ≤0 (asayiş) kalırken "siyasi yasak/tutuklama" (asayiş ismi yok) pozitif.
 */
export function scoreSignal(text: string): number {
  if (!text) return 0;
  const norm = normalize(text);
  return hits(norm, STRATEGIC) * 2 - hits(norm, NOISE) * 4;
}
