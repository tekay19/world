/**
 * 500+ haber kaynağı kataloğu (RSS).
 *
 * İki kaynaktan derlenir:
 *  1) CURATED — bilinen büyük yayın kuruluşlarının gerçek RSS beslemeleri
 *     (çoğu birden çok kategori beslemesiyle).
 *  2) Google Haberler — ülke + dil etiketli "top stories" ve konu beslemeleri.
 *     Bu uygulamanın "ülkeye tıkla → o ülkenin gündemi" akışı için idealdir
 *     çünkü her besleme tek bir ülkeye ait ve country_iso2 ile etiketlenir.
 *
 * Çekim idempotent ve hata-toleranslıdır (ölü besleme atlanır), bu yüzden
 * liste geniş tutulur; ulaşılamayan birkaç besleme sistemi bozmaz.
 */

export interface SeedSource {
  name: string;
  homepage: string | null;
  feedUrl: string;
  kind: string; // 'rss'
  orientation: string | null; // 'iktidar'|'muhalefet'|'uluslararasi'|'notr'
  lang: string;
  countryIso2: string | null;
}

const rss = (
  name: string,
  homepage: string | null,
  feedUrl: string,
  lang: string,
  countryIso2: string | null,
  orientation: string | null = 'notr',
): SeedSource => ({
  name,
  homepage,
  feedUrl,
  kind: 'rss',
  orientation,
  lang,
  countryIso2,
});

// ---------------------------------------------------------------------------
// 1) Google Haberler — ülke/dil bazlı beslemeler
// ---------------------------------------------------------------------------
interface GNewsLocale {
  iso2: string;
  label: string; // ülke adı (TR)
  hl: string; // arayüz dili (örn. tr, en-GB)
  gl: string; // coğrafi konum (örn. TR, GB)
  ceid: string; // ceid dil kodu (örn. tr, en)
}

const GNEWS_LOCALES: GNewsLocale[] = [
  { iso2: 'TR', label: 'Türkiye', hl: 'tr', gl: 'TR', ceid: 'tr' },
  { iso2: 'US', label: 'ABD', hl: 'en-US', gl: 'US', ceid: 'en' },
  { iso2: 'GB', label: 'Birleşik Krallık', hl: 'en-GB', gl: 'GB', ceid: 'en' },
  { iso2: 'DE', label: 'Almanya', hl: 'de', gl: 'DE', ceid: 'de' },
  { iso2: 'FR', label: 'Fransa', hl: 'fr', gl: 'FR', ceid: 'fr' },
  { iso2: 'IT', label: 'İtalya', hl: 'it', gl: 'IT', ceid: 'it' },
  { iso2: 'ES', label: 'İspanya', hl: 'es', gl: 'ES', ceid: 'es' },
  { iso2: 'NL', label: 'Hollanda', hl: 'nl', gl: 'NL', ceid: 'nl' },
  { iso2: 'SE', label: 'İsveç', hl: 'sv', gl: 'SE', ceid: 'sv' },
  { iso2: 'PL', label: 'Polonya', hl: 'pl', gl: 'PL', ceid: 'pl' },
  { iso2: 'UA', label: 'Ukrayna', hl: 'uk', gl: 'UA', ceid: 'uk' },
  { iso2: 'RU', label: 'Rusya', hl: 'ru', gl: 'RU', ceid: 'ru' },
  { iso2: 'CN', label: 'Çin', hl: 'zh-CN', gl: 'CN', ceid: 'zh-CN' },
  { iso2: 'JP', label: 'Japonya', hl: 'ja', gl: 'JP', ceid: 'ja' },
  { iso2: 'KR', label: 'Güney Kore', hl: 'ko', gl: 'KR', ceid: 'ko' },
  { iso2: 'IN', label: 'Hindistan', hl: 'en-IN', gl: 'IN', ceid: 'en' },
  { iso2: 'PK', label: 'Pakistan', hl: 'en-PK', gl: 'PK', ceid: 'en' },
  { iso2: 'ID', label: 'Endonezya', hl: 'id', gl: 'ID', ceid: 'id' },
  { iso2: 'AU', label: 'Avustralya', hl: 'en-AU', gl: 'AU', ceid: 'en' },
  { iso2: 'BR', label: 'Brezilya', hl: 'pt-BR', gl: 'BR', ceid: 'pt-419' },
  { iso2: 'AR', label: 'Arjantin', hl: 'es-419', gl: 'AR', ceid: 'es-419' },
  { iso2: 'MX', label: 'Meksika', hl: 'es-419', gl: 'MX', ceid: 'es-419' },
  { iso2: 'CA', label: 'Kanada', hl: 'en-CA', gl: 'CA', ceid: 'en' },
  { iso2: 'EG', label: 'Mısır', hl: 'ar', gl: 'EG', ceid: 'ar' },
  { iso2: 'ZA', label: 'Güney Afrika', hl: 'en-ZA', gl: 'ZA', ceid: 'en' },
  { iso2: 'NG', label: 'Nijerya', hl: 'en-NG', gl: 'NG', ceid: 'en' },
  { iso2: 'SA', label: 'Suudi Arabistan', hl: 'ar', gl: 'SA', ceid: 'ar' },
  { iso2: 'AE', label: 'BAE', hl: 'ar', gl: 'AE', ceid: 'ar' },
  { iso2: 'QA', label: 'Katar', hl: 'ar', gl: 'QA', ceid: 'ar' },
  { iso2: 'IL', label: 'İsrail', hl: 'he', gl: 'IL', ceid: 'he' },
  { iso2: 'IR', label: 'İran', hl: 'fa', gl: 'IR', ceid: 'fa' },
  { iso2: 'IQ', label: 'Irak', hl: 'ar', gl: 'IQ', ceid: 'ar' },
  { iso2: 'SY', label: 'Suriye', hl: 'ar', gl: 'SY', ceid: 'ar' },
  { iso2: 'GR', label: 'Yunanistan', hl: 'el', gl: 'GR', ceid: 'el' },
  { iso2: 'BG', label: 'Bulgaristan', hl: 'bg', gl: 'BG', ceid: 'bg' },
  { iso2: 'GE', label: 'Gürcistan', hl: 'ka', gl: 'GE', ceid: 'ka' },
  { iso2: 'AM', label: 'Ermenistan', hl: 'hy', gl: 'AM', ceid: 'hy' },
  { iso2: 'AZ', label: 'Azerbaycan', hl: 'az', gl: 'AZ', ceid: 'az' },
  { iso2: 'KZ', label: 'Kazakistan', hl: 'ru', gl: 'KZ', ceid: 'ru' },
  { iso2: 'CY', label: 'Kıbrıs', hl: 'el', gl: 'CY', ceid: 'el' },
  { iso2: 'PT', label: 'Portekiz', hl: 'pt-PT', gl: 'PT', ceid: 'pt-150' },
  { iso2: 'BE', label: 'Belçika', hl: 'fr', gl: 'BE', ceid: 'fr' },
  { iso2: 'AT', label: 'Avusturya', hl: 'de', gl: 'AT', ceid: 'de' },
  { iso2: 'CH', label: 'İsviçre', hl: 'de', gl: 'CH', ceid: 'de' },
  { iso2: 'CZ', label: 'Çekya', hl: 'cs', gl: 'CZ', ceid: 'cs' },
  { iso2: 'RO', label: 'Romanya', hl: 'ro', gl: 'RO', ceid: 'ro' },
  { iso2: 'HU', label: 'Macaristan', hl: 'hu', gl: 'HU', ceid: 'hu' },
  { iso2: 'RS', label: 'Sırbistan', hl: 'sr', gl: 'RS', ceid: 'sr' },
  { iso2: 'TH', label: 'Tayland', hl: 'th', gl: 'TH', ceid: 'th' },
  { iso2: 'VN', label: 'Vietnam', hl: 'vi', gl: 'VN', ceid: 'vi' },
  { iso2: 'MY', label: 'Malezya', hl: 'ms-MY', gl: 'MY', ceid: 'ms' },
  { iso2: 'PH', label: 'Filipinler', hl: 'en-PH', gl: 'PH', ceid: 'en' },
  { iso2: 'BD', label: 'Bangladeş', hl: 'bn', gl: 'BD', ceid: 'bn' },
  { iso2: 'SG', label: 'Singapur', hl: 'en-SG', gl: 'SG', ceid: 'en' },
  { iso2: 'MA', label: 'Fas', hl: 'fr', gl: 'MA', ceid: 'fr' },
  { iso2: 'KE', label: 'Kenya', hl: 'en-KE', gl: 'KE', ceid: 'en' },
  { iso2: 'CL', label: 'Şili', hl: 'es-419', gl: 'CL', ceid: 'es-419' },
  { iso2: 'CO', label: 'Kolombiya', hl: 'es-419', gl: 'CO', ceid: 'es-419' },
  { iso2: 'PE', label: 'Peru', hl: 'es-419', gl: 'PE', ceid: 'es-419' },
];

