import type { AuthUser, UserRole } from '@dunya/contracts';

export type { AuthUser, UserRole };

export interface AccessTokenClaims {
  sub: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}
