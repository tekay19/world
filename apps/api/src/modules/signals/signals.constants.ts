export const SIGNALS_QUEUE = 'signals';

export const SIGNAL_JOBS = {
  /** Döviz kurunu çek (USD/TRY). */
  PULL_FX: 'pull-fx',
} as const;

/** prediction.prompt.ts metric_key değerleriyle aynı. */
export const METRICS = {
  USDTRY: 'USDTRY',
  CPI_YOY: 'CPI_YOY',
  BRENT: 'BRENT',
  WTI: 'WTI',
  FED_RATE: 'FED_RATE',
  GOLD: 'GOLD',
  SILVER: 'SILVER',
} as const;

/** Twelve Data sembolleri → iç metric_key (ücretsiz tier: metal/forex). */
export const TWELVE_SERIES: Array<{ metric: string; symbol: string; label: string }> = [
  { metric: 'GOLD', symbol: 'XAU/USD', label: 'Altın ($/ons)' },
  { metric: 'SILVER', symbol: 'XAG/USD', label: 'Gümüş ($/ons)' },
];

/** FRED serileri → iç metric_key. (Brent doğrulandı; FRED_API_KEY varsa çekilir.) */
export const FRED_SERIES: Array<{ metric: string; series: string; label: string }> = [
  { metric: METRICS.BRENT, series: 'DCOILBRENTEU', label: 'Brent petrol ($/varil)' },
  { metric: METRICS.WTI, series: 'DCOILWTICO', label: 'WTI petrol ($/varil)' },
  { metric: METRICS.FED_RATE, series: 'DFF', label: 'ABD Fed faizi (%)' },
];
