import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CredentialsService,
  DecryptedCredential,
} from '../credentials/credentials.service';
import { LlmCoreService } from '../llm/llm.service';
import { buildJudgeMessages, parseJudge } from '../llm/prediction.prompt';
import { SignalsService } from '../signals/signals.service';
import { PredictionContextService } from './prediction-context.service';
import {
  PredictionRow,
  PredictionsRepository,
} from './predictions.repository';

const clampP = (p: number) => Math.min(0.999, Math.max(0.001, p));

@Injectable()
export class PredictionResolutionService {
  private readonly logger = new Logger(PredictionResolutionService.name);

  constructor(
    private readonly repo: PredictionsRepository,
    private readonly creds: CredentialsService,
    private readonly llm: LlmCoreService,
    private readonly signals: SignalsService,
    private readonly context: PredictionContextService,
  ) {}

  async resolveDue(): Promise<{
    due: number;
    resolved: number;
    manualPending: number;
    metricPending: number;
    noKey: number;
    undecidable: number;
    errors: number;
  }> {
    const due = await this.repo.claimDue(50);
    const credentialCache = new Map<string, DecryptedCredential | null>();
    const out = {
      due: due.length,
      resolved: 0,
      manualPending: 0,
      metricPending: 0,
      noKey: 0,
      undecidable: 0,
      errors: 0,
    };

    for (const prediction of due) {
      const claimToken = prediction.resolution_claim_token;
      if (!claimToken) {
        out.errors++;
        continue;
      }
      const release = () =>
        this.repo.releaseResolutionClaim(prediction.id, claimToken);
      const source = prediction.resolution_source ?? 'llm-judge';

      if (source === 'manual') {
        out.manualPending++;
        await release();
        continue;
      }

      if (source === 'metric') {
        const metricKey = prediction.metric_key;
        const method = (prediction.method ?? {}) as {
          metric_op?: string;
          metric_threshold?: number;
        };
        const threshold =
          typeof method.metric_threshold === 'number'
            ? method.metric_threshold
            : null;
        const op = method.metric_op ?? '>';
        if (!metricKey || threshold == null) {
          out.metricPending++;
          await release();
          continue;
        }
        const point = await this.signals.latest(metricKey);
        if (!point) {
          out.metricPending++;
          await release();
          continue;
        }
        const outcome =
          op === '<'
            ? point.value < threshold
            : op === '<='
              ? point.value <= threshold
              : op === '>='
                ? point.value >= threshold
                : point.value > threshold;
        const probability = clampP(prediction.probability ?? 0.5);
        const observed = outcome ? 1 : 0;
        const completed = await this.repo.completeClaimedResolution(
          prediction.id,
          claimToken,
          outcome,
          (probability - observed) ** 2,
          -Math.log(outcome ? probability : 1 - probability),
          {
            metric: {
              metric_key: metricKey,
              op,
              threshold,
              observed: point.value,
              source: point.source,
            },
            resolved_at: new Date().toISOString(),
          },
        );
        if (completed) out.resolved++;
        else out.errors++;
        continue;
      }

      let credential: DecryptedCredential | null = null;
      if (prediction.owner_user_id) {
        if (!credentialCache.has(prediction.owner_user_id)) {
          credentialCache.set(
            prediction.owner_user_id,
            await this.creds.getLatestDecrypted(prediction.owner_user_id),
          );
        }
        credential = credentialCache.get(prediction.owner_user_id) ?? null;
      }
      if (!credential) {
        out.noKey++;
        await release();
        continue;
      }

      try {
        const items = await this.context.itemsFor(prediction.iso2);
        const raw = await this.llm.chat(
          credential.provider,
          credential.apiKey,
          buildJudgeMessages({
            question: prediction.question,
            criteria: prediction.resolution_criteria ?? prediction.question,
            asOf: new Date().toISOString(),
            items,
          }),
          {
            model:
              credential.model || this.llm.defaultModel(credential.provider),
            jsonMode: true,
            temperature: 0,
            maxTokens: 4096,
            reasoningEffort: 'high',
          },
        );
        const judge = parseJudge(raw);
        if (!judge.decidable) {
          out.undecidable++;
          await release();
          continue;
        }
        const probability = clampP(prediction.probability ?? 0.5);
        const observed = judge.outcome ? 1 : 0;
        const completed = await this.repo.completeClaimedResolution(
          prediction.id,
          claimToken,
          judge.outcome,
          (probability - observed) ** 2,
          -Math.log(judge.outcome ? probability : 1 - probability),
          {
            judge,
            judged_at: new Date().toISOString(),
            judged_by: `${credential.provider}/${credential.model ?? ''}`,
          },
        );
        if (completed) out.resolved++;
        else out.errors++;
      } catch (error) {
        out.errors++;
        await release().catch((releaseError) =>
          this.logger.warn(
            `Claim bırakılamadı (id=${prediction.id}): ${(releaseError as Error).message}`,
          ),
        );
        this.logger.warn(
          `Çözümleme hatası (id=${prediction.id}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return out;
  }

  async manualResolve(
    id: string,
    outcome: boolean,
  ): Promise<PredictionRow | null> {
    const prediction = await this.repo.findById(id);
    if (!prediction) throw new NotFoundException(`Tahmin bulunamadı: ${id}`);
    if (prediction.resolved) {
      throw new BadRequestException('Bu tahmin zaten çözüldü.');
    }
    const probability = clampP(prediction.probability ?? 0.5);
    const observed = outcome ? 1 : 0;
    const resolved = await this.repo.resolveManual(
      id,
      outcome,
      (probability - observed) ** 2,
      -Math.log(outcome ? probability : 1 - probability),
      {
        manual: true,
        resolved_by: 'operator',
        resolved_at: new Date().toISOString(),
      },
    );
    if (!resolved) throw new BadRequestException('Bu tahmin zaten çözüldü.');
    return this.repo.findById(id);
  }
}
