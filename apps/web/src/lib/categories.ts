// Sabit kategori kümesi — backend prediction.prompt.ts (CATEGORY_IDS) ile aynı id'ler.
export interface Category {
  id: string;
  label: string;
  emoji: string;
}

export const CATEGORIES: Category[] = [
  { id: 'siyaset', label: 'Siyaset', emoji: '🏛️' },
  { id: 'ekonomi', label: 'Ekonomi', emoji: '💹' },
  { id: 'dispolitika', label: 'Dış Politika', emoji: '🌍' },
  { id: 'guvenlik', label: 'Güvenlik & Savaş', emoji: '🛡️' },
  { id: 'toplum', label: 'Toplum', emoji: '👥' },
  { id: 'saglik', label: 'Sağlık', emoji: '🏥' },
  { id: 'enerji', label: 'Enerji', emoji: '⚡' },
  { id: 'teknoloji', label: 'Teknoloji', emoji: '🛰️' },
];

export function categoryLabel(id: string | null | undefined): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? 'Diğer';
}