// Google Haberler konu kodları (kararlı, çoğu ülke editörü için geçerli).
const GNEWS_TOPICS: { code: string; tr: string }[] = [
  { code: 'WORLD', tr: 'Dünya' },
  { code: 'NATION', tr: 'Ülke' },
  { code: 'BUSINESS', tr: 'Ekonomi' },
  { code: 'TECHNOLOGY', tr: 'Teknoloji' },
  { code: 'SCIENCE', tr: 'Bilim' },
  { code: 'SPORTS', tr: 'Spor' },
  { code: 'HEALTH', tr: 'Sağlık' },
  { code: 'ENTERTAINMENT', tr: 'Kültür-Sanat' },
];

function gnewsTop(l: GNewsLocale): SeedSource {
  return rss(
    `Google Haberler — ${l.label} (Manşet)`,
    'https://news.google.com',
    `https://news.google.com/rss?hl=${l.hl}&gl=${l.gl}&ceid=${l.gl}:${l.ceid}`,
    l.ceid.split('-')[0],
    l.iso2,
    'notr',
  );
}

function gnewsTopic(l: GNewsLocale, t: { code: string; tr: string }): SeedSource {
  return rss(
    `Google Haberler — ${l.label} (${t.tr})`,
    'https://news.google.com',
    `https://news.google.com/rss/headlines/section/topic/${t.code}?hl=${l.hl}&gl=${l.gl}&ceid=${l.gl}:${l.ceid}`,
    l.ceid.split('-')[0],
    l.iso2,
    'notr',
  );
}

