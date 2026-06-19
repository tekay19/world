import { Injectable, Logger } from '@nestjs/common';
import { CredentialsService } from '../credentials/credentials.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { PredictionsRepository } from './predictions.repository';
import { PredictionsService } from './predictions.service';

@Injectable()
export class PredictionLifecycleService {
  private readonly logger = new Logger(PredictionLifecycleService.name);

  constructor(
    private readonly repo: PredictionsRepository,
    private readonly generation: PredictionsService,
    private readonly embedding: EmbeddingService,
    private readonly creds: CredentialsService,
  ) {}

  async repredictCountry(
    userId: string,
    iso2: string,
  ): Promise<{ created: number; matched: number }> {
    const oldActives = await this.repo.activeForLineage(iso2, userId);
    const result = await this.generation.generate(userId, iso2);
    if (!result.created) return { created: 0, matched: 0 };

    let matched = 0;
    if (oldActives.length) {
      const matches = await this.embedding.matchQuestions(
        oldActives.map((prediction) => prediction.question),
        result.predictions.map((prediction) => prediction.question),
      );
      const usedOld = new Set<number>();
      for (let index = 0; index < result.predictions.length; index++) {
        const match = matches[index];
        if (match && match.sim >= 0.82 && !usedOld.has(match.oldIdx)) {
          usedOld.add(match.oldIdx);
          const old = oldActives[match.oldIdx];
          try {
            await this.repo.linkRevision(
              result.predictions[index].id,
              old.lineage_id ?? old.id,
              old.id,
            );
            matched++;
          } catch (error) {
            this.logger.warn(
              `Revizyon bağlama hatası: ${(error as Error).message}`,
            );
          }
        }
      }
    }
    return { created: result.created, matched };
  }

  async repredictStale(): Promise<{
    countries: number;
    created: number;
    matched: number;
  }> {
    const stale = await this.repo.staleActiveCountryIds(24, 3);
    let created = 0;
    let matched = 0;
    for (const country of stale) {
      try {
        const credential = await this.creds.getLatestDecrypted(
          country.owner_user_id,
        );
        if (!credential) continue;
        const result = await this.repredictCountry(
          country.owner_user_id,
          country.iso2,
        );
        created += result.created;
        matched += result.matched;
      } catch (error) {
        this.logger.warn(
          `Yeniden-tahmin hatası (${country.iso2}): ${(error as Error).message}`,
        );
      }
    }
    return { countries: stale.length, created, matched };
  }

  async history(id: string) {
    const lineage = await this.repo.lineageOf(id);
    if (!lineage) return [];
    return this.repo.historyByLineage(lineage);
  }
}
