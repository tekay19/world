/**
 * Aşama-ilerleme olayı. Uzun üretim akışları (tahmin 20-60sn, senaryo 30-90sn)
 * çıktısı yapısal JSON olduğu için token-token streaming anlamsız; bunun yerine
 * boru hattının BOUNDARY'lerinde aşama bildirilir → kullanıcı boş ekran yerine
 * "bağlam → araştırma → model → kayıt" canlı ilerlemesini görür (SSE ile akar).
 */
export interface ProgressEvent {
  /** Makine-okur aşama anahtarı: 'context' | 'research' | 'model' | 'save'. */
  stage: string;
  /** Kullanıcıya gösterilecek kısa Türkçe açıklama. */
  detail?: string;
}

export type ProgressFn = (ev: ProgressEvent) => void;

/** Stream dışı normal çağrılar için varsayılan (hiçbir şey yapmaz). */
export const NOOP_PROGRESS: ProgressFn = () => undefined;
