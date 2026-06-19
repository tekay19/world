import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ProviderId } from '../llm/llm.types';
import { CATEGORY_IDS } from '../llm/prediction.prompt';

const PROVIDER_IDS = ['openai', 'anthropic', 'gemini', 'kimi', 'nvidia'];

export class GeneratePredDto {
  @IsOptional()
  @IsIn(['domestic', 'foreign', 'both'])
  scope?: 'domestic' | 'foreign' | 'both';

  @IsOptional()
  @IsIn(PROVIDER_IDS)
  provider?: ProviderId;

  @IsOptional()
  @IsIn([...CATEGORY_IDS])
  category?: string;
}

export class ResolveDto {
  @IsBoolean()
  outcome!: boolean;
}

export class AskDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  question!: string;

  @IsOptional()
  @IsArray()
  history?: Array<{ q: string; a: string }>;
}

export class GenerateScenarioDto {
  @IsOptional()
  @IsIn([...CATEGORY_IDS])
  category?: string;

  // Ufuk (gün). Varsayılan 5 yıl (1825). 180–3650 arası.
  @IsOptional()
  @IsInt()
  @Min(180)
  @Max(3650)
  horizonDays?: number;
}
