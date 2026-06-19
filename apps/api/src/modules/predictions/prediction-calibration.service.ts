import { Injectable } from '@nestjs/common';
import { PredictionsRepository } from './predictions.repository';

const clampP = (p: number) => Math.min(0.999, Math.max(0.001, p));

@Injectable()
export class PredictionCalibrationService {
  constructor(private readonly repo: PredictionsRepository) {}

  async calculate(filters: {
    model?: string;
    topic?: string;
    scope?: string;
    sinceDays?: number;
  }) {
    const rows = await this.repo.resolvedRows(filters);
    if (rows.length === 0) {
      return {
        count: 0,
        meanBrier: null,
        meanLogScore: null,
        baseline: { halfAlways: 0.25, baseRate: null },
        observedFreq: null,
        verdict: 'Yetersiz veri (soğuk başlangıç). Önce tahminler çözülmeli.',
        buckets: [],
        byModel: [],
        byTopic: [],
      };
    }

    const outcome = (row: { outcome: boolean }) => (row.outcome ? 1 : 0);
    const mean = (values: number[]) =>
      values.reduce((sum, value) => sum + value, 0) / values.length;
    const observedFreq = mean(rows.map(outcome));
    const meanBrier = mean(
      rows.map((row) => (row.probability - outcome(row)) ** 2),
    );
    const meanLogScore = mean(
      rows.map((row) => {
        const probability = clampP(row.probability);
        return -Math.log(row.outcome ? probability : 1 - probability);
      }),
    );
    const meanBrierHalf = mean(
      rows.map((row) => (0.5 - outcome(row)) ** 2),
    );
    const meanBrierBase = mean(
      rows.map(
        (row) => ((row.base_rate ?? observedFreq) - outcome(row)) ** 2,
      ),
    );

    const buckets = Array.from({ length: 10 }, (_, index) => {
      const lo = index / 10;
      const hi = (index + 1) / 10;
      const members = rows.filter(
        (row) =>
          row.probability >= lo &&
          (index === 9 ? row.probability <= hi : row.probability < hi),
      );
      return {
        lo,
        hi,
        predicted: members.length
          ? mean(members.map((row) => row.probability))
          : null,
        observed: members.length ? mean(members.map(outcome)) : null,
        n: members.length,
      };
    });

    const groupBy = (key: 'model' | 'topic') => {
      const groups = new Map<string, number[]>();
      for (const row of rows) {
        const name = (row[key] as string | null) ?? '—';
        const values = groups.get(name) ?? [];
        values.push((row.probability - outcome(row)) ** 2);
        groups.set(name, values);
      }
      return [...groups.entries()]
        .map(([key, values]) => ({
          key,
          count: values.length,
          meanBrier: mean(values),
        }))
        .sort((left, right) => left.meanBrier - right.meanBrier);
    };

    const beatsHalf = meanBrier < meanBrierHalf;
    const beatsBase = meanBrier <= meanBrierBase;
    const verdict =
      beatsHalf && beatsBase
        ? 'Naif çizgilerden (0.5 ve taban oran) ölçülebilir biçimde iyi.'
        : beatsHalf
          ? '0.5-her-zaman çizgisini geçiyor ama taban orandan iyi değil.'
          : 'Henüz naif çizgilerden iyi değil — daha fazla çözülmüş tahmin/recalibration gerek.';

    return {
      count: rows.length,
      meanBrier,
      meanLogScore,
      baseline: { halfAlways: meanBrierHalf, baseRate: meanBrierBase },
      observedFreq,
      verdict,
      buckets,
      byModel: groupBy('model'),
      byTopic: groupBy('topic'),
    };
  }
}
