import assert from 'node:assert/strict';
import test from 'node:test';
import { PredictionsRepository } from './predictions.repository';

test('vadesi gelen işler SKIP LOCKED ile atomik claim edilir', async () => {
  let sql = '';
  let params: unknown[] = [];
  const repository = new PredictionsRepository({
    transaction: async (work: (client: object) => Promise<unknown>) =>
      work({
        query: async (text: string, values: unknown[]) => {
          sql = text;
          params = values;
          return { rows: [] };
        },
      }),
  } as never);

  await repository.claimDue(12, 9);

  assert.match(sql, /FOR UPDATE SKIP LOCKED/);
  assert.match(sql, /resolution_claim_token/);
  assert.equal(params[0], 12);
  assert.equal(params[1], 9);
  assert.equal(typeof params[2], 'string');
});

test('revizyon bağlama iki güncellemeyi aynı transaction içinde yapar', async () => {
  const statements: string[] = [];
  let transactionCount = 0;
  const repository = new PredictionsRepository({
    transaction: async (work: (client: object) => Promise<unknown>) => {
      transactionCount++;
      return work({
        query: async (text: string) => {
          statements.push(text);
          return { rows: [], rowCount: text.startsWith('SELECT') ? 2 : 1 };
        },
      });
    },
  } as never);

  await repository.linkRevision('new', 'lineage', 'old');

  assert.equal(transactionCount, 1);
  assert.match(statements[0], /FOR UPDATE/);
  assert.match(statements[1], /lineage_id/);
  assert.match(statements[2], /superseded_by/);
});

test('claim tokenı eşleşmeyen çözümleme sonucu kabul edilmez', async () => {
  let sql = '';
  let params: unknown[] = [];
  const repository = new PredictionsRepository({
    query: async (text: string, values: unknown[]) => {
      sql = text;
      params = values;
      return [];
    },
  } as never);

  const completed = await repository.completeClaimedResolution(
    'prediction-1',
    'claim-1',
    true,
    0.04,
    0.2,
    { test: true },
  );

  assert.equal(completed, false);
  assert.match(sql, /resolution_claim_token = \$6/);
  assert.equal(params[5], 'claim-1');
});
