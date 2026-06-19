import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { LlmCoreService } from '../llm/llm.service';
import { ProviderId } from '../llm/llm.types';
import { CurrentUser } from '../auth/auth.decorators';
import { AuthUser } from '../auth/auth.types';
import { CredentialsService } from './credentials.service';
import { ModelsLlmDto, SaveLlmDto, TestLlmDto } from './credentials.dto';

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * API anahtarını HTTP başlığına uygun hale getirir. Kopyala-yapıştır sırasında
 * sızan görünmez/Latin1-dışı karakterler (U+2028 satır ayracı, zero-width, BOM,
 * boşluk/yeni satır) `fetch` başlığını ByteString'e çeviremediği için hata verir.
 * API anahtarları yazdırılabilir ASCII'dir; dışındaki her şeyi at.
 */
function sanitizeKey(raw: string | undefined): string {
  return (raw ?? '').replace(/[^\x21-\x7E]/g, '');
}

/**
 * BYOK uçları. Kimlik doğrulanan kullanıcının anahtarları dışında kayıt okuyamaz.
 * Anahtar yanıtta ASLA dönmez; yalnız maskeli özet.
 */
@Controller('me/llm')
export class CredentialsController {
  constructor(
    private readonly creds: CredentialsService,
    private readonly llm: LlmCoreService,
  ) {}

  // GET /api/me/llm → kayıtlı sağlayıcılar (maskeli)
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.creds.list(user.id);
  }

  // GET /api/me/llm/providers → seçilebilir sağlayıcılar + varsayılan modeller
  @Get('providers')
  providers() {
    return this.llm.providers();
  }

  // POST /api/me/llm/models { provider, apiKey? } → canlı model listesi
  @Post('models')
  async models(@CurrentUser() user: AuthUser, @Body() dto: ModelsLlmDto) {
    const apiKey = await this.resolveKey(user.id, dto.provider, dto.apiKey);
    try {
      const models = await this.llm.listModels(dto.provider, apiKey);
      return { provider: dto.provider, models };
    } catch (e) {
      throw new BadRequestException(`Modeller alınamadı: ${errMessage(e)}`);
    }
  }

  // POST /api/me/llm/test { provider, apiKey?, model? } → bağlantı testi
  @Post('test')
  async test(@CurrentUser() user: AuthUser, @Body() dto: TestLlmDto) {
    const apiKey = await this.resolveKey(user.id, dto.provider, dto.apiKey);
    const model = dto.model || (await this.savedModel(user.id, dto.provider)) ||
      this.llm.defaultModel(dto.provider);
    try {
      return await this.llm.test(dto.provider, apiKey, model);
    } catch (e) {
      throw new BadRequestException(`Bağlantı testi başarısız: ${errMessage(e)}`);
    }
  }

  // POST /api/me/llm { provider, model?, apiKey } → doğrula + şifreli kaydet
  @Post()
  async save(@CurrentUser() user: AuthUser, @Body() dto: SaveLlmDto) {
    const apiKey = sanitizeKey(dto.apiKey);
    const model = dto.model || this.llm.defaultModel(dto.provider);

    // §4.3: kaydetmeden önce ucuz doğrulama çağrısı.
    try {
      await this.llm.test(dto.provider, apiKey, model);
    } catch (e) {
      throw new BadRequestException(
        `Anahtar doğrulanamadı, kaydedilmedi: ${errMessage(e)}`,
      );
    }

    const saved = await this.creds.save(user.id, dto.provider, model, apiKey);
    return { ...saved, tested: true };
  }

  // DELETE /api/me/llm/:provider
  @Delete(':provider')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('provider') provider: ProviderId,
  ) {
    await this.creds.remove(user.id, provider);
    return { deleted: true, provider };
  }

  // --- yardımcılar ---
  private async resolveKey(
    userId: string,
    provider: ProviderId,
    provided?: string,
  ): Promise<string> {
    const clean = sanitizeKey(provided);
    if (clean) return clean;
    const saved = await this.creds.getDecrypted(userId, provider);
    if (!saved) {
      throw new BadRequestException(
        'API anahtarı gerekli (girin veya önce kaydedin).',
      );
    }
    return saved.apiKey;
  }

  private async savedModel(
    userId: string,
    provider: ProviderId,
  ): Promise<string | null> {
    const saved = await this.creds.getDecrypted(userId, provider);
    return saved?.model ?? null;
  }
}
