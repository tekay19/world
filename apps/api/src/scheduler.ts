import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SchedulerAppModule } from './workers/scheduler-app.module';

async function bootstrap(): Promise<void> {
  process.env.PROCESS_ROLE = 'scheduler';
  const app = await NestFactory.createApplicationContext(SchedulerAppModule);
  app.enableShutdownHooks();
  new Logger('SchedulerBootstrap').log('Tekrarlayan BullMQ işleri kaydedildi');
}

void bootstrap();
