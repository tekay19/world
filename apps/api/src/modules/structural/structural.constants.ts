export const STRUCTURAL_QUEUE = 'structural';

export const STRUCTURAL_JOBS = {
  /** Dünya Bankası makro göstergelerini çek (tüm seed ülkeler). */
  PULL_INDICATORS: 'pull-indicators',
} as const;

export interface IndicatorDef {
  /** İç metric_key (indicators tablosu + prompt). */
  key: string;
  /** Dünya Bankası gösterge kodu. */
  wb: string;
  /** Görünen ad. */
  label: string;
  /** Birim/sonek (gösterimde). */
  unit: string;
}

/** Çekilecek makro göstergeler (Dünya Bankası kodları). */
export const INDICATORS: IndicatorDef[] = [
  { key: 'GDP_GROWTH', wb: 'NY.GDP.MKTP.KD.ZG', label: 'GSYH büyüme', unit: '%' },
  { key: 'CPI_YOY', wb: 'FP.CPI.TOTL.ZG', label: 'Enflasyon', unit: '%' },
  { key: 'UNEMPLOYMENT', wb: 'SL.UEM.TOTL.ZS', label: 'İşsizlik', unit: '%' },
  { key: 'DEBT_GDP', wb: 'GC.DOD.TOTL.GD.ZS', label: 'Borç/GSYH', unit: '%' },
  { key: 'CURRENT_ACCOUNT_GDP', wb: 'BN.CAB.XOKA.GD.ZS', label: 'Cari denge/GSYH', unit: '%' },
  { key: 'RESERVES', wb: 'FI.RES.TOTL.CD', label: 'Rezervler', unit: '$' },
  { key: 'POPULATION', wb: 'SP.POP.TOTL', label: 'Nüfus', unit: '' },
];
