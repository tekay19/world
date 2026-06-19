'use client';

import { FormEvent, useState } from 'react';
import { api, setAccessToken } from '@/lib/api';
import type { AuthSession } from '@/lib/types';

export default function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (session: AuthSession) => void;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const session = await api[mode](email, password);
      setAccessToken(session.accessToken);
      onAuthenticated(session);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Oturum açılamadı.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-shell">
      <form className="auth-form" onSubmit={submit}>
        <div className="auth-brand">Gören Göz</div>
        <h1>{mode === 'login' ? 'Oturum aç' : 'Hesap oluştur'}</h1>
        <label>
          E-posta
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Parola
          <input
            type="password"
            minLength={10}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? 'Bekleyin…' : mode === 'login' ? 'Giriş yap' : 'Kaydol'}
        </button>
        <button
          type="button"
          className="auth-switch"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'Yeni hesap oluştur' : 'Zaten hesabım var'}
        </button>
      </form>
    </main>
  );
}
