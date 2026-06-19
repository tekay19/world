import { Injectable } from '@nestjs/common';
import { CryptoService } from '../../security/crypto.service';
import { ProviderId } from '../llm/llm.types';
import {
  CredentialMasked,
  CredentialsRepository,
} from './credentials.repository';

export interface DecryptedCredential {
  provider: ProviderId;
  model: string | null;
  apiKey: string;
}

@Injectable()
export class CredentialsService {
  constructor(
    private readonly repo: CredentialsRepository,
    private readonly crypto: CryptoService,
  ) {}

  /** Anahtarı maskele — yalnız son 4 hane gösterilir. */
  private mask(apiKey: string): string {
    const last4 = apiKey.slice(-4);
    return `••••${last4}`;
  }

  async save(
    userId: string,
    provider: ProviderId,
    model: string | null,
    apiKey: string,
  ): Promise<CredentialMasked> {
    const enc = this.crypto.encrypt(apiKey);
    return this.repo.upsert({
      userId,
      provider,
      model,
      cipher: enc.cipher,
      iv: enc.iv,
      tag: enc.tag,
      hint: this.mask(apiKey),
    });
  }

  list(userId: string): Promise<CredentialMasked[]> {
    return this.repo.listByUser(userId);
  }

  async getDecrypted(
    userId: string,
    provider: ProviderId,
  ): Promise<DecryptedCredential | null> {
    const row = await this.repo.getSecret(userId, provider);
    if (!row) return null;
    return {
      provider: row.provider as ProviderId,
      model: row.model,
      apiKey: this.crypto.decrypt({
        cipher: row.key_cipher,
        iv: row.key_iv,
        tag: row.key_tag,
      }),
    };
  }

  /** Panel için: kullanıcının TÜM kayıtlı anahtarları (çözülmüş, bellekte). */
  async getAllDecrypted(userId: string): Promise<DecryptedCredential[]> {
    const rows = await this.repo.allSecrets(userId);
    return rows.map((row) => ({
      provider: row.provider as ProviderId,
      model: row.model,
      apiKey: this.crypto.decrypt({
        cipher: row.key_cipher,
        iv: row.key_iv,
        tag: row.key_tag,
      }),
    }));
  }

  async getLatestDecrypted(
    userId: string,
  ): Promise<DecryptedCredential | null> {
    const row = await this.repo.latestSecret(userId);
    if (!row) return null;
    return {
      provider: row.provider as ProviderId,
      model: row.model,
      apiKey: this.crypto.decrypt({
        cipher: row.key_cipher,
        iv: row.key_iv,
        tag: row.key_tag,
      }),
    };
  }

  remove(userId: string, provider: ProviderId): Promise<void> {
    return this.repo.remove(userId, provider);
  }
}
