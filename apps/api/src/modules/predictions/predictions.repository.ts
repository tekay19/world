import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prediction } from '@dunya/contracts';
import { PgService } from '../../database/pg.service';

export interface PredictionRow extends Prediction {
  id: string;
  owner_user_id: string | null;
  country_id: string;
  scope: string | null;
  question: string;
  probability: number | null;
  prob_low: number | null;
  prob_high: number | null;
  confidence: string | null;
  rationale: string | null;
  topic: string | null;
  base_rate: number | null;
  model: string | null;
  resolution_criteria: string | null;
  resolution_source: string | null;
  metric_key: string | null;
  method: Record<string, unknown> | null;
  horizon: string | null;
  generated_at: string;
  resolve_at: string;
  resolved: boolean;
  outcome: boolean | null;
  brier: number | null;
  log_score: number | null;
  resolved_at: string | null;
  counter_argument: string | null;
  aggregation: string | null;
  model_count: number | null;
  prob_pre_devil: number | null;
  resolution_claimed_at: string | null;
  resolution_claim_token: string | null;
}

export interface PredictionWithIso extends PredictionRow {
  iso2: string;
}

export interface NewPrediction {
  ownerUserId: string;
  countryId: string;
  scope: string;
  question: string;
  probability: number;
  probLow: number | null;
  probHigh: number | null;
  confidence: string;
  rationale: string;
  topic: string;
  baseRate: number | null;
  model: string;
  resolutionCriteria: string;
  resolutionSource: string;
  metricKey: string | null;
  method: Record<string, unknown> | null;
  horizon: string;
  resolveAt: Date;
  analysisId: string | null;
  counterArgument: string | null;
  aggregation: string;
  modelCount: number;
  probPreDevil: number | null;
}

export interface ResolvedRow {
  probability: number;
  base_rate: number | null;
  outcome: boolean;
  model: string | null;
  topic: string | null;
  scope: string | null;
}

export interface ScenarioSetRow {
  id: string;
  owner_user_id: string | null;
  country_id: string;
  topic: string | null;
  horizon: string | null;
  horizon_days: number | null;
  question: string;
  title: string | null;
  framing: string | null;
  thesis: string | null;
  sections: unknown;
  scenarios: unknown;
  uncertainty: string | null;
  bottom_line: string | null;
  key_questions: unknown;
  confidence: string | null;
  sources: unknown;
  model: string | null;
  method: Record<string, unknown> | null;
  as_of: string | null;
  created_at: string;
}

export interface NewScenarioReport {
  ownerUserId: string;
  countryId: string;
  topic: string | null;
  horizon: string;
  horizonDays: number;
  title: string;
  framing: string;
  thesis: string;
  sections: unknown;
  scenarios: unknown;
  uncertainty: string;
  bottomLine: string;
  keyQuestions: unknown;
  confidence: string;
  sources: unknown;
  model: string;
  method: Record<string, unknown> | null;
  asOf: Date;
}

@Injectable()
export class PredictionsRepository {
  constructor(private readonly pg: PgService) {}

  async insert(p: NewPrediction): Promise<PredictionRow | null> {
    return this.pg.transaction(async (client) => {
      const result = await client.query<PredictionRow>(
        `INSERT INTO predictions
         (owner_user_id, country_id, scope, question, probability, prob_low, prob_high, confidence,
          rationale, topic, base_rate, model, resolution_criteria, resolution_source,
          metric_key, method, horizon, resolve_at, analysis_id,
          counter_argument, aggregation, model_count, prob_pre_devil)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
       RETURNING *`,
        [
          p.ownerUserId,
          p.countryId,
          p.scope,
          p.question,
          p.probability,
          p.probLow,
          p.probHigh,
          p.confidence,
          p.rationale,
          p.topic,
          p.baseRate,
          p.model,
          p.resolutionCriteria,
          p.resolutionSource,
          p.metricKey,
          p.method ? JSON.stringify(p.method) : null,
          p.horizon,
          p.resolveAt,
          p.analysisId,
          p.counterArgument,
          p.aggregation,
          p.modelCount,
          p.probPreDevil,
        ],
      );
      const row = result.rows[0] ?? null;
      if (row) {
        await client.query(
          `UPDATE predictions
              SET lineage_id = id
            WHERE id = $1 AND lineage_id IS NULL`,
          [row.id],
        );
      }
      return row;
    });
  }

