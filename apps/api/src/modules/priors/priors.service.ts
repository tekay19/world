import { Injectable, Logger } from '@nestjs/common';
import { ManifoldClient } from './manifold.client';
import { MetaculusClient } from './metaculus.client';

export interface ExternalPrior {
  source: 'manifold' | 'metaculus';
  question: string;
  probability: number | null; // 0..1
  url: string;
}

/**
 * Faz 2 — dış priorlar: tahmin piyasaları + topluluk tahminleri.
 * Tahminlerimizi bağımsız bir referansa çapalar (model aşırı-güvenini dengeler).
 * Her kaynak graceful (anahtar yok/hata → atlanır).
 */
@Injectable()
export class PriorsService {
  private readonly logger = new Logger(PriorsService.name);

  constructor(
    private readonly manifold: ManifoldClient,
    private readonly metaculus: MetaculusClient,
  ) {}

  /** Ülke (+odak) için ilgili dış priorlar. countryName İNGİLİZCE olmalı (platformlar EN). */
  async forContext(
    countryName: string,
    focusText: string,
  ): Promise<ExternalPrior[]> {
    const term = `${countryName} ${focusText}`.trim();
    const [man, met] = await Promise.all([
      this.manifold.search(term, 6).catch((e) => {
        this.logger.warn(`Manifold hata: ${(e as Error).message}`);
        return [];
      }),
      this.metaculus.search(term, 5).catch((e) => {
        this.logger.warn(`Metaculus hata: ${(e as Error).message}`);
        return [];
      }),
    ]);

    const out: ExternalPrior[] = [
      ...man.map((m) => ({ source: 'manifold' as const, ...m })),
      ...met.map((m) => ({ source: 'metaculus' as const, ...m })),
    ];
    // Olasılığı olanları öne al (daha güçlü çapa), sonra sınırla.
    out.sort(
      (a, b) => (b.probability != null ? 1 : 0) - (a.probability != null ? 1 : 0),
    );
    return out.slice(0, 8);
  }
}
