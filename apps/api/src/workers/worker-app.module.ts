import { Module } from '@nestjs/common';
import { AppModule } from '../app.module';
import { ProcessorsModule } from './processors.module';

@Module({ imports: [AppModule, ProcessorsModule] })
export class WorkerAppModule {}
