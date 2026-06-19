import {
  ChatMessage,
  ChatOptions,
  LlmProvider,
  PROVIDERS,
  ProviderId,
} from './llm.types';

function truncate(s: string, n = 300): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/** OpenAI-uyumlu sağlayıcılar: OpenAI · Kimi · Gemini(OpenAI uç) · NVIDIA. */
export class OpenAICompatibleProvider implements LlmProvider {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly allowJsonFormat = false,
  ) {}

  async chat(messages: ChatMessage[], opts: ChatOptions): Promise<string> {
    const body: Record<string, unknown> = {
      model: opts.model,
      messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 4096,
    };
    if (opts.jsonMode && this.allowJsonFormat) {
      body.response_format = { type: 'json_object' };
    }
    // "Max effort": gemini-2.5 ve OpenAI-uyumlu düşünen modeller reasoning_effort'u
    // thinking bütçesine çevirir — basit soruda bile derin akıl yürütme.
    if (opts.reasoningEffort) {
      body.reasoning_effort = opts.reasoningEffort;
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) {
      throw new Error(`Sağlayıcı HTTP ${res.status}: ${truncate(await res.text())}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    };
    const choice = data.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('Sağlayıcıdan beklenmeyen yanıt biçimi.');
    }
    // Düşünen modeller (Gemini 2.5) bütçeyi akıl yürütmeye harcayıp çıktıyı token
    // sınırında KESEBİLİR → JSON yarım kalır. finish_reason='length' ise net hata
    // fırlat; çağıran katman bir üst token bütçesiyle yeniden dener (yoksa retry
    // aynı bütçeyle çağrıyı tekrarlayıp yine kesilir).
    if (choice?.finish_reason === 'length') {
      throw new Error(
        `Yanıt token sınırında kesildi (max_tokens=${body.max_tokens}); daha yüksek bütçe gerek.`,
      );
    }
    return content;
  }

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/models`, {
      headers: { authorization: `Bearer ${this.apiKey}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      throw new Error(`Model listesi HTTP ${res.status}`);
    }
    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    return (data.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => Boolean(id))
      .sort();
  }
}

/** Anthropic Claude — /v1/messages. */
export class AnthropicProvider implements LlmProvider {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
  ) {}

  async chat(messages: ChatMessage[], opts: ChatOptions): Promise<string> {
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const conv = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature ?? 0.4,
        system: system || undefined,
        messages: conv,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      throw new Error(`Sağlayıcı HTTP ${res.status}: ${truncate(await res.text())}`);
    }
    const data = (await res.json()) as {
      content?: Array<{ text?: string }>;
      stop_reason?: string;
    };
    const text = data.content?.[0]?.text;
    if (typeof text !== 'string') {
      throw new Error('Sağlayıcıdan beklenmeyen yanıt biçimi.');
    }
    // OpenAI-uyumlu uçtaki finish_reason='length' ile aynı mantık (Claude tarafı).
    if (data.stop_reason === 'max_tokens') {
      throw new Error(
        `Yanıt token sınırında kesildi (max_tokens=${opts.maxTokens ?? 4096}); daha yüksek bütçe gerek.`,
      );
    }
    return text;
  }

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/v1/models`, {
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      throw new Error(`Model listesi HTTP ${res.status}`);
    }
    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    return (data.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => Boolean(id))
      .sort();
  }
}

/** Sağlayıcı örneği üretir (anahtar yalnız bellekte). */
export function createProvider(id: ProviderId, apiKey: string): LlmProvider {
  const meta = PROVIDERS[id];
  if (!meta) throw new Error(`Bilinmeyen sağlayıcı: ${id}`);
  if (meta.style === 'anthropic') {
    return new AnthropicProvider(apiKey, meta.baseUrl);
  }
  // response_format:json_object destekleyen OpenAI-uyumlu sağlayıcılar.
  // (NVIDIA llama ve Gemini OpenAI ucu json_object'i destekliyor — doğrulandı.)
  const supportsJsonFormat =
    id === 'openai' ||
    id === 'nvidia' ||
    id === 'gemini' ||
    id === 'openrouter';
  return new OpenAICompatibleProvider(apiKey, meta.baseUrl, supportsJsonFormat);
}
