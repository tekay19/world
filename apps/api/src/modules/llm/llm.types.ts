export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'kimi'
  | 'nvidia'
  | 'openrouter';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  // "Max effort": düşünen modellerde (gemini-2.5) akıl-yürütme bütçesi.
  reasoningEffort?: 'low' | 'medium' | 'high';
}

export interface LlmProvider {
  /** Tek seferlik sohbet tamamlama; metin döndürür. */
  chat(messages: ChatMessage[], opts: ChatOptions): Promise<string>;
  /** Sağlayıcının canlı model listesi (OpenAI-uyumlu /models). */
  listModels(): Promise<string[]>;
}

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  baseUrl: string;
  defaultModel: string;
  style: 'openai' | 'anthropic';
  keyPrefixHint?: string;
  docsUrl?: string;
}

/**
 * Sağlayıcı kayıt defteri. OpenAI · Kimi · Gemini · NVIDIA OpenAI-uyumlu;
 * Anthropic kendi /v1/messages API'si.
 * defaultModel düzenlenebilir — UI canlı /models listesinden seçtirir.
 */
export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  openai: {
    id: 'openai',
    label: 'OpenAI (ChatGPT)',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    style: 'openai',
    keyPrefixHint: 'sk-',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-sonnet-latest',
    style: 'anthropic',
    keyPrefixHint: 'sk-ant-',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  gemini: {
    id: 'gemini',
    label: 'Google (Gemini)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    // gemini-1.5-* emekliye ayrıldı. 2.5-flash: güçlü + hızlı + içeriği güvenilir döner.
    // (2.5-pro daha kaliteli ama ağır "düşünme" nedeniyle kısa yanıtları boş dönebilir.)
    defaultModel: 'gemini-2.5-flash',
    style: 'openai',
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
  kimi: {
    id: 'kimi',
    label: 'Moonshot (Kimi)',
    baseUrl: 'https://api.moonshot.ai/v1',
    defaultModel: 'moonshot-v1-128k',
    style: 'openai',
    docsUrl: 'https://platform.moonshot.ai/console/api-keys',
  },
  nvidia: {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    // 405B çoğu hesapta açık değil (404 "not found for account"); 70B yaygın erişilebilir.
    defaultModel: 'meta/llama-3.3-70b-instruct',
    style: 'openai',
    keyPrefixHint: 'nvapi-',
    docsUrl: 'https://build.nvidia.com',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter (çoklu model)',
    baseUrl: 'https://openrouter.ai/api/v1',
    // Tek key → onlarca model (GPT/Claude/Llama). Panel çeşitliliği için ideal.
    defaultModel: 'openai/gpt-4o-mini',
    style: 'openai',
    keyPrefixHint: 'sk-or-',
    docsUrl: 'https://openrouter.ai/keys',
  },
};

export function providerInfo(): ProviderMeta[] {
  return Object.values(PROVIDERS);
}
