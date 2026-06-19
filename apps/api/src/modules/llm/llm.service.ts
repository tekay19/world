import { Injectable } from '@nestjs/common';
import { createProvider } from './providers';
import {
  ChatMessage,
  ChatOptions,
  PROVIDERS,
  ProviderId,
  ProviderMeta,
  providerInfo,
} from './llm.types';

/**
 * Durumsuz LLM çekirdeği. Anahtar her zaman dışarıdan (çözülmüş) gelir;
 * burada saklanmaz. Credentials/Analysis modülleri bunu kullanır.
 */
@Injectable()
export class LlmCoreService {
  providers(): ProviderMeta[] {
    return providerInfo();
  }

  defaultModel(provider: ProviderId): string {
    return PROVIDERS[provider]?.defaultModel ?? '';
  }

  listModels(provider: ProviderId, apiKey: string): Promise<string[]> {
    return createProvider(provider, apiKey).listModels();
  }

  /** Genel amaçlı sohbet (tahmin üretimi, llm-judge çözümleme vb. kullanır). */
  chat(
    provider: ProviderId,
    apiKey: string,
    messages: ChatMessage[],
    opts: ChatOptions,
  ): Promise<string> {
    return createProvider(provider, apiKey).chat(messages, opts);
  }

  /** Ucuz doğrulama çağrısı (anahtar geçerli mi). */
  async test(
    provider: ProviderId,
    apiKey: string,
    model: string,
  ): Promise<{ ok: true; sample: string; model: string }> {
    const p = createProvider(provider, apiKey);
    const out = await p.chat(
      [
        {
          role: 'user',
          content: 'Bağlantı testi. Sadece "Bağlantı tamam" yaz.',
        },
      ],
      // Düşünen modeller (Gemini 2.5) token bütçesini akıl yürütmeye harcayıp
      // boş içerik döndürür; bağlantı testi için bol bütçe ver.
      { model, maxTokens: 4096, temperature: 0 },
    );
    return { ok: true, sample: out.trim().slice(0, 200), model };
  }
}
