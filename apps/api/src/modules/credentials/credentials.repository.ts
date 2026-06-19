import { Injectable } from '@nestjs/common';
import { PgService } from '../../database/pg.service';

export interface CredentialMasked {
  id: string;
  provider: string;
  model: string | null;
  key_hint: string | null;
  key_version: number;
  created_at: string;
  updated_at: string;
}

export interface CredentialSecret {
  provider: string;
  model: string | null;
  key_cipher: Buffer;
  key_iv: Buffer;
  key_tag: Buffer;
}

export interface UpsertParams {
  userId: string;
  provider: string;
  model: string | null;
  cipher: Buffer;
  iv: Buffer;
  tag: Buffer;
  hint: string;
}

@Injectable()
export class CredentialsRepository {
  constructor(private readonly pg: PgService) {}

  async upsert(p: UpsertParams): Promise<CredentialMasked> {
    const row = await this.pg.queryOne<CredentialMasked>(
      `INSERT INTO user_llm_credentials
         (user_id, provider, model, key_cipher, key_iv, key_tag, key_hint, key_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,1)
       ON CONFLICT (user_id, provider) DO UPDATE SET
         model = EXCLUDED.model,
         key_cipher = EXCLUDED.key_cipher,
         key_iv = EXCLUDED.key_iv,
         key_tag = EXCLUDED.key_tag,
         key_hint = EXCLUDED.key_hint,
         key_version = user_llm_credentials.key_version + 1,
         updated_at = now()
       RETURNING id, provider, model, key_hint, key_version, created_at, updated_at`,
      [p.userId, p.provider, p.model, p.cipher, p.iv, p.tag, p.hint],
    );
    // upsert daima bir satır döndürür
    return row as CredentialMasked;
  }

  listByUser(userId: string): Promise<CredentialMasked[]> {
    return this.pg.query<CredentialMasked>(
      `SELECT id, provider, model, key_hint, key_version, created_at, updated_at
         FROM user_llm_credentials
        WHERE user_id = $1
        ORDER BY updated_at DESC`,
      [userId],
    );
  }

  getSecret(userId: string, provider: string): Promise<CredentialSecret | null> {
    return this.pg.queryOne<CredentialSecret>(
      `SELECT provider, model, key_cipher, key_iv, key_tag
         FROM user_llm_credentials
        WHERE user_id = $1 AND provider = $2`,
      [userId, provider],
    );
  }

  allSecrets(userId: string): Promise<CredentialSecret[]> {
    return this.pg.query<CredentialSecret>(
      `SELECT provider, model, key_cipher, key_iv, key_tag
         FROM user_llm_credentials
        WHERE user_id = $1
        ORDER BY updated_at DESC`,
      [userId],
    );
  }

  latestSecret(userId: string): Promise<CredentialSecret | null> {
    return this.pg.queryOne<CredentialSecret>(
      `SELECT provider, model, key_cipher, key_iv, key_tag
         FROM user_llm_credentials
        WHERE user_id = $1
        ORDER BY updated_at DESC
        LIMIT 1`,
      [userId],
    );
  }

  async remove(userId: string, provider: string): Promise<void> {
    await this.pg.query(
      `DELETE FROM user_llm_credentials WHERE user_id = $1 AND provider = $2`,
      [userId, provider],
    );
  }
}
