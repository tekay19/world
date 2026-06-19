/**
 * Tüm prompt builder'ların (tahmin/senaryo/oy) paylaştığı kanıt öğesi tipi.
 * Doktrin (§2.6 ülke analizi) sistemden kaldırıldı; geriye yalnız bu paylaşılan
 * tip kaldı — evidence.ts ve prediction/scenario prompt'ları bunu kullanır.
 */
export interface AnalysisItem {
  title: string;
  url: string;
  orientation?: string | null;
  source?: string | null;
  snippet?: string | null;
  content?: string | null;
  publishedAt?: string | null;
}
