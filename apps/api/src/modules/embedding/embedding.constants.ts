export const EMBEDDING_QUEUE = 'embedding';

export const EMBED_JOBS = {
  /** Embedding'i olmayan haberleri toplu işle. */
  BACKFILL: 'embed-backfill',
} as const;

/** article_embeddings.model alanına yazılır (bilgi amaçlı). */
export const EMBEDDING_MODEL_TAG = 'multilingual-e5-small';
export const EMBEDDING_DIM = 384;
