import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CountriesRepository } from '../countries/countries.repository';
import { CredentialsService } from '../credentials/credentials.service';
import {
  buildChatMessages,
  ChatAnswer,
  parseChatAnswer,
} from '../llm/chat.prompt';
import { LlmCoreService } from '../llm/llm.service';
import { SearchService } from '../search/search.service';
import { PredictionContextService } from './prediction-context.service';
import { ResearchService } from './pipeline/researcher';

@Injectable()
export class PredictionChatService {
  private readonly logger = new Logger(PredictionChatService.name);

  constructor(
    private readonly countries: CountriesRepository,
    private readonly creds: CredentialsService,
    private readonly llm: LlmCoreService,
    private readonly research: ResearchService,
    private readonly search: SearchService,
    private readonly context: PredictionContextService,
  ) {}

  async ask(
    userId: string,
    iso2: string,
    question: string,
    history?: Array<{ q: string; a: string }>,
  ): Promise<ChatAnswer & { model: string }> {
    const query = (question || '').trim();
    if (!query) throw new BadRequestException('Soru boş olamaz.');
    const country = await this.countries.findByIso2(iso2);
    if (!country) throw new NotFoundException(`Ülke bulunamadı: ${iso2}`);

    const credentials = await this.creds.getAllDecrypted(userId);
    if (credentials.length === 0) {
      throw new BadRequestException(
        "Kayıtlı AI sağlayıcı yok. Ayarlar'dan ekleyin.",
      );
    }
    const credential =
      credentials.find((candidate) => candidate.provider === 'gemini') ??
      credentials[0];
    // Sohbet ETKİLEŞİMLİ: hız için flash (pro + high reasoning = 20-60sn). Tahmin/
    // senaryo derinlik istediğinden pro'da kalır; sohbette kullanıcı bekliyor.
    const model =
      credential.provider === 'gemini'
        ? 'gemini-2.5-flash'
        : credential.model || this.llm.defaultModel(credential.provider);

    const countryEn = country.name ?? country.name_tr ?? country.iso2;
    const items = await this.context.itemsFor(country.iso2);
    const [research, web] = await Promise.all([
      this.research.gather(userId, country.iso2, query, countryEn),
      this.search.forTopic(countryEn, query).catch(() => null),
    ]);
    const messages = buildChatMessages({
      countryName: country.name_tr ?? country.name,
      iso2: country.iso2,
      asOf: new Date().toISOString(),
      question: query,
      history,
      items,
      events: research.events,
      structural: research.structural,
      anchors: research.anchors,
      priors: research.priors.map((prior) => ({
        source: prior.source,
        question: prior.question,
        probability: prior.probability,
      })),
      webContext: web?.summary ?? null,
      webSources: web?.sources ?? [],
    });

    let answer: ChatAnswer | null = null;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const raw = await this.llm.chat(
          credential.provider,
          credential.apiKey,
          messages,
          {
            model,
            jsonMode: true,
            temperature: 0.4,
            // 1. deneme kesilirse (finish_reason=length) 2. deneme daha bol bütçe.
            maxTokens: attempt === 1 ? 8192 : 16384,
            // Sohbette hız için 'medium' (derin düşünme tahmin/senaryoda).
            reasoningEffort: 'medium',
          },
        );
        const parsed = parseChatAnswer(raw);
        if (parsed.answer) {
          answer = parsed;
          break;
        }
        lastError = new Error('Model boş cevap verdi.');
      } catch (error) {
        lastError = error;
        this.logger.warn(`Sohbet hatası: ${(error as Error).message}`);
      }
    }
    if (!answer) {
      throw new BadGatewayException(
        `Cevap üretilemedi (${credential.provider}/${model}): ${
          lastError instanceof Error ? lastError.message : String(lastError)
        }`,
      );
    }
    if (web?.sources?.length) {
      const seen = new Set(answer.sources.map((source) => source.url));
      for (const source of web.sources) {
        if (!seen.has(source.url)) {
          answer.sources.push(source);
          seen.add(source.url);
        }
      }
    }
    return { ...answer, model: `${credential.provider}/${model}` };
  }
}
