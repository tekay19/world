import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CountryCandidate,
  detectCountryMentions,
} from './country-tagging.service';

const countries: CountryCandidate[] = [
  { id: '1', iso2: 'TR', name: 'Turkey', name_tr: 'Türkiye' },
  { id: '2', iso2: 'DE', name: 'Germany', name_tr: 'Almanya' },
  { id: '3', iso2: 'US', name: 'United States', name_tr: 'Amerika Birleşik Devletleri' },
];

test('Türk kaynaklı Almanya haberi kaynak yerine Almanya ile etiketlenir', () => {
  assert.deepEqual(
    detectCountryMentions('Almanya seçim sonuçlarını açıkladı', countries, 'TR'),
    [{ countryId: '2', confidence: 0.95, method: 'name-match' }],
  );
});

test('uluslararası kaynak açık ülke adı içeriyorsa ülkeye bağlanır', () => {
  assert.deepEqual(
    detectCountryMentions('Turkey and the United States opened talks', countries, null),
    [
      { countryId: '1', confidence: 0.95, method: 'name-match' },
      { countryId: '3', confidence: 0.95, method: 'name-match' },
    ],
  );
});

test('açık ülke adı yoksa kaynak ülkesi yalnız düşük güvenli fallback olur', () => {
  assert.deepEqual(detectCountryMentions('Merkez bankası faiz kararını açıkladı', countries, 'TR'), [
    { countryId: '1', confidence: 0.35, method: 'source-fallback' },
  ]);
});
