import assert from 'node:assert/strict';
import test from 'node:test';
import { poolMaxForProcess } from './pg.service';

test('pool boyutu süreç rolüne göre güvenli bir varsayılan kullanır', () => {
  assert.equal(poolMaxForProcess('api', 1), 10);
  assert.equal(poolMaxForProcess('worker', 1), 10);
  assert.equal(poolMaxForProcess('scheduler', 1), 2);
});

test('replika sayısı arttığında rol bütçesi süreçlere bölünür', () => {
  assert.equal(poolMaxForProcess('api', 8), 5);
  assert.equal(poolMaxForProcess('worker', 10), 3);
  assert.equal(poolMaxForProcess('scheduler', 10), 1);
});

test('açık PG_POOL_MAX değeri otomatik hesabı geçersiz kılar', () => {
  assert.equal(poolMaxForProcess('api', 20, 7), 7);
});
