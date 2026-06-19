import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ProgressFn } from './pipeline/progress';
import {
  AskDto,
  GeneratePredDto,
  GenerateScenarioDto,
  ResolveDto,
} from './predictions.dto';
import { PredictionsService } from './predictions.service';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthUser } from '../auth/auth.types';
import { PredictionCalibrationService } from './prediction-calibration.service';
import { PredictionChatService } from './prediction-chat.service';
import { PredictionLifecycleService } from './prediction-lifecycle.service';
import { PredictionResolutionService } from './prediction-resolution.service';
import { PredictionScenarioService } from './prediction-scenario.service';

/**
 * SSE için ihtiyaç duyulan minimal Express yanıt yüzeyi (express tipine bağlanma).
 * @Res() ile enjekte edilen gerçek yanıt nesnesi bunu yapısal olarak karşılar.
 */
interface SseResponse {
  setHeader(name: string, value: string): void;
  write(chunk: string): boolean;
  end(): void;
  flushHeaders?(): void;
}

@Controller()
export class PredictionsController {
  constructor(
    private readonly service: PredictionsService,
    private readonly resolution: PredictionResolutionService,
    private readonly lifecycle: PredictionLifecycleService,
    private readonly chat: PredictionChatService,
    private readonly calibrationService: PredictionCalibrationService,
    private readonly scenariosService: PredictionScenarioService,
  ) {}

  // POST /api/countries/:iso2/predictions/generate/stream → tahmin üret (aşama-SSE)
  @Post('countries/:iso2/predictions/generate/stream')
  generateStream(
    @CurrentUser() user: AuthUser,
    @Param('iso2') iso2: string,
    @Body() dto: GeneratePredDto,
    @Res() res: SseResponse,
  ) {
    return this.runSse(res, (onProgress) =>
      this.service.generate(
        user.id,
        iso2,
        dto.scope ?? 'both',
        dto.provider,
        dto.category,
        onProgress,
      ),
    );
  }

  // GET /api/countries/:iso2/predictions → aktif (çözülmemiş) tahminler
  @Get('countries/:iso2/predictions')
  active(@CurrentUser() user: AuthUser, @Param('iso2') iso2: string) {
    return this.service.listActive(user.id, iso2);
  }

  // GET /api/predictions/calibration → Brier + eğri + naif çizgiler
  @Get('predictions/calibration')
  calibration(
    @Query('model') model?: string,
    @Query('topic') topic?: string,
    @Query('scope') scope?: string,
    @Query('days') days?: string,
  ) {
    return this.calibrationService.calculate({
      model,
      topic,
      scope,
      sinceDays: days ? Number(days) : undefined,
    });
  }

  // POST /api/predictions/:id/resolve { outcome } → manuel çözümleme
  @Post('predictions/:id/resolve')
  @Roles('admin')
  resolve(@Param('id') id: string, @Body() dto: ResolveDto) {
    return this.resolution.manualResolve(id, dto.outcome);
  }

  // POST /api/predictions/resolve-run → çözümleme işini hemen çalıştır (dev/admin)
  @Post('predictions/resolve-run')
  @Roles('admin')
  resolveRun() {
    return this.resolution.resolveDue();
  }

  // POST /api/countries/:iso2/predictions/repredict → yeniden üret + revizyon eşle
  @Post('countries/:iso2/predictions/repredict')
  repredict(@CurrentUser() user: AuthUser, @Param('iso2') iso2: string) {
    return this.lifecycle.repredictCountry(user.id, iso2);
  }

  // GET /api/predictions/:id/history → tahminin olasılık sürüklenme geçmişi
  @Get('predictions/:id/history')
  history(@Param('id') id: string) {
    return this.lifecycle.history(id);
  }

  // POST /api/countries/:iso2/ask { question } → serbest soruya kalibre cevap
  @Post('countries/:iso2/ask')
  ask(
    @CurrentUser() user: AuthUser,
    @Param('iso2') iso2: string,
    @Body() dto: AskDto,
  ) {
    return this.chat.ask(user.id, iso2, dto.question, dto.history);
  }

  // DELETE /api/predictions/:id → tek tahmini sil
  @Delete('predictions/:id')
  @Roles('admin')
  async remove(@Param('id') id: string) {
    await this.service.deletePrediction(id);
    return { deleted: true, id };
  }

  // DELETE /api/countries/:iso2/predictions → ülkenin tüm tahminlerini sil
  @Delete('countries/:iso2/predictions')
  @Roles('admin')
  clear(@Param('iso2') iso2: string) {
    return this.service.clearPredictions(iso2);
  }

  // --- Faz 3: uzun-ufuk senaryo dağılımı ---
  // POST /api/countries/:iso2/scenarios/generate/stream → 5-yıl senaryo (aşama-SSE)
  @Post('countries/:iso2/scenarios/generate/stream')
  generateScenariosStream(
    @CurrentUser() user: AuthUser,
    @Param('iso2') iso2: string,
    @Body() dto: GenerateScenarioDto,
    @Res() res: SseResponse,
  ) {
    return this.runSse(res, (onProgress) =>
      this.scenariosService.generate(
        user.id,
        iso2,
        dto.category,
        dto.horizonDays,
        onProgress,
      ),
    );
  }

  // GET /api/countries/:iso2/scenarios → kayıtlı senaryo setleri
  @Get('countries/:iso2/scenarios')
  scenarios(@CurrentUser() user: AuthUser, @Param('iso2') iso2: string) {
    return this.scenariosService.list(user.id, iso2);
  }

  // DELETE /api/scenarios/:id → senaryo setini sil
  @Delete('scenarios/:id')
  @Roles('admin')
  async removeScenario(@Param('id') id: string) {
    await this.scenariosService.delete(id);
    return { deleted: true, id };
  }

  /**
   * Bir üretim akışını SSE olarak yayınlar: 'progress' (aşama) olayları → 'done'
   * (sonuç) veya 'error'. @Res() kullanıldığından yanıt elle yönetilir (Nest
   * otomatik sarmalamaz). Bağlantı koparsa producer biter, sonuç yine DB'ye yazılır.
   */
  private async runSse(
    res: SseResponse,
    producer: (onProgress: ProgressFn) => Promise<unknown>,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    const send = (data: unknown): void => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    try {
      const result = await producer((ev) => send({ type: 'progress', ...ev }));
      send({ type: 'done', result });
    } catch (e) {
      send({ type: 'error', message: e instanceof Error ? e.message : String(e) });
    } finally {
      res.end();
    }
  }
}