  findById(id: string): Promise<PredictionRow | null> {
    return this.pg.queryOne<PredictionRow>(
      `SELECT * FROM predictions WHERE id = $1`,
      [id],
    );
  }

  /** Tek tahmini sil (oylar + süpersede referansları FK-güvenli temizlenir;
   *  prediction_embeddings ON DELETE CASCADE ile düşer). */
  async deleteById(id: string): Promise<void> {
    await this.pg.transaction(async (c) => {
      await c.query('DELETE FROM prediction_votes WHERE prediction_id = $1', [id]);
      await c.query(
        'UPDATE predictions SET superseded_by = NULL WHERE superseded_by = $1',
        [id],
      );
      await c.query('DELETE FROM predictions WHERE id = $1', [id]);
    });
  }

  /** Bir ülkenin TÜM tahminlerini sil. Döndürdüğü sayı silinen tahmin adedi. */
  async deleteByCountry(iso2: string): Promise<number> {
    const code = iso2.toUpperCase();
    return this.pg.transaction(async (c) => {
      const res = await c.query<{ id: string }>(
        `SELECT p.id FROM predictions p
           JOIN countries co ON co.id = p.country_id
          WHERE co.iso2 = $1`,
        [code],
      );
      const idList = res.rows.map((r) => r.id);
      if (idList.length === 0) return 0;
      await c.query('DELETE FROM prediction_votes WHERE prediction_id = ANY($1)', [
        idList,
      ]);
      await c.query(
        'UPDATE predictions SET superseded_by = NULL WHERE superseded_by = ANY($1)',
        [idList],
      );
      await c.query('DELETE FROM predictions WHERE id = ANY($1)', [idList]);
      return idList.length;
    });
  }

  listActiveByIso(iso2: string, ownerUserId: string): Promise<PredictionRow[]> {
    return this.pg.query<PredictionRow>(
      `SELECT p.* FROM predictions p
         JOIN countries c ON c.id = p.country_id
        WHERE c.iso2 = $1 AND p.owner_user_id = $2
          AND p.resolved = FALSE AND p.superseded_by IS NULL
        ORDER BY p.resolve_at ASC`,
      [iso2.toUpperCase(), ownerUserId],
    );
  }

  /**
   * Madde 4 — gerçek taban oran: topic+scope referans sınıfında çözülmüş
   * tahminlerin gerçekleşme oranı + örneklem. n düşükse çağıran "yetersiz" sayar.
   */
  async baseRateByTopicScope(
    topic: string | null,
    scope: string | null,
  ): Promise<{ rate: number | null; n: number }> {
    const where: string[] = ['resolved = TRUE', 'outcome IS NOT NULL'];
    const params: unknown[] = [];
    if (topic) {
      params.push(topic);
      where.push(`topic = $${params.length}`);
    }
    if (scope) {
      params.push(scope);
      where.push(`scope = $${params.length}`);
    }
    const row = await this.pg.queryOne<{ rate: number | null; n: number }>(
      `SELECT AVG(CASE WHEN outcome THEN 1.0 ELSE 0.0 END)::float8 AS rate,
              COUNT(*)::int AS n
         FROM predictions WHERE ${where.join(' AND ')}`,
      params,
    );
    return { rate: row?.rate ?? null, n: row?.n ?? 0 };
  }

  /** Madde 6 — eskimiş aktif tahmini olan ülkeler (yeniden-tahmin adayları). */
  staleActiveCountryIds(
    maxAgeHours: number,
    limit: number,
  ): Promise<Array<{ iso2: string; country_id: string; owner_user_id: string }>> {
    return this.pg.query(
      `SELECT DISTINCT c.iso2, p.country_id, p.owner_user_id
         FROM predictions p JOIN countries c ON c.id = p.country_id
        WHERE p.resolved = FALSE AND p.superseded_by IS NULL
          AND p.owner_user_id IS NOT NULL
          AND p.generated_at < now() - make_interval(hours => $1)
        LIMIT $2`,
      [maxAgeHours, limit],
    );
  }

