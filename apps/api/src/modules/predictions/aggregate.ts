// Faz B1 — bağımsız tahminleri birleştirme.
// Yöntem: kalibrasyon-ağırlıklı logit havuzlama + (≥3 oyda) extremization.
// Bağımsız tahminlerin agregasyonu varyansı düşürür, kalibrasyonu artırır.

export interface WeightedVote {
  p: number;
  weight: number;
}

export interface AggResult {
  p: number;
  method: 'single' | 'mean-logit' | 'extremized-logit' | 'none';
}

const EPS = 1e-3;
const clamp = (p: number) => Math.min(1 - EPS, Math.max(EPS, p));
const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function aggregate(votes: WeightedVote[]): AggResult {
  const valid = votes.filter((v) => Number.isFinite(v.p) && v.weight > 0);
  if (valid.length === 0) return { p: 0.5, method: 'none' };
  if (valid.length === 1) return { p: clamp(valid[0].p), method: 'single' };

  const totalW = valid.reduce((a, v) => a + v.weight, 0);
  const meanLogit =
    valid.reduce((a, v) => a + v.weight * logit(clamp(v.p)), 0) / totalW;

  // ≥3 bağımsız oy → hafif extremization (kalabalığın bilgeliğini keskinleştir).
  const factor = valid.length >= 3 ? 1.5 : 1.0;
  return {
    p: clamp(sigmoid(meanLogit * factor)),
    method: factor > 1 ? 'extremized-logit' : 'mean-logit',
  };
}

/** Düşük Brier → yüksek ağırlık. Geçmiş yoksa naif 0.25 varsayılır. */
export function brierWeight(meanBrier: number | undefined | null): number {
  const b = meanBrier == null ? 0.25 : meanBrier;
  return 1 / (b + 0.05);
}
