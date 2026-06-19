// Natural Earth GeoJSON özelliklerinden ISO2 / ülke adı çıkarımı.
// Farklı sürümlerde alan adları değişebildiği için birkaç anahtar denenir.

export interface GeoProps {
  [key: string]: unknown;
}

// ISO_A2'si olmayan (Natural Earth'te '-99') ama temsil etmek istediğimiz
// varlıklar için ADM0_A3 → özel iç kod eşlemesi.
const A3_OVERRIDES: Record<string, string> = {
  CYN: 'NC', // KKTC — Natural Earth'te "N. Cyprus", resmi ISO-2 kodu yok
};

export function featureIso2(props: GeoProps): string | null {
  const candidates = [
    props.ISO_A2,
    props.ISO_A2_EH,
    props.iso_a2,
    props.WB_A2,
    props.POSTAL,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim() && c !== '-99') {
      return c.trim().toUpperCase();
    }
  }
  // Gerçek ISO kodu yoksa ADM0_A3 üzerinden özel eşleme dene (örn. KKTC).
  const a3 = props.ADM0_A3;
  if (typeof a3 === 'string' && A3_OVERRIDES[a3]) return A3_OVERRIDES[a3];
  return null;
}

export function featureName(props: GeoProps): string {
  const candidates = [props.ADMIN, props.NAME, props.name, props.admin, props.NAME_LONG];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return 'Bilinmeyen';
}

// Gündem skoru (0..100) → renk. Düşük = sakin (mavi-yeşil), yüksek = gergin (kırmızı).
export function agendaColor(score: number | null | undefined): string {
  // Veri yok → neredeyse şeffaf: gerçekçi mermer doku + bulutlar görünsün,
  // ülke yalnız ince sınır çizgisiyle belli olsun (sinematik görünüm).
  if (score == null) return 'rgba(120, 150, 185, 0.05)';
  // Skorlu (sıcak) ülke → gündem yoğunluğuna göre belirgin renkli kapak.
  const s = Math.max(0, Math.min(100, score)) / 100;
  const r = Math.round(40 + s * 200);
  const g = Math.round(180 - s * 120);
  const b = Math.round(160 - s * 110);
  return `rgba(${r}, ${g}, ${b}, ${(0.45 + s * 0.3).toFixed(2)})`;
}
