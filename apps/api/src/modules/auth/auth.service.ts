import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthSession } from '@dunya/contracts';
import { PgService } from '../../database/pg.service';
import { JwtService } from './jwt.service';
import { PasswordService } from './password.service';
import { AuthUser, UserRole } from './auth.types';

interface UserRow extends AuthUser {
  password_hash: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly pg: PgService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
  ) {}

  async register(emailInput: string, password: string) {
    const email = emailInput.trim().toLowerCase();
    const passwordHash = await this.passwords.hash(password);
    const user = await this.pg.transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock($1)', [7_194_221]);
      const duplicate = await client.query('SELECT 1 FROM users WHERE email = $1', [email]);
      if (duplicate.rowCount) throw new BadRequestException('Bu e-posta zaten kayıtlı.');

      const local = await client.query<{ id: string }>(
        `SELECT id FROM users
          WHERE email = 'local@dunya.local' AND password_hash = 'no-auth-local-mode'
          FOR UPDATE`,
      );
      if (local.rows[0]) {
        const claimed = await client.query<AuthUser>(
          `UPDATE users SET email = $2, password_hash = $3, role = 'admin'
            WHERE id = $1 RETURNING id, email, role`,
          [local.rows[0].id, email, passwordHash],
        );
        return claimed.rows[0];
      }

      const count = await client.query<{ n: string }>('SELECT COUNT(*)::text AS n FROM users');
      const role: UserRole = Number(count.rows[0]?.n ?? 0) === 0 ? 'admin' : 'user';
      const created = await client.query<AuthUser>(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, $3) RETURNING id, email, role`,
        [email, passwordHash, role],
      );
      return created.rows[0];
    });
    return this.session(user);
  }

  async login(emailInput: string, password: string) {
    const row = await this.pg.queryOne<UserRow>(
      'SELECT id, email, role, password_hash FROM users WHERE email = $1',
      [emailInput.trim().toLowerCase()],
    );
    if (!row || !(await this.passwords.verify(password, row.password_hash))) {
      throw new UnauthorizedException('E-posta veya parola hatalı.');
    }
    return this.session({ id: row.id, email: row.email, role: row.role });
  }

  async userById(id: string): Promise<AuthUser | null> {
    return this.pg.queryOne<AuthUser>('SELECT id, email, role FROM users WHERE id = $1', [id]);
  }

  private session(user: AuthUser): AuthSession {
    return { accessToken: this.jwt.sign(user), tokenType: 'Bearer', user };
  }
}