  /**
   * Vadesi gelen işleri atomik olarak sahiplenir. Süresi dolmuş claim'ler, worker
   * beklenmedik biçimde kapanırsa yeniden alınabilir.
   */
  claimDue(limit = 50, leaseMinutes = 15): Promise<PredictionWithIso[]> {
    const claimToken = randomUUID();
    return this.pg.transaction(async (client) => {
      const result = await client.query<PredictionWithIso>(
        `WITH candidates AS (
           SELECT p.id
             FROM predictions p
            WHERE p.resolved = FALSE
              AND p.superseded_by IS NULL
              AND p.resolve_at <= now()
              AND (
                p.resolution_claimed_at IS NULL OR
                p.resolution_claimed_at < now() - make_interval(mins => $2)
              )
            ORDER BY p.resolve_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT $1
         )
         UPDATE predictions p
            SET resolution_claimed_at = now(), resolution_claim_token = $3
           FROM candidates c
          WHERE p.id = c.id
         RETURNING p.*,
           (SELECT iso2 FROM countries WHERE id = p.country_id) AS iso2`,
        [limit, leaseMinutes, claimToken],
      );
      return result.rows;
    });
  }

  async completeClaimedResolution(
    id: string,
    claimToken: string,
    outcome: boolean,
    brier: number,
    logScore: number,
    method: Record<string, unknown>,
  ): Promise<boolean> {
    const rows = await this.pg.query<{ id: string }>(
      `UPDATE predictions
          SET resolved = TRUE, outcome = $2, brier = $3, log_score = $4,
              resolved_at = now(),
              method = COALESCE(method, '{}'::jsonb) || $5::jsonb,
              resolution_claimed_at = NULL, resolution_claim_token = NULL
        WHERE id = $1 AND resolved = FALSE AND resolution_claim_token = $6
        RETURNING id`,
      [id, outcome, brier, logScore, JSON.stringify(method), claimToken],
    );
    return rows.length === 1;
  }

  async releaseResolutionClaim(id: string, claimToken: string): Promise<void> {
    await this.pg.query(
      `UPDATE predictions
          SET resolution_claimed_at = NULL, resolution_claim_token = NULL
        WHERE id = $1 AND resolution_claim_token = $2 AND resolved = FALSE`,
      [id, claimToken],
    );
  }

  async resolveManual(
    id: string,
    outcome: boolean,
    brier: number,
    logScore: number,
    method: Record<string, unknown>,
  ): Promise<boolean> {
    const rows = await this.pg.query<{ id: string }>(
      `UPDATE predictions
          SET resolved = TRUE, outcome = $2, brier = $3, log_score = $4,
              resolved_at = now(),
              method = COALESCE(method, '{}'::jsonb) || $5::jsonb,
              resolution_claimed_at = NULL, resolution_claim_token = NULL
        WHERE id = $1 AND resolved = FALSE
        RETURNING id`,
      [id, outcome, brier, logScore, JSON.stringify(method)],
    );
    return rows.length === 1;
  }

  /** Kalibrasyon için çözülmüş tahminler (filtreli). */
  resolvedRows(filters: {
    model?: string;
    topic?: string;
    scope?: string;
    sinceDays?: number;
  }): Promise<ResolvedRow[]> {
    const where: string[] = ['resolved = TRUE', 'outcome IS NOT NULL', 'probability IS NOT NULL'];
    const params: unknown[] = [];
    if (filters.model) {
      params.push(filters.model);
      where.push(`model = $${params.length}`);
    }
    if (filters.topic) {
      params.push(filters.topic);
      where.push(`topic = $${params.length}`);
    }
    if (filters.scope) {
      params.push(filters.scope);
      where.push(`scope = $${params.length}`);
    }
    if (filters.sinceDays) {
      params.push(filters.sinceDays);
      where.push(`resolved_at >= now() - ($${params.length} || ' days')::interval`);
    }
    return this.pg.query<ResolvedRow>(
      `SELECT probability, base_rate, outcome, model, topic, scope
         FROM predictions
        WHERE ${where.join(' AND ')}`,
      params,
    );
  }

  // --- Faz 3+: zengin senaryo raporu ---
  insertScenarioReport(s: NewScenarioReport): Promise<ScenarioSetRow | null> {
    return this.pg.queryOne<ScenarioSetRow>(
      `INSERT INTO scenario_sets
         (owner_user_id, country_id, topic, horizon, horizon_days, question, title, framing,
          thesis, sections, scenarios, uncertainty, bottom_line, key_questions,
          confidence, sources, model, method, as_of)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,
               $14::jsonb,$15,$16::jsonb,$17,$18::jsonb,$19)
       RETURNING *`,
      [
        s.ownerUserId,
        s.countryId,
        s.topic,
        s.horizon,
        s.horizonDays,
        s.title, // question (NOT NULL) = title
        s.title,
        s.framing,
        s.thesis,
        JSON.stringify(s.sections),
        JSON.stringify(s.scenarios),
        s.uncertainty,
        s.bottomLine,
        JSON.stringify(s.keyQuestions),
        s.confidence,
        JSON.stringify(s.sources),
        s.model,
        s.method ? JSON.stringify(s.method) : null,
        s.asOf,
      ],
    );
  }

