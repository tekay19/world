import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Encrypted {
  cipher: Buffer;
  iv: Buffer;
  tag: Buffer;
}

/**
 * BYOK anahtar şifreleme — AES-256-GCM.
 * Master key: önce LLM_MASTER_KEY (base64 32 byte). Yoksa (yalnız dev) .secrets/dev-master.key
 * üretilir/okunur (git ignore). Production'da env zorunlu.
 * Düz metin anahtar ASLA loglanmaz/diske yazılmaz.
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    this.key = this.resolveMasterKey(config);
  }

  private resolveMasterKey(config: ConfigService): Buffer {
    const b64 = config.get<string>('LLM_MASTER_KEY');
    if (b64 && b64.trim()) {
      const buf = Buffer.from(b64.trim(), 'base64');
      if (buf.length !== 32) {
        throw new Error('LLM_MASTER_KEY base64 ile tam 32 byte olmalı.');
      }
      return buf;
    }

    if (config.get<string>('NODE_ENV') === 'production') {
      throw new Error('Production ortamında LLM_MASTER_KEY zorunludur.');
    }

    // Dev fallback: stabil ama git-ignore edilen yerel anahtar.
    const dir = join(process.cwd(), '.secrets');
    const file = join(dir, 'dev-master.key');
    if (existsSync(file)) {
      return Buffer.from(readFileSync(file, 'utf8').trim(), 'base64');
    }
    mkdirSync(dir, { recursive: true });
    const key = randomBytes(32);
    try {
      writeFileSync(file, key.toString('base64'), {
        mode: 0o600,
        flag: 'wx',
      });
      this.logger.warn(
        'Dev master key üretildi (.secrets/dev-master.key, git ignore). ' +
          "Production'da LLM_MASTER_KEY ayarlayın.",
      );
      return key;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        return Buffer.from(readFileSync(file, 'utf8').trim(), 'base64');
      }
      throw error;
    }
  }

  encrypt(plaintext: string): Encrypted {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return { cipher: enc, iv, tag: cipher.getAuthTag() };
  }

  decrypt(enc: Encrypted): string {
    const decipher = createDecipheriv('aes-256-gcm', this.key, enc.iv);
    decipher.setAuthTag(enc.tag);
    return Buffer.concat([
      decipher.update(enc.cipher),
      decipher.final(),
    ]).toString('utf8');
  }
}
