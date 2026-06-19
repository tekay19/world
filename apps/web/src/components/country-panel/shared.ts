export const pct = (probability: number | null | undefined) =>
  probability == null ? '—' : Math.round(probability * 100) + '%';

export function fmtNum(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 1000) {
    return value.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
  }
  if (absolute >= 100) return value.toFixed(1);
  return value.toFixed(2);
}

export function isoToFlag(iso: string): string {
  const countryCode = (iso || '').toUpperCase();
  if (countryCode.length !== 2 || countryCode === 'NC') return '🏳️';
  const base = 0x1f1e6;
  return String.fromCodePoint(
    base + countryCode.charCodeAt(0) - 65,
    base + countryCode.charCodeAt(1) - 65,
  );
}

export function riskBand(score: number | null): {
  label: string;
  tone: string;
  pct: number;
} {
  if (score == null) return { label: '—', tone: 'na', pct: 0 };
  if (score < 34) return { label: 'Düşük', tone: 'ok', pct: score };
  if (score < 67) return { label: 'Orta', tone: 'warn', pct: score };
  return { label: 'Yüksek', tone: 'danger', pct: score };
}

export function stabilityBand(score: number | null): {
  label: string;
  tone: string;
} {
  if (score == null) return { label: '—', tone: 'na' };
  if (score < 34) return { label: 'Sağlam', tone: 'ok' };
  if (score < 67) return { label: 'Dengeli', tone: 'warn' };
  return { label: 'Kırılgan', tone: 'danger' };
}

export function confTone(confidence: string | null | undefined): string {
  const value = (confidence ?? '').toLowerCase();
  if (value.includes('yüksek')) return 'strong';
  if (value.includes('düşük')) return 'low';
  return 'mid';
}

export function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const elapsed = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return 'az önce';
  if (minutes < 60) return minutes + ' dk';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + ' sa';
  return Math.floor(hours / 24) + ' g';
}
