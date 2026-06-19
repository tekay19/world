import type {
  CalibrationReport,
  ChatAnswer,
  CountryDetail,
  ExternalPrior,
  FeedItem,
  GenerateResult,
  GlobeCountry,
  MarketSignal,
  Prediction,
  PredictionHistoryPoint,
  ProviderMeta,
  SavedCredential,
  ScenarioReport,
  StructuralIndicator,
  AuthSession,
  AuthUser,
} from './types';

const BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:4000';

const TOKEN_KEY = 'dunya_access_token';

export function accessToken(): string | null {
  return typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(accessToken() ? { authorization: `Bearer ${accessToken()}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const d = data as { message?: string | string[] } | null;
    const msg = d?.message
      ? Array.isArray(d.message)
        ? d.message.join(', ')
        : d.message
      : `API ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export interface ProgressEvent {
  stage: string;
  detail?: string;
}

type SseMessage =
  | { type: 'progress'; stage: string; detail?: string }
  | { type: 'done'; result: unknown }
  | { type: 'error'; message: string };

/** POST → text/event-stream gövdesini satır satır SseMessage olarak çözer. */
async function* sseStream(
  path: string,
  body: unknown,
): AsyncGenerator<SseMessage> {
  const res = await fetch(`${BASE}/api${path}`, {
    method: 'POST',
    headers: {
      accept: 'text/event-stream',
      'content-type': 'application/json',
      ...(accessToken() ? { authorization: `Bearer ${accessToken()}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    let msg = `API ${res.status}`;
    try {
      const j = JSON.parse(await res.text()) as { message?: string | string[] };
      if (j.message)
        msg = Array.isArray(j.message) ? j.message.join(', ') : j.message;
    } catch {
      // gövde JSON değil — varsayılan mesajla devam
    }
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const frames = buf.split('\n\n');
    buf = frames.pop() ?? '';
    for (const frame of frames) {
      const line = frame.split('\n').find((l) => l.startsWith('data:'));
      if (line) yield JSON.parse(line.slice(5).trim()) as SseMessage;
    }
  }
}

/** SSE akışını tüketir: ilerlemede onProgress, 'done'da sonuç, 'error'da fırlatır. */
async function streamResult<T>(
  path: string,
  body: unknown,
  onProgress?: (e: ProgressEvent) => void,
): Promise<T> {
  let result: T | undefined;
  for await (const msg of sseStream(path, body)) {
    if (msg.type === 'progress')
      onProgress?.({ stage: msg.stage, detail: msg.detail });
    else if (msg.type === 'done') result = msg.result as T;
    else if (msg.type === 'error') throw new Error(msg.message);
  }
  if (result === undefined) throw new Error('Akış sonuç vermeden kapandı.');
  return result;
}

export const api = {
  register: (email: string, password: string) =>
    request<AuthSession>('POST', '/auth/register', { email, password }),
  login: (email: string, password: string) =>
    request<AuthSession>('POST', '/auth/login', { email, password }),
  me: () => request<AuthUser>('GET', '/auth/me'),

  // küre & ülke
  globeCountries: () => request<GlobeCountry[]>('GET', '/globe/countries'),
  country: (iso2: string) => request<CountryDetail>('GET', `/countries/${iso2}`),
  feed: (iso2: string, limit = 12) =>
    request<FeedItem[]>('GET', `/countries/${iso2}/feed?limit=${limit}`),
  // BYOK
  llmProviders: () => request<ProviderMeta[]>('GET', '/me/llm/providers'),
  llmSaved: () => request<SavedCredential[]>('GET', '/me/llm'),
  llmModels: (provider: string, apiKey?: string) =>
    request<{ provider: string; models: string[] }>('POST', '/me/llm/models', {
      provider,
      apiKey,
    }),
  llmTest: (provider: string, apiKey?: string, model?: string) =>
    request<{ ok: boolean; sample: string; model: string }>(
      'POST',
      '/me/llm/test',
      { provider, apiKey, model },
    ),
  llmSave: (provider: string, apiKey: string, model?: string) =>
    request<SavedCredential & { tested: boolean }>('POST', '/me/llm', {
      provider,
      apiKey,
      model,
    }),
  llmDelete: (provider: string) =>
    request<{ deleted: boolean }>('DELETE', `/me/llm/${provider}`),

  // tahmin & kalibrasyon
  predictions: (iso2: string) =>
    request<Prediction[]>('GET', `/countries/${iso2}/predictions`),
  generatePredictionsStream: (
    iso2: string,
    category?: string,
    onProgress?: (e: ProgressEvent) => void,
  ) =>
    streamResult<GenerateResult>(
      `/countries/${iso2}/predictions/generate/stream`,
      { category },
      onProgress,
    ),
  resolvePrediction: (id: string, outcome: boolean) =>
    request<Prediction>('POST', `/predictions/${id}/resolve`, { outcome }),
  deletePrediction: (id: string) =>
    request<{ deleted: boolean }>('DELETE', `/predictions/${id}`),
  clearPredictions: (iso2: string) =>
    request<{ deleted: number }>('DELETE', `/countries/${iso2}/predictions`),
  predictionHistory: (id: string) =>
    request<PredictionHistoryPoint[]>('GET', `/predictions/${id}/history`),
  repredict: (iso2: string) =>
    request<{ created: number; matched: number }>(
      'POST',
      `/countries/${iso2}/predictions/repredict`,
    ),
  ask: (
    iso2: string,
    question: string,
    history?: Array<{ q: string; a: string }>,
  ) =>
    request<ChatAnswer>('POST', `/countries/${iso2}/ask`, { question, history }),
  // Veri katmanı
  structural: (iso2: string) =>
    request<StructuralIndicator[]>('GET', `/countries/${iso2}/structural`),
  signals: () => request<MarketSignal[]>('GET', '/signals'),
  priors: (iso2: string) =>
    request<ExternalPrior[]>('GET', `/countries/${iso2}/priors`),

  // Faz 3+: zengin uzun-form senaryo raporu
  scenarios: (iso2: string) =>
    request<ScenarioReport[]>('GET', `/countries/${iso2}/scenarios`),
  generateScenariosStream: (
    iso2: string,
    category?: string,
    horizonDays?: number,
    onProgress?: (e: ProgressEvent) => void,
  ) =>
    streamResult<ScenarioReport>(
      `/countries/${iso2}/scenarios/generate/stream`,
      { category, horizonDays },
      onProgress,
    ),
  deleteScenario: (id: string) =>
    request<{ deleted: boolean }>('DELETE', `/scenarios/${id}`),

  calibration: (params?: { topic?: string; model?: string; days?: number }) => {
    const q = new URLSearchParams();
    if (params?.topic) q.set('topic', params.topic);
    if (params?.model) q.set('model', params.model);
    if (params?.days) q.set('days', String(params.days));
    const qs = q.toString();
    return request<CalibrationReport>(
      'GET',
      `/predictions/calibration${qs ? `?${qs}` : ''}`,
    );
  },
};
