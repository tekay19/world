import { join } from 'node:path';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import IORedis from 'ioredis';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { CryptoModule } from './security/crypto.module';
import { HealthModule } from './modules/health/health.module';
import { CountriesModule } from './modules/countries/countries.module';
import { GlobeModule } from './modules/globe/globe.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { EmbeddingModule } from './modules/embedding/embedding.module';
import { SignalsModule } from './modules/signals/signals.module';
import { StructuralModule } from './modules/structural/structural.module';
import { CredentialsModule } from './modules/credentials/credentials.module';
import { PredictionsModule } from './modules/predictions/predictions.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { RolesGuard } from './modules/auth/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      // .env repo kökünde tutulur; nest start cwd'si apps/api olduğundan kökü de aday ver.
      envFilePath: [
        join(process.cwd(), '.env'),
        join(process.cwd(), '..', '..', '.env'),
      ],
    }),

    // Temel rate limit. APP_GUARD aşağıda tüm HTTP uçlarına uygular.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),

    // BullMQ — Redis bağlantısı (worker'lar için maxRetriesPerRequest: null şart).
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: new IORedis(config.getOrThrow<string>('REDIS_URL'), {
          maxRetriesPerRequest: null,
        }),
      }),
    }),

    DatabaseModule,
    CryptoModule,
    AuthModule,

    HealthModule,
    CountriesModule,
    GlobeModule,
    IngestionModule,
    EmbeddingModule,
    SignalsModule,
    StructuralModule,
    CredentialsModule,
    PredictionsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
