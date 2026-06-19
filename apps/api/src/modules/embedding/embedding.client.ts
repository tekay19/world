import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMBEDDING_DIM } from './embedding.constants';

/**
 * Anahtarsız self-hosted embedding servisi istemcisi (services/embedding).
 * Servis kapalıysa health() false döner → çağıranlar RAG'sız graceful devam eder.
 */
@Injectable()
export class EmbeddingClient {
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = (
      config.get<string>('EMBEDDING_URL') ?? 'http://localhost:8000'
    ).replace(/\/$/, '');
  }

  async health(): Promise<boolean> {
    try {
      const r = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(4_000),
      });
      return r.ok;
    } catch {
      return false;
    }
  }

  /** Metinleri vektöre çevir. kind: depolanan içerik için 'passage', sorgu için 'query'. */
  async embed(texts: string[], kind: 'query' | 'passage'): Promise<number[][]> {
    if (texts.length === 0) return [];
    const r = await fetch(`${this.baseUrl}/embed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ texts, kind }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) {
      throw new Error(`Embedding servisi HTTP ${r.status}`);
    }
    const data = (await r.json()) as { dim: number; embeddings: number[][] };
    if (data.dim !== EMBEDDING_DIM) {
      throw new Error(
        `Embedding boyutu ${data.dim}, beklenen ${EMBEDDING_DIM}. ` +
          'EMBEDDING_MODEL şema ile uyuşmuyor (article_embeddings vector(384)).',
      );
    }
    return data.embeddings;
  }
}
