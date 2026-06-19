import type { AnalysisItem } from './llm.prompt';

/**
 * Kanıt biçimlendirme yardımcıları (saf fonksiyon, LLM çağırmaz).
 * Tüm prompt builder'lar (analiz/tahmin/oy) tek kaynaktan kanıt bloğu kurar:
 * ilk N habere TAM metin, gerisine kısa özet (token kontrolü).
 */

/** Metni n karaktere indir; mümkünse cümle sınırında kes. */
export function clampText(s: string | null | undefined, n: number): string {
  if (!s) return '';
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const stop = Math.max(
    cut.lastIndexOf('. '),
    cut.lastIndexOf('! '),
    cut.lastIndexOf('? '),
  );
  const base = stop > n * 0.6 ? cut.slice(0, stop + 1) : cut;
  return `${base.trim()} …(kısaltıldı)`;
}

export interface EvidenceOpts {
  /** Kaç habere tam metin verilsin (gerisine özet). */
  maxFull?: number;
  /** Tam metin karakter limiti. */
  fullChars?: number;
  /** Özet karakter limiti. */
  snippetChars?: number;
}

/**
 * Numaralı kanıt bloğu üretir: "[i] başlık | tarih | kaynak | yönelim | metin | url".
 * İlk `maxFull` öğeye (varsa) tam metin, gerisine özet. Numaralandırma atıf için korunur.
 */
export function formatEvidenceBlock(
  items: AnalysisItem[],
  opts: EvidenceOpts = {},
): string {
  const maxFull = opts.maxFull ?? 6;
  const fullChars = opts.fullChars ?? 1800;
  const snippetChars = opts.snippetChars ?? 280;

  return items
    .map((it, i) => {
      const full = i < maxFull ? clampText(it.content, fullChars) : '';
      const body = full || clampText(it.snippet, snippetChars);
      const parts = [
        `[${i + 1}] ${it.title}`,
        it.publishedAt ? `tarih: ${String(it.publishedAt).slice(0, 10)}` : '',
        it.source ? `kaynak: ${it.source}` : '',
        it.orientation ? `yönelim: ${it.orientation}` : '',
        body ? `metin: ${body}` : '',
        `url: ${it.url}`,
      ].filter(Boolean);
      return parts.join(' | ');
    })
    .join('\n');
}
