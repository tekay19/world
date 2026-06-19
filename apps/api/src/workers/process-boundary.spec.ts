import assert from 'node:assert/strict';
import test from 'node:test';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { APP_GUARD } from '@nestjs/core';
import { AppModule } from '../app.module';
import { EmbeddingModule } from '../modules/embedding/embedding.module';
import { IngestionModule } from '../modules/ingestion/ingestion.module';
import { PredictionsModule } from '../modules/predictions/predictions.module';
import { SignalsModule } from '../modules/signals/signals.module';
import { StructuralModule } from '../modules/structural/structural.module';
import { ProcessorsModule } from './processors.module';

const providerNames = (module: object): string[] =>
  ((Reflect.getMetadata(MODULE_METADATA.PROVIDERS, module) ?? []) as Array<{
    name?: string;
  }>).map((provider) => provider.name ?? '');

test('HTTP özellik modülleri BullMQ processor barındırmaz', () => {
  for (const module of [
    IngestionModule,
    EmbeddingModule,
    SignalsModule,
    StructuralModule,
    PredictionsModule,
  ]) {
    assert.equal(providerNames(module).some((name) => name.endsWith('Processor')), false);
  }
});

test('processorlar yalnız worker modülünde kayıtlıdır', () => {
  assert.deepEqual(providerNames(ProcessorsModule).sort(), [
    'EmbeddingProcessor',
    'IngestionProcessor',
    'PredictionsProcessor',
    'SignalsProcessor',
    'StructuralProcessor',
  ]);
});

test('HTTP uygulaması auth ve throttling guardlarını global uygular', () => {
  const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AppModule) ?? []) as Array<{
    provide?: unknown;
    useClass?: { name?: string };
  }>;
  const guards = providers
    .filter((provider) => provider.provide === APP_GUARD)
    .map((provider) => provider.useClass?.name)
    .sort();
  assert.deepEqual(guards, ['JwtAuthGuard', 'RolesGuard', 'ThrottlerGuard']);
});
