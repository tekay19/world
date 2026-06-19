import { Module } from '@nestjs/common';
import { LlmCoreService } from './llm.service';

/** Durumsuz LLM çekirdeği (sağlayıcı soyutlaması). Anahtar saklamaz. */
@Module({
  providers: [LlmCoreService],
  exports: [LlmCoreService],
})
export class LlmModule {}
