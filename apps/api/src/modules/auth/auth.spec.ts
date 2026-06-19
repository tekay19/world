import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from './jwt.service';
import { PasswordService } from './password.service';
import { JwtAuthGuard } from './jwt-auth.guard';

test('JWT imzalı oturumu doğrular ve değiştirilmiş tokenı reddeder', () => {
  const jwt = new JwtService(
    new ConfigService({
      JWT_SECRET: 'test-secret-that-is-longer-than-thirty-two-characters',
      JWT_ACCESS_TTL: 900,
    }),
  );
  const token = jwt.sign({ id: '42', email: 'user@example.com', role: 'user' });
  assert.equal(jwt.verify(token).sub, '42');

  const parts = token.split('.');
  const tamperedPayload = Buffer.from(
    JSON.stringify({ ...jwt.verify(token), role: 'admin' }),
  ).toString('base64url');
  assert.throws(
    () => jwt.verify(`${parts[0]}.${tamperedPayload}.${parts[2]}`),
    UnauthorizedException,
  );
});

test('parola özeti doğru parolayı kabul eder, yanlış parolayı reddeder', async () => {
  const passwords = new PasswordService();
  const hash = await passwords.hash('uzun-ve-guvenli-parola');
  assert.equal(await passwords.verify('uzun-ve-guvenli-parola', hash), true);
  assert.equal(await passwords.verify('yanlis-parola', hash), false);
  assert.equal(await passwords.verify('uzun-ve-guvenli-parola', 'no-auth-local-mode'), false);
});

test('korumalı HTTP yolu bearer token olmadan reddedilir', async () => {
  const jwt = new JwtService(
    new ConfigService({
      JWT_SECRET: 'test-secret-that-is-longer-than-thirty-two-characters',
      JWT_ACCESS_TTL: 900,
    }),
  );
  const guard = new JwtAuthGuard(new Reflector(), jwt, {
    userById: async () => null,
  } as never);
  const handler = () => undefined;
  class Controller {}
  const context = {
    getHandler: () => handler,
    getClass: () => Controller,
    switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
  } as unknown as ExecutionContext;
  await assert.rejects(() => guard.canActivate(context), UnauthorizedException);
});
