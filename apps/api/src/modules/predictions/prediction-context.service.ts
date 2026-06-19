import { Injectable, Logger } from '@nestjs/common';
import { ArticlesRepository } from '../content/articles.repository';
import { AnalysisItem } from '../llm/llm.prompt';
import { LlmCoreService } from '../llm/llm.service';
import { buildDossierMessages, parseDossier } from '../llm/prediction.prompt';
import { ProviderId } from '../llm/llm.types';

@Injectable()
export class PredictionContextService {
  private readonly logger = new Logger(PredictionContextService.name);

  constructor(
    private readonly articles: ArticlesRepository,
    private readonly llm: LlmCoreService,
  ) {}

  async itemsFor(iso2: string): Promise<AnalysisItem[]> {
    const rows = await this.articles.recentWithSourceByCountry(iso2, 60);
    return rows.map((row) => ({
      title: row.title,
      url: row.url,
      orientation: row.orientation,
      source: row.source,
      snippet: row.summary ? row.summary.slice(0, 280) : null,
      content: row.content,
      publishedAt: row.published_at,
    }));
  }

  /**
   * Bağlam dösyesi: ham haberleri tahmin-öncesi kuratoryal brifinge damıtan UCUZ
   * ön-özet. Ana model ham ~40 haberi kendisi sentezlemek yerine damıtılmış sinyalle
   * çalışır (daha temiz dösye + ana modelde token tasarrufu). Hata/boşsa null döner —
   * pipeline ham haberle sorunsuz devam eder (graceful). Çıktı doğrudan extraction
   * prompt'una girer; mezar kod değil, gerçek girdi.
   */
  async buildDossier(
    countryName: string,
    asOf: string,
    items: AnalysisItem[],
    provider: ProviderId,
    apiKey: string,
    model: string,
  ): Promise<string | null> {
    if (items.length < 4) return null; // damıtacak anlamlı yığın yok
    try {
      const raw = await this.llm.chat(
        provider,
        apiKey,
        buildDossierMessages({ countryName, asOf, items }),
        { model, jsonMode: true, temperature: 0.2, maxTokens: 2048 },
      );
      return parseDossier(raw) || null;
    } catch (e) {
      this.logger.warn(
        `Dösye üretilemedi (ham haberle devam): ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      return null;
    }
  }
}
