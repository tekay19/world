/**
 * Bağımlılıksız, "yeterince iyi" makale gövdesi çıkarımı (Readability-grade DEĞİL).
 *
 * Neden: çoğu RSS yalnız `summary` (snippet) veriyor, `content` NULL kalıyor →
 * LLM kör kaynakla çalışıyor. Bu, makale URL'sinden HTML çekip gövdeyi düz metne
 * indirir (ingestion.service.enrichFullText kullanır). Proje düşük-bağımlılık
 * etiğinde (rss-parser dışında parser yok) regex tabanlı tutulur.
 */

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#x?[0-9a-f]+;/gi, ' '); // kalan numerik/onaltılık entity'leri boşalt
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * HTML → makale metni. Script/stil/gezinme atılır; varsa <article>/<main> kabı
 * tercih edilir; paragraflar birleştirilir (yoksa düz metne düşer). maxChars'ta kesilir.
 */
export function extractArticleText(html: string, maxChars = 8000): string {
  if (!html) return '';
  // 1) Gürültü bloklarını TAMAMEN at (içerik değil).
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(header|footer|nav|aside|form)\b[\s\S]*?<\/\1>/gi, ' ');

  // 2) Ana içerik kabını yakala (varsa) — gövde dışını (menü/öneri) ele.
  const main =
    cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    cleaned;

  // 3) Paragrafları çıkar; kısa kırıntıları (menü/etiket) ele. Yoksa düz metin.
  const paras = [...main.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((t) => t.length >= 40);

  const text = (paras.length ? paras.join('\n\n') : stripTags(main))
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text.slice(0, maxChars);
}
