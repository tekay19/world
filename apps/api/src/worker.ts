import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerAppModule } from './workers/worker-app.module';

async function bootstrap(): Promise<void> {
  process.env.PROCESS_ROLE = 'worker';
  const app = await NestFactory.createApplicationContext(WorkerAppModule);
  app.enableShutdownHooks();
  new Logger('WorkerBootstrap').log('BullMQ worker süreçleri hazır');
}

void bootstrap();
