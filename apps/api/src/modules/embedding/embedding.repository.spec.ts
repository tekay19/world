import assert from 'node:assert/strict';
import test from 'node:test';
import { EmbeddingRepository } from './embedding.repository';

test('tahmin RAG sorgusu kullanıcı sahipliğiyle sınırlandırılır', async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const repository = new EmbeddingRepository({
    query: async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return [];
    },
  } as never);

  await repository.similarPastPredictions('user-1', [0.1, 0.2], 5);

  assert.match(calls[0].sql, /p\.owner_user_id = \$1/);
  assert.equal(calls[0].params[0], 'user-1');
});