  listScenarioSetsByIso(
    iso2: string,
    ownerUserId: string,
  ): Promise<ScenarioSetRow[]> {
    return this.pg.query<ScenarioSetRow>(
      `SELECT s.* FROM scenario_sets s
         JOIN countries c ON c.id = s.country_id
        WHERE c.iso2 = $1 AND s.owner_user_id = $2
        ORDER BY s.created_at DESC
        LIMIT 20`,
      [iso2.toUpperCase(), ownerUserId],
    );
  }

  async deleteScenarioSet(id: string): Promise<void> {
    await this.pg.query('DELETE FROM scenario_sets WHERE id = $1', [id]);
  }

  /** En son senaryo seti maxAgeDays'ten eski olan ülkeler (aylık yenileme adayı). */
  staleScenarioSets(
    maxAgeDays: number,
  ): Promise<
    Array<{
      id: string;
      iso2: string;
      topic: string | null;
      owner_user_id: string;
    }>
  > {
    return this.pg.query(
      `SELECT id, iso2, topic, owner_user_id FROM (
         SELECT DISTINCT ON (s.country_id, s.owner_user_id)
                s.id, c.iso2, s.topic, s.owner_user_id, s.created_at
           FROM scenario_sets s JOIN countries c ON c.id = s.country_id
          ORDER BY s.country_id, s.owner_user_id, s.created_at DESC
       ) t
       WHERE t.created_at < now() - make_interval(days => $1)
         AND t.owner_user_id IS NOT NULL`,
      [maxAgeDays],
    );
  }

  // ----- Sürüklenme takibi (lineage / revizyon zinciri) -----

  /** Bir ülkenin aktif tahminleri (revizyon eşlemesi için soru + lineage). */
  activeForLineage(
    iso2: string,
    ownerUserId: string,
  ): Promise<
    Array<{ id: string; question: string; lineage_id: string | null; probability: number | null }>
  > {
    return this.pg.query(
      `SELECT p.id, p.question, p.lineage_id, p.probability
         FROM predictions p JOIN countries c ON c.id = p.country_id
        WHERE c.iso2 = $1 AND p.owner_user_id = $2
          AND p.resolved = FALSE AND p.superseded_by IS NULL`,
      [iso2.toUpperCase(), ownerUserId],
    );
  }

  /** Yeni tahmini eski lineage'a bağla + eskiyi süpersede et (revizyon). */
  async linkRevision(
    newId: string | number,
    lineageId: string | number,
    oldId: string | number,
  ): Promise<void> {
    await this.pg.transaction(async (client) => {
      await client.query(
        `SELECT id FROM predictions WHERE id = ANY($1) FOR UPDATE`,
        [[newId, oldId]],
      );
      const linked = await client.query(
        `UPDATE predictions SET lineage_id = $2 WHERE id = $1`,
        [newId, lineageId],
      );
      const superseded = await client.query(
        `UPDATE predictions
            SET superseded_by = $2, revision = revision + 1
          WHERE id = $1 AND superseded_by IS NULL`,
        [oldId, newId],
      );
      if (linked.rowCount !== 1 || superseded.rowCount !== 1) {
        throw new Error('Revizyon eşzamanlı olarak değiştirildi veya bulunamadı.');
      }
    });
  }

  /** Bir lineage'ın olasılık geçmişi (en eski → en yeni). */
  historyByLineage(
    lineageId: string | number,
  ): Promise<
    Array<{ probability: number | null; generated_at: string; model: string | null; resolved: boolean }>
  > {
    return this.pg.query(
      `SELECT probability, generated_at, model, resolved
         FROM predictions WHERE lineage_id = $1
        ORDER BY generated_at ASC`,
      [lineageId],
    );
  }

  /** Bir tahminin lineage kökü (history çekmek için). */
  async lineageOf(predictionId: string | number): Promise<string | null> {
    const row = await this.pg.queryOne<{ lineage_id: string | null }>(
      `SELECT lineage_id FROM predictions WHERE id = $1`,
      [predictionId],
    );
    return row?.lineage_id ?? null;
  }
}