function buildGoogleNews(): SeedSource[] {
  const out: SeedSource[] = [];
  for (const l of GNEWS_LOCALES) {
    out.push(gnewsTop(l));
    for (const t of GNEWS_TOPICS) out.push(gnewsTopic(l, t));
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2) Küratörlü gerçek RSS beslemeleri (büyük yayın kuruluşları)
// ---------------------------------------------------------------------------
const CURATED: SeedSource[] = [
  // ---- Türkiye (yönelim dengeli) ----
  rss('TRT Haber — Son Dakika', 'https://www.trthaber.com', 'https://www.trthaber.com/sondakika.rss', 'tr', 'TR', 'iktidar'),
  rss('Anadolu Ajansı — Güncel', 'https://www.aa.com.tr', 'https://www.aa.com.tr/tr/rss/default?cat=guncel', 'tr', 'TR', 'iktidar'),
  rss('Anadolu Ajansı — Ekonomi', 'https://www.aa.com.tr', 'https://www.aa.com.tr/tr/rss/default?cat=ekonomi', 'tr', 'TR', 'iktidar'),
  rss('Anadolu Ajansı — Dünya', 'https://www.aa.com.tr', 'https://www.aa.com.tr/tr/rss/default?cat=dunya', 'tr', 'TR', 'iktidar'),
  rss('Sabah — Anasayfa', 'https://www.sabah.com.tr', 'https://www.sabah.com.tr/rss/anasayfa.xml', 'tr', 'TR', 'iktidar'),
  rss('Yeni Şafak — Anasayfa', 'https://www.yenisafak.com', 'https://www.yenisafak.com/rss?xml=anasayfa', 'tr', 'TR', 'iktidar'),
  rss('Hürriyet — Anasayfa', 'https://www.hurriyet.com.tr', 'https://www.hurriyet.com.tr/rss/anasayfa', 'tr', 'TR', 'notr'),
  rss('Milliyet — Gündem', 'https://www.milliyet.com.tr', 'https://www.milliyet.com.tr/rss/rssNew/gundemRss.xml', 'tr', 'TR', 'notr'),
  rss('Habertürk', 'https://www.haberturk.com', 'https://www.haberturk.com/rss', 'tr', 'TR', 'notr'),
  rss('NTV — Gündem', 'https://www.ntv.com.tr', 'https://www.ntv.com.tr/gundem.rss', 'tr', 'TR', 'notr'),
  rss('CNN Türk', 'https://www.cnnturk.com', 'https://www.cnnturk.com/feed/rss/all/news', 'tr', 'TR', 'notr'),
  rss('Cumhuriyet — Son Dakika', 'https://www.cumhuriyet.com.tr', 'https://www.cumhuriyet.com.tr/rss/son_dakika.xml', 'tr', 'TR', 'muhalefet'),
  rss('Sözcü', 'https://www.sozcu.com.tr', 'https://www.sozcu.com.tr/feed/', 'tr', 'TR', 'muhalefet'),
  rss('T24', 'https://t24.com.tr', 'https://t24.com.tr/rss', 'tr', 'TR', 'muhalefet'),
  rss('Diken', 'https://www.diken.com.tr', 'https://www.diken.com.tr/feed/', 'tr', 'TR', 'muhalefet'),
  rss('BirGün', 'https://www.birgun.net', 'https://www.birgun.net/rss', 'tr', 'TR', 'muhalefet'),
  rss('Evrensel', 'https://www.evrensel.net', 'https://www.evrensel.net/rss/haber.xml', 'tr', 'TR', 'muhalefet'),
  rss('Gazete Duvar', 'https://www.gazeteduvar.com.tr', 'https://www.gazeteduvar.com.tr/rss', 'tr', 'TR', 'muhalefet'),
  rss('Karar', 'https://www.karar.com', 'https://www.karar.com/rss', 'tr', 'TR', 'notr'),
  rss('Bianet — Son Eklenenler', 'https://bianet.org', 'https://bianet.org/biano/rss/son_eklenenler.rss', 'tr', 'TR', 'muhalefet'),
  rss('BBC Türkçe', 'https://www.bbc.com/turkce', 'https://feeds.bbci.co.uk/turkce/rss.xml', 'tr', 'TR', 'uluslararasi'),
  rss('DW Türkçe', 'https://www.dw.com/tr', 'https://rss.dw.com/rdf/rss-tur-all', 'tr', 'TR', 'uluslararasi'),
  rss('Euronews Türkçe', 'https://tr.euronews.com', 'https://tr.euronews.com/rss', 'tr', 'TR', 'uluslararasi'),
  rss('Independent Türkçe', 'https://www.indyturk.com', 'https://www.indyturk.com/rss.xml', 'tr', 'TR', 'uluslararasi'),

  // ---- Uluslararası / İngilizce ----
  rss('BBC News — World', 'https://www.bbc.com/news', 'https://feeds.bbci.co.uk/news/world/rss.xml', 'en', 'GB', 'uluslararasi'),
  rss('BBC News — Top', 'https://www.bbc.com/news', 'https://feeds.bbci.co.uk/news/rss.xml', 'en', 'GB', 'uluslararasi'),
  rss('BBC News — Business', 'https://www.bbc.com/news', 'https://feeds.bbci.co.uk/news/business/rss.xml', 'en', 'GB', 'uluslararasi'),
  rss('BBC News — Technology', 'https://www.bbc.com/news', 'https://feeds.bbci.co.uk/news/technology/rss.xml', 'en', 'GB', 'uluslararasi'),
  rss('BBC News — Science', 'https://www.bbc.com/news', 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', 'en', 'GB', 'uluslararasi'),
  rss('The Guardian — World', 'https://www.theguardian.com', 'https://www.theguardian.com/world/rss', 'en', 'GB', 'uluslararasi'),
  rss('The Guardian — International', 'https://www.theguardian.com', 'https://www.theguardian.com/international/rss', 'en', 'GB', 'uluslararasi'),
  rss('The Guardian — Business', 'https://www.theguardian.com', 'https://www.theguardian.com/uk/business/rss', 'en', 'GB', 'uluslararasi'),
  rss('The Guardian — Technology', 'https://www.theguardian.com', 'https://www.theguardian.com/uk/technology/rss', 'en', 'GB', 'uluslararasi'),
  rss('Sky News — World', 'https://news.sky.com', 'https://feeds.skynews.com/feeds/rss/world.xml', 'en', 'GB', 'uluslararasi'),
  rss('Sky News — Home', 'https://news.sky.com', 'https://feeds.skynews.com/feeds/rss/home.xml', 'en', 'GB', 'uluslararasi'),
  rss('The Independent — World', 'https://www.independent.co.uk', 'https://www.independent.co.uk/news/world/rss', 'en', 'GB', 'uluslararasi'),
  rss('The Economist — International', 'https://www.economist.com', 'https://www.economist.com/international/rss.xml', 'en', 'GB', 'uluslararasi'),
  rss('Financial Times — World', 'https://www.ft.com', 'https://www.ft.com/world?format=rss', 'en', 'GB', 'uluslararasi'),
  rss('NYT — World', 'https://www.nytimes.com', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', 'en', 'US', 'uluslararasi'),
  rss('NYT — Home', 'https://www.nytimes.com', 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', 'en', 'US', 'uluslararasi'),
  rss('NYT — Business', 'https://www.nytimes.com', 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', 'en', 'US', 'uluslararasi'),
  rss('NYT — Technology', 'https://www.nytimes.com', 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', 'en', 'US', 'uluslararasi'),
  rss('NYT — Politics', 'https://www.nytimes.com', 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', 'en', 'US', 'uluslararasi'),
  rss('Washington Post — World', 'https://www.washingtonpost.com', 'https://feeds.washingtonpost.com/rss/world', 'en', 'US', 'uluslararasi'),
  rss('Washington Post — National', 'https://www.washingtonpost.com', 'https://feeds.washingtonpost.com/rss/national', 'en', 'US', 'uluslararasi'),
  rss('Washington Post — Business', 'https://www.washingtonpost.com', 'https://feeds.washingtonpost.com/rss/business', 'en', 'US', 'uluslararasi'),
  rss('CNN — Top', 'https://www.cnn.com', 'http://rss.cnn.com/rss/edition.rss', 'en', 'US', 'uluslararasi'),
  rss('CNN — World', 'https://www.cnn.com', 'http://rss.cnn.com/rss/edition_world.rss', 'en', 'US', 'uluslararasi'),
  rss('CNN — Technology', 'https://www.cnn.com', 'http://rss.cnn.com/rss/edition_technology.rss', 'en', 'US', 'uluslararasi'),
  rss('NPR — News', 'https://www.npr.org', 'https://feeds.npr.org/1001/rss.xml', 'en', 'US', 'uluslararasi'),
  rss('NPR — World', 'https://www.npr.org', 'https://feeds.npr.org/1004/rss.xml', 'en', 'US', 'uluslararasi'),
  rss('Politico', 'https://www.politico.com', 'https://www.politico.com/rss/politicopicks.xml', 'en', 'US', 'uluslararasi'),
  rss('The Hill', 'https://thehill.com', 'https://thehill.com/news/feed/', 'en', 'US', 'uluslararasi'),
  rss('Al Jazeera English', 'https://www.aljazeera.com', 'https://www.aljazeera.com/xml/rss/all.xml', 'en', 'QA', 'uluslararasi'),
  rss('Euronews — English', 'https://www.euronews.com', 'https://www.euronews.com/rss', 'en', null, 'uluslararasi'),
  rss('DW — English', 'https://www.dw.com', 'https://rss.dw.com/rdf/rss-en-all', 'en', 'DE', 'uluslararasi'),
  rss('France 24 — English', 'https://www.france24.com/en', 'https://www.france24.com/en/rss', 'en', 'FR', 'uluslararasi'),
  rss('CNBC — Top News', 'https://www.cnbc.com', 'https://www.cnbc.com/id/100003114/device/rss/rss.html', 'en', 'US', 'uluslararasi'),
  rss('ABC News (US)', 'https://abcnews.go.com', 'https://abcnews.go.com/abcnews/topstories', 'en', 'US', 'uluslararasi'),
  rss('CBS News — World', 'https://www.cbsnews.com', 'https://www.cbsnews.com/latest/rss/world', 'en', 'US', 'uluslararasi'),

  // ---- Avrupa ----
  rss('Le Monde — Une', 'https://www.lemonde.fr', 'https://www.lemonde.fr/rss/une.xml', 'fr', 'FR', 'notr'),
  rss('Le Monde — International', 'https://www.lemonde.fr', 'https://www.lemonde.fr/international/rss_full.xml', 'fr', 'FR', 'notr'),
  rss('Le Figaro — Actualités', 'https://www.lefigaro.fr', 'https://www.lefigaro.fr/rss/figaro_actualites.xml', 'fr', 'FR', 'notr'),
  rss('Libération', 'https://www.liberation.fr', 'https://www.liberation.fr/arc/outboundfeeds/rss/?outputType=xml', 'fr', 'FR', 'notr'),
  rss('France 24 — Français', 'https://www.france24.com/fr', 'https://www.france24.com/fr/rss', 'fr', 'FR', 'notr'),
  rss('Der Spiegel — Schlagzeilen', 'https://www.spiegel.de', 'https://www.spiegel.de/schlagzeilen/index.rss', 'de', 'DE', 'notr'),
  rss('Die Zeit', 'https://www.zeit.de', 'https://newsfeed.zeit.de/index', 'de', 'DE', 'notr'),
  rss('FAZ — Aktuell', 'https://www.faz.net', 'https://www.faz.net/rss/aktuell/', 'de', 'DE', 'notr'),
  rss('Tagesschau', 'https://www.tagesschau.de', 'https://www.tagesschau.de/index~rss2.xml', 'de', 'DE', 'notr'),
  rss('El País — Portada', 'https://elpais.com', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada', 'es', 'ES', 'notr'),
  rss('El Mundo — Portada', 'https://www.elmundo.es', 'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml', 'es', 'ES', 'notr'),
  rss('La Vanguardia', 'https://www.lavanguardia.com', 'https://www.lavanguardia.com/rss/home.xml', 'es', 'ES', 'notr'),
  rss('ANSA — Top', 'https://www.ansa.it', 'https://www.ansa.it/sito/ansait_rss.xml', 'it', 'IT', 'notr'),
  rss('Corriere della Sera', 'https://www.corriere.it', 'https://xml2.corriereobjects.it/rss/homepage.xml', 'it', 'IT', 'notr'),
  rss('La Repubblica', 'https://www.repubblica.it', 'https://www.repubblica.it/rss/homepage/rss2.0.xml', 'it', 'IT', 'notr'),
  rss('NOS Nieuws', 'https://nos.nl', 'https://feeds.nos.nl/nosnieuwsalgemeen', 'nl', 'NL', 'notr'),
  rss('Notes from Poland', 'https://notesfrompoland.com', 'https://notesfrompoland.com/feed/', 'en', 'PL', 'notr'),
  rss('Kyiv Independent', 'https://kyivindependent.com', 'https://kyivindependent.com/feed/', 'en', 'UA', 'notr'),
  rss('Ukrinform — English', 'https://www.ukrinform.net', 'https://www.ukrinform.net/rss', 'en', 'UA', 'notr'),
  rss('RT — News', 'https://www.rt.com', 'https://www.rt.com/rss/', 'en', 'RU', 'iktidar'),
  rss('TASS — English', 'https://tass.com', 'https://tass.com/rss/v2.xml', 'en', 'RU', 'iktidar'),
  rss('The Moscow Times', 'https://www.themoscowtimes.com', 'https://www.themoscowtimes.com/rss/news', 'en', 'RU', 'muhalefet'),
  rss('Kathimerini — English', 'https://www.ekathimerini.com', 'https://www.ekathimerini.com/feed/', 'en', 'GR', 'notr'),

  // ---- Orta Doğu / Arap dünyası ----
  rss('Al Arabiya — English', 'https://english.alarabiya.net', 'https://english.alarabiya.net/.mrss/en.xml', 'en', 'SA', 'notr'),
  rss('Arab News', 'https://www.arabnews.com', 'https://www.arabnews.com/rss.xml', 'en', 'SA', 'notr'),
  rss('Gulf News', 'https://gulfnews.com', 'https://gulfnews.com/rss', 'en', 'AE', 'notr'),
  rss('Khaleej Times', 'https://www.khaleejtimes.com', 'https://www.khaleejtimes.com/rss', 'en', 'AE', 'notr'),
  rss('The National (UAE)', 'https://www.thenationalnews.com', 'https://www.thenationalnews.com/rss', 'en', 'AE', 'notr'),
  rss('Times of Israel', 'https://www.timesofisrael.com', 'https://www.timesofisrael.com/feed/', 'en', 'IL', 'notr'),
  rss('The Jerusalem Post', 'https://www.jpost.com', 'https://www.jpost.com/rss/rssfeedsfrontpage.aspx', 'en', 'IL', 'notr'),
  rss('Tehran Times', 'https://www.tehrantimes.com', 'https://www.tehrantimes.com/rss', 'en', 'IR', 'iktidar'),
  rss('Press TV', 'https://www.presstv.ir', 'https://www.presstv.ir/rss.xml', 'en', 'IR', 'iktidar'),
  rss('Egypt Independent', 'https://egyptindependent.com', 'https://egyptindependent.com/feed/', 'en', 'EG', 'notr'),

  // ---- Asya-Pasifik ----
  rss('NHK World — News', 'https://www3.nhk.or.jp/nhkworld', 'https://www3.nhk.or.jp/nhkworld/en/news/rss/all.xml', 'en', 'JP', 'notr'),
  rss('The Japan Times', 'https://www.japantimes.co.jp', 'https://www.japantimes.co.jp/feed/', 'en', 'JP', 'notr'),
  rss('The Korea Herald', 'http://www.koreaherald.com', 'http://www.koreaherald.com/rss/020000000000.xml', 'en', 'KR', 'notr'),
  rss('Yonhap — English', 'https://en.yna.co.kr', 'https://en.yna.co.kr/RSS/news.xml', 'en', 'KR', 'notr'),
  rss('South China Morning Post', 'https://www.scmp.com', 'https://www.scmp.com/rss/91/feed', 'en', 'CN', 'notr'),
  rss('Global Times', 'https://www.globaltimes.cn', 'https://www.globaltimes.cn/rss/outbrain.xml', 'en', 'CN', 'iktidar'),
  rss('CGTN — World', 'https://www.cgtn.com', 'https://www.cgtn.com/subscribe/rss/section/world.xml', 'en', 'CN', 'iktidar'),
  rss('The Times of India — Top', 'https://timesofindia.indiatimes.com', 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms', 'en', 'IN', 'notr'),
  rss('The Hindu — National', 'https://www.thehindu.com', 'https://www.thehindu.com/news/national/feeder/default.rss', 'en', 'IN', 'notr'),
  rss('NDTV — Top Stories', 'https://www.ndtv.com', 'https://feeds.feedburner.com/ndtvnews-top-stories', 'en', 'IN', 'notr'),
  rss('Dawn (Pakistan)', 'https://www.dawn.com', 'https://www.dawn.com/feeds/home', 'en', 'PK', 'notr'),
  rss('The Straits Times — World', 'https://www.straitstimes.com', 'https://www.straitstimes.com/news/world/rss.xml', 'en', 'SG', 'notr'),
  rss('The Jakarta Post', 'https://www.thejakartapost.com', 'https://www.thejakartapost.com/feed', 'en', 'ID', 'notr'),
  rss('ABC News (Australia)', 'https://www.abc.net.au/news', 'https://www.abc.net.au/news/feed/51120/rss.xml', 'en', 'AU', 'notr'),
  rss('The Sydney Morning Herald', 'https://www.smh.com.au', 'https://www.smh.com.au/rss/feed.xml', 'en', 'AU', 'notr'),

  // ---- Amerika / Afrika ----
  rss('CBC — Top Stories', 'https://www.cbc.ca', 'https://www.cbc.ca/cmlink/rss-topstories', 'en', 'CA', 'notr'),
  rss('CBC — World', 'https://www.cbc.ca', 'https://www.cbc.ca/cmlink/rss-world', 'en', 'CA', 'notr'),
  rss('G1 (Globo)', 'https://g1.globo.com', 'https://g1.globo.com/rss/g1/', 'pt', 'BR', 'notr'),
  rss('Folha de S.Paulo', 'https://www.folha.uol.com.br', 'https://feeds.folha.uol.com.br/emcimadahora/rss091.xml', 'pt', 'BR', 'notr'),
  rss('Clarín — Lo último', 'https://www.clarin.com', 'https://www.clarin.com/rss/lo-ultimo/', 'es', 'AR', 'notr'),
  rss('La Nación', 'https://www.lanacion.com.ar', 'https://www.lanacion.com.ar/arc/outboundfeeds/rss/?outputType=xml', 'es', 'AR', 'notr'),
  rss('News24 — Top Stories', 'https://www.news24.com', 'https://feeds.capi24.com/v1/Search/articles/news24/TopStories/rss', 'en', 'ZA', 'notr'),
  rss('Daily Maverick', 'https://www.dailymaverick.co.za', 'https://www.dailymaverick.co.za/dmrss/', 'en', 'ZA', 'notr'),
  rss('Premium Times (Nigeria)', 'https://www.premiumtimesng.com', 'https://www.premiumtimesng.com/feed', 'en', 'NG', 'notr'),
  rss('The Punch (Nigeria)', 'https://punchng.com', 'https://punchng.com/feed/', 'en', 'NG', 'notr'),

  // ---- Teknoloji / iş / bilim (uluslararası, ülke-bağımsız) ----
  rss('Reuters — World (Google)', 'https://www.reuters.com', 'https://news.google.com/rss/search?q=when:24h+site:reuters.com&hl=en-US&gl=US&ceid=US:en', 'en', null, 'uluslararasi'),
  rss('Associated Press (Google)', 'https://apnews.com', 'https://news.google.com/rss/search?q=when:24h+site:apnews.com&hl=en-US&gl=US&ceid=US:en', 'en', null, 'uluslararasi'),
  rss('Bloomberg (Google)', 'https://www.bloomberg.com', 'https://news.google.com/rss/search?q=when:24h+site:bloomberg.com&hl=en-US&gl=US&ceid=US:en', 'en', null, 'uluslararasi'),
  rss('TechCrunch', 'https://techcrunch.com', 'https://techcrunch.com/feed/', 'en', null, 'notr'),
  rss('The Verge', 'https://www.theverge.com', 'https://www.theverge.com/rss/index.xml', 'en', null, 'notr'),
  rss('Ars Technica', 'https://arstechnica.com', 'https://feeds.arstechnica.com/arstechnica/index', 'en', null, 'notr'),
  rss('Wired', 'https://www.wired.com', 'https://www.wired.com/feed/rss', 'en', null, 'notr'),
  rss('MIT Technology Review', 'https://www.technologyreview.com', 'https://www.technologyreview.com/feed/', 'en', null, 'notr'),
  rss('Nature — News', 'https://www.nature.com', 'https://www.nature.com/nature.rss', 'en', null, 'notr'),
  rss('Science — News', 'https://www.science.org', 'https://www.science.org/rss/news_current.xml', 'en', null, 'notr'),
  rss('Scientific American', 'https://www.scientificamerican.com', 'https://www.scientificamerican.com/feed/rss/', 'en', null, 'notr'),
  rss('Foreign Policy', 'https://foreignpolicy.com', 'https://foreignpolicy.com/feed/', 'en', null, 'uluslararasi'),
  rss('Foreign Affairs', 'https://www.foreignaffairs.com', 'https://www.foreignaffairs.com/rss.xml', 'en', null, 'uluslararasi'),
  rss('The Diplomat', 'https://thediplomat.com', 'https://thediplomat.com/feed/', 'en', null, 'uluslararasi'),
];

/**
 * Tüm seed kaynaklarını üretir; feed_url'e göre tekilleştirir.
 */
export function buildSeedSources(): SeedSource[] {
  const all = [...buildGoogleNews(), ...CURATED];
  const seen = new Set<string>();
  const out: SeedSource[] = [];
  for (const s of all) {
    if (seen.has(s.feedUrl)) continue;
    seen.add(s.feedUrl);
    out.push(s);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Türkiye'ye özel EK kaynaklar (400+): TR-etiketli Google Haberler arama
// beslemeleri — il/ilçe + konu/aktör/sektör sorguları. Her biri geçerli format,
// country_iso2='TR', lang='tr'. (0007_seed_sources_tr.sql migration'ında.)
// ---------------------------------------------------------------------------
function gnTrSearch(label: string, query: string): SeedSource {
  const q = encodeURIComponent(query);
  return rss(
    `Google Haberler — ${label}`,
    'https://news.google.com',
    `https://news.google.com/rss/search?q=${q}&hl=tr&gl=TR&ceid=TR:tr`,
    'tr',
    'TR',
    'notr',
  );
}

const TR_PROVINCES = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya',
  'Artvin', 'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu',
  'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır',
  'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun',
  'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta', 'Mersin', 'İstanbul', 'İzmir',
  'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya',
  'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş',
  'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop',
  'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak',
  'Van', 'Yozgat', 'Zonguldak', 'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale',
  'Batman', 'Şırnak', 'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük',
  'Kilis', 'Osmaniye', 'Düzce',
];

const TR_DISTRICTS = [
  // İstanbul
  'Kadıköy', 'Beşiktaş', 'Üsküdar', 'Şişli', 'Beyoğlu', 'Fatih', 'Bakırköy',
  'Maltepe', 'Kartal', 'Pendik', 'Ümraniye', 'Ataşehir', 'Sarıyer', 'Beylikdüzü',
  'Esenyurt', 'Başakşehir', 'Bağcılar', 'Küçükçekmece', 'Büyükçekmece', 'Tuzla',
  'Sancaktepe', 'Çekmeköy', 'Eyüpsultan', 'Gaziosmanpaşa', 'Zeytinburnu',
  // Ankara
  'Çankaya', 'Keçiören', 'Yenimahalle', 'Mamak', 'Etimesgut', 'Sincan',
  'Altındağ', 'Pursaklar', 'Gölbaşı', 'Polatlı',
  // İzmir
  'Konak', 'Karşıyaka', 'Bornova', 'Buca', 'Bayraklı', 'Çiğli', 'Gaziemir',
  'Karabağlar', 'Çeşme', 'Menemen',
  // Diğer büyükşehir
  'Nilüfer', 'Osmangazi', 'Yıldırım', 'Muratpaşa', 'Kepez', 'Konyaaltı',
  'Seyhan', 'Çukurova', 'Selçuklu', 'Meram', 'Şahinbey', 'Şehitkamil',
  'İlkadım', 'Atakum', 'Ortahisar', 'Battalgazi', 'Odunpazarı', 'Tepebaşı',
];

const TR_TOPICS: Array<[string, string]> = [
  // Ekonomi & piyasalar
  ['Dolar/TL', 'dolar kuru'], ['Euro/TL', 'euro kuru'], ['Altın', 'gram altın'],
  ['Borsa İstanbul', 'Borsa İstanbul BIST'], ['Faiz', 'Merkez Bankası faiz'],
  ['Enflasyon', 'enflasyon TÜİK'], ['Asgari ücret', 'asgari ücret'],
  ['Emeklilik', 'emeklilik EYT'], ['Zam', 'zam memur emekli'],
  ['Konut', 'konut fiyatları'], ['Kira', 'kira artışı'], ['Akaryakıt', 'benzin mazot zammı'],
  ['Vergi', 'vergi düzenlemesi'], ['Bütçe', 'merkezi bütçe'], ['İhracat', 'ihracat rakamları'],
  ['Cari açık', 'cari açık'], ['İşsizlik', 'işsizlik oranı'], ['Kredi', 'kredi faizi'],
  ['Doğalgaz', 'doğalgaz fiyatı'], ['Elektrik', 'elektrik zammı'],
  // Siyaset
  ['TBMM', 'TBMM Meclis'], ['Cumhurbaşkanlığı', 'Cumhurbaşkanı Erdoğan'],
  ['Kabine', 'Cumhurbaşkanlığı kabine'], ['CHP', 'CHP'], ['AK Parti', 'AK Parti'],
  ['MHP', 'MHP'], ['İYİ Parti', 'İYİ Parti'], ['DEM Parti', 'DEM Parti'],
  ['Saadet', 'Saadet Partisi'], ['Yeniden Refah', 'Yeniden Refah Partisi'],
  ['Anayasa', 'yeni anayasa'], ['Seçim', 'seçim'], ['Yerel seçim', 'yerel seçim belediye'],
  ['Dokunulmazlık', 'milletvekili dokunulmazlık'], ['İBB', 'İstanbul Büyükşehir Belediyesi'],
  ['Ankara Büyükşehir', 'Ankara Büyükşehir Belediyesi'], ['Muhalefet', 'muhalefet'],
  // Dış politika
  ['Dış politika', 'Türkiye dış politika'], ['NATO', 'Türkiye NATO'],
  ['Avrupa Birliği', 'Türkiye AB ilişkileri'], ['ABD ilişkileri', 'Türkiye ABD ilişkileri'],
  ['Rusya', 'Türkiye Rusya'], ['Yunanistan', 'Türkiye Yunanistan'],
  ['Suriye', 'Türkiye Suriye'], ['Irak', 'Türkiye Irak'], ['İran', 'Türkiye İran'],
  ['KKTC', 'KKTC Kıbrıs'], ['Azerbaycan', 'Türkiye Azerbaycan'],
  ['İsrail', 'Türkiye İsrail'], ['Filistin', 'Filistin Gazze'], ['Mısır', 'Türkiye Mısır'],
  ['Libya', 'Türkiye Libya'], ['Ukrayna', 'Türkiye Ukrayna savaşı'],
  // Güvenlik & savunma
  ['TSK', 'Türk Silahlı Kuvvetleri'], ['Savunma sanayii', 'savunma sanayii'],
  ['SİHA', 'Bayraktar SİHA İHA'], ['Terörle mücadele', 'terörle mücadele operasyon'],
  ['Sınır güvenliği', 'sınır güvenliği'], ['MİT', 'MİT istihbarat'],
  ['Aselsan', 'Aselsan'], ['Baykar', 'Baykar'], ['TUSAŞ', 'TUSAŞ TAI'],
  ['KAAN', 'milli muharip uçak KAAN'],
  // Sektörler
  ['Enerji', 'Türkiye enerji'], ['Petrol', 'petrol arama'], ['Maden', 'madencilik'],
  ['Tarım', 'tarım çiftçi'], ['Gıda', 'gıda fiyatları'], ['Otomotiv', 'otomotiv sektörü'],
  ['TOGG', 'TOGG'], ['Turizm', 'turizm sezonu'], ['Sanayi', 'sanayi üretimi'],
  ['İnşaat', 'inşaat sektörü'], ['Havacılık', 'THY havayolu'], ['Lojistik', 'lojistik'],
  ['Bankacılık', 'bankacılık sektörü'], ['Sigorta', 'sigorta sektörü'],
  // Toplum & kamu
  ['Deprem', 'deprem'], ['AFAD', 'AFAD'], ['Sağlık', 'sağlık Bakanlığı hastane'],
  ['Eğitim', 'MEB eğitim'], ['Üniversite', 'üniversite YÖK'], ['Yargı', 'yargı mahkeme'],
  ['Adalet', 'Adalet Bakanlığı'], ['İçişleri', 'İçişleri Bakanlığı'],
  ['Göç', 'göçmen sığınmacı'], ['İklim', 'iklim değişikliği kuraklık'],
  ['Orman yangını', 'orman yangını'], ['Trafik', 'trafik kazası'],
  ['Grev', 'grev işçi'], ['Sendika', 'sendika'], ['Kadın hakları', 'kadın cinayetleri'],
  // Teknoloji & bilim
  ['Yapay zeka', 'yapay zeka Türkiye'], ['Teknoloji', 'teknoloji'],
  ['Uzay', 'Türkiye uzay ajansı'], ['TÜBİTAK', 'TÜBİTAK'], ['Siber güvenlik', 'siber güvenlik'],
  ['Startup', 'girişim startup'], ['Telekomünikasyon', 'Türk Telekom Turkcell'],
];

const TR_DISTRICTS2 = [
  // İstanbul (ek)
  'Avcılar', 'Bahçelievler', 'Bayrampaşa', 'Esenler', 'Güngören', 'Kâğıthane',
  'Sultangazi', 'Sultanbeyli', 'Arnavutköy', 'Çatalca', 'Silivri', 'Şile',
  'Adalar', 'Beykoz', 'Bahçeşehir',
  // Ankara (ek)
  'Çubuk', 'Kahramankazan', 'Elmadağ', 'Beypazarı', 'Haymana', 'Şereflikoçhisar',
  // İzmir (ek)
  'Torbalı', 'Ödemiş', 'Tire', 'Bergama', 'Aliağa', 'Urla', 'Foça', 'Dikili',
  // Diğer büyükşehir ilçeleri
  'İnegöl', 'Gemlik', 'Mudanya', 'Alanya', 'Manavgat', 'Serik', 'Kemer',
  'Tarsus', 'Ceyhan', 'İskenderun', 'Ereğli', 'Akşehir', 'Nazilli', 'Söke',
  'Bodrum', 'Fethiye', 'Marmaris', 'Milas', 'Çorlu', 'Çerkezköy', 'Gebze',
  'Darıca', 'Körfez', 'İzmit', 'Adapazarı', 'Bandırma', 'Edremit', 'Turgutlu',
  'Salihli', 'Akhisar', 'Soma', 'Carşamba', 'Bafra', 'Ünye', 'Fatsa',
  'Sorgun', 'Develi', 'Bor', 'Viranşehir', 'Siverek', 'Nusaybin', 'Cizre',
  'Silopi', 'Kızıltepe', 'Ergani', 'Bismil',
];

const TR_ENTITIES: Array<[string, string]> = [
  // BIST / büyük şirketler
  ['THY', 'Türk Hava Yolları THY'], ['Türk Telekom', 'Türk Telekom'],
  ['Turkcell', 'Turkcell'], ['Tüpraş', 'Tüpraş'], ['Ereğli Demir Çelik', 'Erdemir'],
  ['Koç Holding', 'Koç Holding'], ['Sabancı', 'Sabancı Holding'],
  ['Garanti BBVA', 'Garanti BBVA'], ['İş Bankası', 'İş Bankası'],
  ['Akbank', 'Akbank'], ['Ziraat Bankası', 'Ziraat Bankası'],
  ['Ford Otosan', 'Ford Otosan'], ['Tofaş', 'Tofaş'], ['Arçelik', 'Arçelik'],
  ['BİM', 'BİM'], ['Şok Marketler', 'Şok Marketler'], ['Migros', 'Migros'],
  ['Petkim', 'Petkim'], ['Şişecam', 'Şişecam'], ['Turkish Airlines kargo', 'Turkish Cargo'],
  ['ASELSAN ihracat', 'Aselsan ihracat sözleşme'], ['Roketsan', 'Roketsan'],
  ['Havelsan', 'Havelsan'], ['EYAS', 'Eczacıbaşı'], ['Vakıfbank', 'Vakıfbank'],
  // Kurumlar & bakanlıklar
  ['Hazine Bakanlığı', 'Hazine ve Maliye Bakanlığı'],
  ['Sanayi Bakanlığı', 'Sanayi ve Teknoloji Bakanlığı'],
  ['Enerji Bakanlığı', 'Enerji ve Tabii Kaynaklar Bakanlığı'],
  ['Dışişleri Bakanlığı', 'Dışişleri Bakanlığı'],
  ['Milli Savunma Bakanlığı', 'Milli Savunma Bakanlığı'],
  ['Tarım Bakanlığı', 'Tarım ve Orman Bakanlığı'],
  ['Ticaret Bakanlığı', 'Ticaret Bakanlığı'], ['SPK', 'Sermaye Piyasası Kurulu SPK'],
  ['BDDK', 'BDDK'], ['Rekabet Kurumu', 'Rekabet Kurumu'], ['RTÜK', 'RTÜK'],
  ['Sayıştay', 'Sayıştay'], ['Danıştay', 'Danıştay'], ['Yargıtay', 'Yargıtay'],
  ['Anayasa Mahkemesi', 'Anayasa Mahkemesi AYM'], ['YSK', 'Yüksek Seçim Kurulu YSK'],
  ['HSK', 'Hakimler ve Savcılar Kurulu'], ['Diyanet', 'Diyanet İşleri Başkanlığı'],
  // Üniversiteler
  ['Boğaziçi Üniversitesi', 'Boğaziçi Üniversitesi'], ['İTÜ', 'İstanbul Teknik Üniversitesi'],
  ['ODTÜ', 'ODTÜ'], ['Hacettepe', 'Hacettepe Üniversitesi'],
  ['Ankara Üniversitesi', 'Ankara Üniversitesi'], ['İstanbul Üniversitesi', 'İstanbul Üniversitesi'],
  ['Ege Üniversitesi', 'Ege Üniversitesi'], ['Bilkent', 'Bilkent Üniversitesi'],
  ['Koç Üniversitesi', 'Koç Üniversitesi'], ['Sabancı Üniversitesi', 'Sabancı Üniversitesi'],
  // Ekonomi alt-başlıklar
  ['Kripto', 'kripto para Bitcoin Türkiye'], ['Tahvil', 'devlet tahvili'],
  ['CDS', 'Türkiye risk primi CDS'], ['Rezervler', 'Merkez Bankası rezervleri'],
  ['Turist sayısı', 'turist sayısı'], ['Otomobil satışları', 'otomobil satış rakamları'],
  ['Konut satışları', 'konut satış istatistik'], ['Sanayi üretimi', 'sanayi üretim endeksi'],
  ['PMI', 'imalat PMI'], ['Bütçe açığı', 'bütçe açığı'],
  ['Dış ticaret', 'dış ticaret açığı'], ['Tüketici güveni', 'tüketici güven endeksi'],
  // Toplum / aktüel
  ['Asgari geçim', 'asgari geçim açlık yoksulluk sınırı'], ['Memur zammı', 'memur maaş zammı'],
  ['Öğretmen ataması', 'öğretmen ataması'], ['Sağlıkta şiddet', 'sağlıkta şiddet'],
  ['Hava kirliliği', 'hava kirliliği'], ['Su krizi', 'baraj doluluk su krizi'],
  ['Asgari ücret zammı', 'asgari ücret zammı'], ['Sel', 'sel baskını'],
  ['Maden kazası', 'maden kazası'], ['İş kazası', 'iş kazası'],
  // Dış ilişkiler (ek)
  ['Almanya', 'Türkiye Almanya'], ['Fransa', 'Türkiye Fransa'],
  ['İngiltere', 'Türkiye İngiltere'], ['Çin', 'Türkiye Çin'],
  ['Suudi Arabistan', 'Türkiye Suudi Arabistan'], ['BAE', 'Türkiye BAE'],
  ['Katar', 'Türkiye Katar'], ['Pakistan', 'Türkiye Pakistan'],
  ['Türk dünyası', 'Türk Devletleri Teşkilatı'], ['Balkanlar', 'Türkiye Balkanlar'],
  ['Afrika açılımı', 'Türkiye Afrika'], ['Orta Asya', 'Türkiye Orta Asya'],
  ['Doğu Akdeniz', 'Doğu Akdeniz gerilim'], ['Karadeniz', 'Karadeniz doğalgaz'],
];

// ---------------------------------------------------------------------------
// Ulusal (TR) + uluslararası kuruluşların DOĞRUDAN kategori RSS beslemeleri.
// Google Haberler değil; yayıncının kendi RSS'i → tam metin, temiz, 429 yok.
// (0008_seed_sources_curated.sql migration'ında.)
// ---------------------------------------------------------------------------
const CURATED_EXTRA: SeedSource[] = [
  // ===== TR — Hürriyet (kategori) =====
  rss('Hürriyet — Gündem', 'https://www.hurriyet.com.tr', 'https://www.hurriyet.com.tr/rss/gundem', 'tr', 'TR', 'notr'),
  rss('Hürriyet — Ekonomi', 'https://www.hurriyet.com.tr', 'https://www.hurriyet.com.tr/rss/ekonomi', 'tr', 'TR', 'notr'),
  rss('Hürriyet — Dünya', 'https://www.hurriyet.com.tr', 'https://www.hurriyet.com.tr/rss/dunya', 'tr', 'TR', 'notr'),
  rss('Hürriyet — Teknoloji', 'https://www.hurriyet.com.tr', 'https://www.hurriyet.com.tr/rss/teknoloji', 'tr', 'TR', 'notr'),
  rss('Hürriyet — Sağlık', 'https://www.hurriyet.com.tr', 'https://www.hurriyet.com.tr/rss/saglik', 'tr', 'TR', 'notr'),
  // ===== TR — Milliyet (kategori) =====
  rss('Milliyet — Ekonomi', 'https://www.milliyet.com.tr', 'https://www.milliyet.com.tr/rss/rssNew/ekonomiRss.xml', 'tr', 'TR', 'notr'),
  rss('Milliyet — Dünya', 'https://www.milliyet.com.tr', 'https://www.milliyet.com.tr/rss/rssNew/dunyaRss.xml', 'tr', 'TR', 'notr'),
  rss('Milliyet — Siyaset', 'https://www.milliyet.com.tr', 'https://www.milliyet.com.tr/rss/rssNew/siyasetRss.xml', 'tr', 'TR', 'notr'),
  rss('Milliyet — Son Dakika', 'https://www.milliyet.com.tr', 'https://www.milliyet.com.tr/rss/rssNew/sondakikaRss.xml', 'tr', 'TR', 'notr'),
  rss('Milliyet — Teknoloji', 'https://www.milliyet.com.tr', 'https://www.milliyet.com.tr/rss/rssNew/teknolojiRss.xml', 'tr', 'TR', 'notr'),
  // ===== TR — Sabah (kategori) =====
  rss('Sabah — Gündem', 'https://www.sabah.com.tr', 'https://www.sabah.com.tr/rss/gundem.xml', 'tr', 'TR', 'iktidar'),
  rss('Sabah — Ekonomi', 'https://www.sabah.com.tr', 'https://www.sabah.com.tr/rss/ekonomi.xml', 'tr', 'TR', 'iktidar'),
  rss('Sabah — Dünya', 'https://www.sabah.com.tr', 'https://www.sabah.com.tr/rss/dunya.xml', 'tr', 'TR', 'iktidar'),
  rss('Sabah — Teknoloji', 'https://www.sabah.com.tr', 'https://www.sabah.com.tr/rss/teknoloji.xml', 'tr', 'TR', 'iktidar'),
  // ===== TR — NTV (kategori) =====
  rss('NTV — Ekonomi', 'https://www.ntv.com.tr', 'https://www.ntv.com.tr/ekonomi.rss', 'tr', 'TR', 'notr'),
  rss('NTV — Dünya', 'https://www.ntv.com.tr', 'https://www.ntv.com.tr/dunya.rss', 'tr', 'TR', 'notr'),
  rss('NTV — Teknoloji', 'https://www.ntv.com.tr', 'https://www.ntv.com.tr/teknoloji.rss', 'tr', 'TR', 'notr'),
  rss('NTV — Sağlık', 'https://www.ntv.com.tr', 'https://www.ntv.com.tr/saglik.rss', 'tr', 'TR', 'notr'),
  rss('NTV — Son Dakika', 'https://www.ntv.com.tr', 'https://www.ntv.com.tr/son-dakika.rss', 'tr', 'TR', 'notr'),
  // ===== TR — CNN Türk (kategori) =====
  rss('CNN Türk — Türkiye', 'https://www.cnnturk.com', 'https://www.cnnturk.com/feed/rss/turkiye/news', 'tr', 'TR', 'notr'),
  rss('CNN Türk — Ekonomi', 'https://www.cnnturk.com', 'https://www.cnnturk.com/feed/rss/ekonomi/news', 'tr', 'TR', 'notr'),
  rss('CNN Türk — Dünya', 'https://www.cnnturk.com', 'https://www.cnnturk.com/feed/rss/dunya/news', 'tr', 'TR', 'notr'),
  rss('CNN Türk — Teknoloji', 'https://www.cnnturk.com', 'https://www.cnnturk.com/feed/rss/teknoloji/news', 'tr', 'TR', 'notr'),
  // ===== TR — Habertürk (kategori) =====
  rss('Habertürk — Gündem', 'https://www.haberturk.com', 'https://www.haberturk.com/rss/gundem.xml', 'tr', 'TR', 'notr'),
  rss('Habertürk — Ekonomi', 'https://www.haberturk.com', 'https://www.haberturk.com/rss/ekonomi.xml', 'tr', 'TR', 'notr'),
  rss('Habertürk — Dünya', 'https://www.haberturk.com', 'https://www.haberturk.com/rss/dunya.xml', 'tr', 'TR', 'notr'),
  rss('Habertürk — Teknoloji', 'https://www.haberturk.com', 'https://www.haberturk.com/rss/teknoloji.xml', 'tr', 'TR', 'notr'),
  // ===== TR — Cumhuriyet (kategori) =====
  rss('Cumhuriyet — Türkiye', 'https://www.cumhuriyet.com.tr', 'https://www.cumhuriyet.com.tr/rss/turkiye.xml', 'tr', 'TR', 'muhalefet'),
  rss('Cumhuriyet — Ekonomi', 'https://www.cumhuriyet.com.tr', 'https://www.cumhuriyet.com.tr/rss/ekonomi.xml', 'tr', 'TR', 'muhalefet'),
  rss('Cumhuriyet — Dünya', 'https://www.cumhuriyet.com.tr', 'https://www.cumhuriyet.com.tr/rss/dunya.xml', 'tr', 'TR', 'muhalefet'),
  rss('Cumhuriyet — Siyaset', 'https://www.cumhuriyet.com.tr', 'https://www.cumhuriyet.com.tr/rss/siyaset.xml', 'tr', 'TR', 'muhalefet'),
  // ===== TR — Sözcü (kategori, WordPress) =====
  rss('Sözcü — Gündem', 'https://www.sozcu.com.tr', 'https://www.sozcu.com.tr/kategori/gundem/feed/', 'tr', 'TR', 'muhalefet'),
  rss('Sözcü — Ekonomi', 'https://www.sozcu.com.tr', 'https://www.sozcu.com.tr/kategori/ekonomi/feed/', 'tr', 'TR', 'muhalefet'),
  rss('Sözcü — Dünya', 'https://www.sozcu.com.tr', 'https://www.sozcu.com.tr/kategori/dunya/feed/', 'tr', 'TR', 'muhalefet'),
  // ===== TR — Yeni Şafak (kategori) =====
  rss('Yeni Şafak — Gündem', 'https://www.yenisafak.com', 'https://www.yenisafak.com/rss?xml=gundem', 'tr', 'TR', 'iktidar'),
  rss('Yeni Şafak — Ekonomi', 'https://www.yenisafak.com', 'https://www.yenisafak.com/rss?xml=ekonomi', 'tr', 'TR', 'iktidar'),
  rss('Yeni Şafak — Dünya', 'https://www.yenisafak.com', 'https://www.yenisafak.com/rss?xml=dunya', 'tr', 'TR', 'iktidar'),
  rss('Yeni Şafak — Politika', 'https://www.yenisafak.com', 'https://www.yenisafak.com/rss?xml=politika', 'tr', 'TR', 'iktidar'),
  // ===== TR — Anadolu Ajansı (kategori) =====
  rss('AA — Politika', 'https://www.aa.com.tr', 'https://www.aa.com.tr/tr/rss/default?cat=politika', 'tr', 'TR', 'iktidar'),
  rss('AA — Spor', 'https://www.aa.com.tr', 'https://www.aa.com.tr/tr/rss/default?cat=spor', 'tr', 'TR', 'iktidar'),
  rss('AA — Analiz', 'https://www.aa.com.tr', 'https://www.aa.com.tr/tr/rss/default?cat=analiz', 'tr', 'TR', 'iktidar'),
  rss('AA — Bilim-Teknoloji', 'https://www.aa.com.tr', 'https://www.aa.com.tr/tr/rss/default?cat=bilim-teknoloji', 'tr', 'TR', 'iktidar'),
  rss('AA English — World', 'https://www.aa.com.tr/en', 'https://www.aa.com.tr/en/rss/default?cat=world', 'en', 'TR', 'iktidar'),
  // ===== TR — diğer ulusal =====
  rss('Dünya Gazetesi', 'https://www.dunya.com', 'https://www.dunya.com/rss', 'tr', 'TR', 'notr'),
  rss('BloombergHT', 'https://www.bloomberght.com', 'https://www.bloomberght.com/rss', 'tr', 'TR', 'notr'),
  rss('DHA', 'https://www.dha.com.tr', 'https://www.dha.com.tr/rss', 'tr', 'TR', 'notr'),
  rss('İHA', 'https://www.iha.com.tr', 'https://www.iha.com.tr/rss/', 'tr', 'TR', 'notr'),
  rss('OdaTV', 'https://www.odatv.com', 'https://www.odatv.com/rss.xml', 'tr', 'TR', 'muhalefet'),
  rss('Gerçek Gündem', 'https://www.gercekgundem.com', 'https://www.gercekgundem.com/rss', 'tr', 'TR', 'muhalefet'),
  rss('Yeniçağ', 'https://www.yenicaggazetesi.com.tr', 'https://www.yenicaggazetesi.com.tr/rss', 'tr', 'TR', 'muhalefet'),
  rss('Türkiye Gazetesi', 'https://www.turkiyegazetesi.com.tr', 'https://www.turkiyegazetesi.com.tr/rss', 'tr', 'TR', 'iktidar'),
  rss('Star', 'https://www.star.com.tr', 'https://www.star.com.tr/rss/rss.asp', 'tr', 'TR', 'iktidar'),
  rss('Sputnik Türkçe', 'https://anadolu.sputniknews.com.tr', 'https://anadolu.sputniknews.com.tr/export/rss2/archive/index.xml', 'tr', 'TR', 'uluslararasi'),

  // ===== Uluslararası — BBC (bölge/kategori) =====
  rss('BBC — Middle East', 'https://www.bbc.com/news', 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml', 'en', 'GB', 'uluslararasi'),
  rss('BBC — Europe', 'https://www.bbc.com/news', 'https://feeds.bbci.co.uk/news/world/europe/rss.xml', 'en', 'GB', 'uluslararasi'),
  rss('BBC — Asia', 'https://www.bbc.com/news', 'https://feeds.bbci.co.uk/news/world/asia/rss.xml', 'en', 'GB', 'uluslararasi'),
  rss('BBC — US & Canada', 'https://www.bbc.com/news', 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml', 'en', 'US', 'uluslararasi'),
  rss('BBC — Africa', 'https://www.bbc.com/news', 'https://feeds.bbci.co.uk/news/world/africa/rss.xml', 'en', 'GB', 'uluslararasi'),
  // ===== Uluslararası — Guardian (bölüm) =====
  rss('Guardian — Middle East', 'https://www.theguardian.com', 'https://www.theguardian.com/world/middleeast/rss', 'en', 'GB', 'uluslararasi'),
  rss('Guardian — Europe', 'https://www.theguardian.com', 'https://www.theguardian.com/world/europe-news/rss', 'en', 'GB', 'uluslararasi'),
  rss('Guardian — US', 'https://www.theguardian.com', 'https://www.theguardian.com/us-news/rss', 'en', 'US', 'uluslararasi'),
  rss('Guardian — Environment', 'https://www.theguardian.com', 'https://www.theguardian.com/environment/rss', 'en', 'GB', 'uluslararasi'),
  rss('Guardian — Science', 'https://www.theguardian.com', 'https://www.theguardian.com/science/rss', 'en', 'GB', 'uluslararasi'),
  // ===== Uluslararası — NYT (bölüm) =====
  rss('NYT — Middle East', 'https://www.nytimes.com', 'https://rss.nytimes.com/services/xml/rss/nyt/MiddleEast.xml', 'en', 'US', 'uluslararasi'),
  rss('NYT — Europe', 'https://www.nytimes.com', 'https://rss.nytimes.com/services/xml/rss/nyt/Europe.xml', 'en', 'US', 'uluslararasi'),
  rss('NYT — Asia Pacific', 'https://www.nytimes.com', 'https://rss.nytimes.com/services/xml/rss/nyt/AsiaPacific.xml', 'en', 'US', 'uluslararasi'),
  rss('NYT — Economy', 'https://www.nytimes.com', 'https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml', 'en', 'US', 'uluslararasi'),
  rss('NYT — Science', 'https://www.nytimes.com', 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml', 'en', 'US', 'uluslararasi'),
  // ===== Uluslararası — CNN (bölge) =====
  rss('CNN — Europe', 'https://www.cnn.com', 'http://rss.cnn.com/rss/edition_europe.rss', 'en', 'US', 'uluslararasi'),
  rss('CNN — Middle East', 'https://www.cnn.com', 'http://rss.cnn.com/rss/edition_meast.rss', 'en', 'US', 'uluslararasi'),
  rss('CNN — Business', 'https://www.cnn.com', 'http://rss.cnn.com/rss/money_news_international.rss', 'en', 'US', 'uluslararasi'),
  // ===== Uluslararası — DW / France24 (dil/bölüm) =====
  rss('DW — Deutsch', 'https://www.dw.com', 'https://rss.dw.com/rdf/rss-de-all', 'de', 'DE', 'uluslararasi'),
  // ===== Uluslararası — Economist (bölüm) =====
  rss('The Economist — Finance', 'https://www.economist.com', 'https://www.economist.com/finance-and-economics/rss.xml', 'en', 'GB', 'uluslararasi'),
  rss('The Economist — Business', 'https://www.economist.com', 'https://www.economist.com/business/rss.xml', 'en', 'GB', 'uluslararasi'),
  rss('The Economist — Europe', 'https://www.economist.com', 'https://www.economist.com/europe/rss.xml', 'en', 'GB', 'uluslararasi'),
  rss('The Economist — MEA', 'https://www.economist.com', 'https://www.economist.com/middle-east-and-africa/rss.xml', 'en', 'GB', 'uluslararasi'),
  // ===== Uluslararası — Washington Post (kategori) =====
  rss('Washington Post — Technology', 'https://www.washingtonpost.com', 'https://feeds.washingtonpost.com/rss/business/technology', 'en', 'US', 'uluslararasi'),
  // ===== Orta Doğu / Türkiye gündemine yakın =====
  rss('Middle East Eye', 'https://www.middleeasteye.net', 'https://www.middleeasteye.net/rss', 'en', null, 'uluslararasi'),
  rss('Al-Monitor', 'https://www.al-monitor.com', 'https://www.al-monitor.com/rss', 'en', null, 'uluslararasi'),
  rss('Rudaw — English', 'https://www.rudaw.net', 'https://www.rudaw.net/rss?language=english', 'en', 'IQ', 'uluslararasi'),
  rss('The New Arab', 'https://www.newarab.com', 'https://www.newarab.com/rss', 'en', null, 'uluslararasi'),
  // ===== Ekonomi / iş (uluslararası) =====
  rss('Reuters — Business (Google)', 'https://www.reuters.com', 'https://news.google.com/rss/search?q=when:24h+site:reuters.com+business&hl=en-US&gl=US&ceid=US:en', 'en', null, 'uluslararasi'),
  rss('CNBC — World', 'https://www.cnbc.com', 'https://www.cnbc.com/id/100727362/device/rss/rss.html', 'en', 'US', 'uluslararasi'),
  rss('CNBC — Economy', 'https://www.cnbc.com', 'https://www.cnbc.com/id/20910258/device/rss/rss.html', 'en', 'US', 'uluslararasi'),
  rss('MarketWatch — Top', 'https://www.marketwatch.com', 'https://feeds.marketwatch.com/marketwatch/topstories/', 'en', 'US', 'uluslararasi'),
];

/** Ulusal + uluslararası doğrudan RSS (kategori) kaynakları; feed_url'e göre tekil. */
export function buildCuratedExtra(): SeedSource[] {
  const seen = new Set<string>();
  return CURATED_EXTRA.filter((s) => {
    if (seen.has(s.feedUrl)) return false;
    seen.add(s.feedUrl);
    return true;
  });
}

/** Türkiye için 400+ ek kaynak (il + ilçe + konu/aktör); feed_url'e göre tekil. */
export function buildTurkeyExtra(): SeedSource[] {
  const out: SeedSource[] = [];
  for (const il of TR_PROVINCES) out.push(gnTrSearch(`${il} (il)`, `"${il}" haberleri`));
  for (const d of [...TR_DISTRICTS, ...TR_DISTRICTS2])
    out.push(gnTrSearch(`${d} (ilçe)`, `"${d}"`));
  for (const [label, q] of [...TR_TOPICS, ...TR_ENTITIES])
    out.push(gnTrSearch(`TR · ${label}`, q));

  const seen = new Set<string>();
  return out.filter((s) => {
    if (seen.has(s.feedUrl)) return false;
    seen.add(s.feedUrl);
    return true;
  });
}
