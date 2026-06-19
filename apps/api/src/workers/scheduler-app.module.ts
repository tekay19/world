import { Module } from '@nestjs/common';
import { AppModule } from '../app.module';
import { SchedulersModule } from './schedulers.module';

@Module({ imports: [AppModule, SchedulersModule] })
export class SchedulerAppModule {}
