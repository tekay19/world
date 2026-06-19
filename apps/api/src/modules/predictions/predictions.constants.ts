export const PREDICTIONS_QUEUE = 'predictions';

export const PREDICTION_JOBS = {
  RESOLVE_DUE: 'resolve-due',
  /** Eskimiş aktif tahminleri yeniden üret (olasılık zamanla kayar). */
  REPREDICT_STALE: 'repredict-stale',
  /** Senaryo setlerini aylık olarak yeni haber/veriyle yenile. */
  REFRESH_SCENARIOS: 'refresh-scenarios',
} as const;
