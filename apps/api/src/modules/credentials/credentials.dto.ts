import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { PROVIDERS, ProviderId } from '../llm/llm.types';

// Tek kaynak: PROVIDERS kayıt defterinden türet (yeni sağlayıcı eklenince otomatik).
const PROVIDER_IDS = Object.keys(PROVIDERS);

export class SaveLlmDto {
  @IsIn(PROVIDER_IDS)
  provider!: ProviderId;

  @IsOptional()
  @IsString()
  model?: string;

  @IsString()
  @MinLength(8)
  apiKey!: string;
}

export class TestLlmDto {
  @IsIn(PROVIDER_IDS)
  provider!: ProviderId;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;
}

export class ModelsLlmDto {
  @IsIn(PROVIDER_IDS)
  provider!: ProviderId;

  @IsOptional()
  @IsString()
  apiKey?: string;
}
