export interface GlobeCountry {
  iso2: string;
  name: string;
  name_tr: string | null;
  lat: number | null;
  lng: number | null;
  region: string | null;
  agendaScore: number | null;
}

export type UserRole = 'user' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthSession {
  accessToken: string;
  tokenType: 'Bearer';
  user: AuthUser;
}

export interface FeedItem {
  title: string;
  url: string;
  source: string | null;
  orientation: string | null;
  published_at: string | null;
}

export interface CountryDetail {
  country: {
    iso2: string;
    name: string;
    name_tr: string | null;
    lat: number | null;
    lng: number | null;
    region: string | null;
    profile: Record<string, unknown>;
  };
  agenda: { score: number; date: string } | null;
}

// ---- BYOK ----
export interface ProviderMeta {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  style: string;
  keyPrefixHint?: string;
  docsUrl?: string;
}

export interface SavedCredential {
  id: string;
  provider: string;
  model: string | null;
  key_hint: string | null;
  key_version: number;
  created_at: string;
  updated_at: string;
}

// ---- Tahmin & Kalibrasyon ----
export interface Prediction {
  id: string;
  scope: string | null;
  topic: string | null;
  question: string;
  probability: number | null;
  prob_low: number | null;
  prob_high: number | null;
  confidence: string | null;
  rationale: string | null;
  horizon: string | null;
  resolution_criteria: string | null;
  resolution_source: string | null;
  base_rate: number | null;
  model: string | null;
  resolve_at: string;
  resolved: boolean;
  outcome: boolean | null;
  brier: number | null;
  counter_argument: string | null;
  aggregation: string | null;
  model_count: number | null;
  prob_pre_devil: number | null;
}

export interface PredictionVote {
  model: string;
  probability: number | null;
  rationale: string | null;
  created_at: string;
}

export interface PredictionHistoryPoint {
  probability: number | null;
  generated_at: string;
  model: string | null;
  resolved: boolean;
}

export interface ChatAnswer {
  answer: string;
  probability: number | null;
  reasoning: string;
  watch: string[];
  sources: Array<{ title: string; url: string }>;
  model: string;
}

export interface GenerateResult {
  country: string;
  created: number;
  panel: string[];
  predictions: Prediction[];
}

// ---- Veri katmanı: makro / sinyal / dış prior / doktrin ----
export interface StructuralIndicator {
  key: string;
  label: string;
  unit: string;
  value: number;
  year: number;
  display: string;
  trend: 'up' | 'down' | 'flat' | null;
}

export interface MarketSignal {
  key: string;
  label: string;
  value: number;
  ts: string;
  source: string | null;
  changePct: number | null;
}

export interface ExternalPrior {
  source: string;
  question: string;
  probability: number | null;
  url: string;
}

// ---- Faz 3+: zengin uzun-form senaryo raporu ----
export interface ReportScenario {
  label: string;
  probability: number;
  summary: string;
  consequences: string[];
}

export interface ScenarioReport {
  id: string;
  topic: string | null;
  horizon: string | null;
  title: string | null;
  framing: string | null;
  thesis: string | null;
  sections: Array<{ title: string; body: string }>;
  scenarios: ReportScenario[];
  uncertainty: string | null;
  bottom_line: string | null;
  key_questions: string[];
  confidence: string | null;
  sources: Array<{ title: string; url: string }>;
  model: string | null;
  created_at: string;
}

export interface CalibrationReport {
  count: number;
  meanBrier: number | null;
  meanLogScore: number | null;
  baseline: { halfAlways: number; baseRate: number | null };
  observedFreq: number | null;
  verdict: string;
  buckets: Array<{
    lo: number;
    hi: number;
    predicted: number | null;
    observed: number | null;
    n: number;
  }>;
  byModel: Array<{ key: string; count: number; meanBrier: number }>;
  byTopic: Array<{ key: string; count: number; meanBrier: number }>;
}

export interface AnalysisFraming {
  perspective: string;
  held_by: string;
  claim: string;
}

export interface AnalysisScenario {
  description: string;
  probability: number;
  confidence: string;
  horizon: string;
  second_order?: string[];
  historical_analogy?: string;
}

export interface AnalysisScope {
  facts: string[];
  framings: AnalysisFraming[];
  drivers: string[];
  scenarios: AnalysisScenario[];
  blind_spots: string[];
}

export interface DoctrineAnalysis {
  country?: string;
  as_of?: string;
  domestic?: AnalysisScope;
  foreign?: AnalysisScope;
  sources?: Array<{ title: string; url: string; orientation?: string }>;
}

export interface AnalysisRecord<Result = DoctrineAnalysis> {
  id: string;
  owner_user_id: string | null;
  country_id: string;
  scope: 'domestic' | 'foreign' | 'both';
  result: Result;
  provider: string | null;
  model: string | null;
  created_at: string;
}
