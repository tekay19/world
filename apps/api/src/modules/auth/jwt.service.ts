import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AccessTokenClaims, AuthUser } from './auth.types';

const encode = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

@Injectable()
export class JwtService {
  private readonly secret: Buffer;
  private readonly ttl: number;

  constructor(config: ConfigService) {
    this.secret = this.resolveSecret(config);
    this.ttl = config.get<number>('JWT_ACCESS_TTL') ?? 900;
  }

  sign(user: AuthUser): string {
    const now = Math.floor(Date.now() / 1000);
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const payload = encode({
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: now,
      exp: now + this.ttl,
    } satisfies AccessTokenClaims);
    const body = `${header}.${payload}`;
    return `${body}.${this.signature(body)}`;
  }

  verify(token: string): AccessTokenClaims {
    const parts = token.split('.');
    if (parts.length !== 3) throw new UnauthorizedException('Geçersiz erişim tokenı.');
    const body = `${parts[0]}.${parts[1]}`;
    const expected = Buffer.from(this.signature(body));
    const actual = Buffer.from(parts[2]);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException('Geçersiz erişim tokenı.');
    }
    let claims: AccessTokenClaims;
    try {
      claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Geçersiz erişim tokenı.');
    }
    if (!claims.sub || !claims.email || !claims.role || claims.exp <= Date.now() / 1000) {
      throw new UnauthorizedException('Erişim tokenının süresi dolmuş.');
    }
    return claims;
  }

  private signature(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('base64url');
  }

  private resolveSecret(config: ConfigService): Buffer {
    const configured = config.get<string>('JWT_SECRET')?.trim();
    if (configured) return Buffer.from(configured);
    if (config.get<string>('NODE_ENV') === 'production') {
      throw new Error('Production ortamında JWT_SECRET zorunludur.');
    }
    const dir = join(process.cwd(), '.secrets');
    const file = join(dir, 'dev-jwt.key');
    if (existsSync(file)) return Buffer.from(readFileSync(file, 'utf8').trim(), 'base64');
    mkdirSync(dir, { recursive: true });
    const secret = randomBytes(48);
    try {
      writeFileSync(file, secret.toString('base64'), { mode: 0o600, flag: 'wx' });
      return secret;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        return Buffer.from(readFileSync(file, 'utf8').trim(), 'base64');
      }
      throw error;
    }
  }
}
