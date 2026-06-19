import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { CredentialsController } from './credentials.controller';
import { CredentialsRepository } from './credentials.repository';
import { CredentialsService } from './credentials.service';

@Module({
  imports: [LlmModule],
  controllers: [CredentialsController],
  providers: [CredentialsRepository, CredentialsService],
  exports: [CredentialsService],
})
export class CredentialsModule {}
