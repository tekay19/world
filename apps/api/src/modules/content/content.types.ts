export interface SourceRow {
  id: string;
  name: string;
  homepage: string | null;
  feed_url: string;
  kind: string;
  orientation: string | null;
  lang: string | null;
  country_iso2: string | null;
  active: boolean;
  created_at: string;
  // Sağlık takibi (0017): çekim başarısı/hatası izlenir, kronik-ölü kaynak görünür.
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  last_item_count: number | null;
  consecutive_failures: number;
}

export interface ArticleRow {
  id: string;
  source_id: string | null;
  url: string;
  url_hash: string;
  title: string;
  content: string | null;
  summary: string | null;
  lang: string | null;
  author: string | null;
  published_at: string | null;
  fetched_at: string;
  raw: unknown;
}

