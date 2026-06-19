'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import CountryPanel from '@/components/CountryPanel';
import ChatPanel from '@/components/ChatPanel';
import GlobeView from '@/components/GlobeView';
import SettingsDrawer from '@/components/SettingsDrawer';
import AuthScreen from '@/components/AuthScreen';
import { accessToken, api, setAccessToken } from '@/lib/api';
import type { AuthSession, AuthUser } from '@/lib/types';

function EyeLogo() {
  return (
    <svg
      className="brand-eye"
      viewBox="0 0 36 36"
      width="26"
      height="26"
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.5"
      >
        <line x1="18" y1="1.5" x2="18" y2="5.5" />
        <line x1="18" y1="30.5" x2="18" y2="34.5" />
        <line x1="4" y1="7" x2="7" y2="10" />
        <line x1="32" y1="7" x2="29" y2="10" />
        <line x1="4" y1="29" x2="7" y2="26" />
        <line x1="32" y1="29" x2="29" y2="26" />
        <line x1="1.5" y1="18" x2="5.5" y2="18" />
        <line x1="34.5" y1="18" x2="30.5" y2="18" />
      </g>
      <path
        d="M6,18 Q18,8 30,18 Q18,28 6,18 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="18" cy="18" r="5" fill="currentColor" />
      <circle cx="18" cy="18" r="2" fill="var(--bg)" />
      <circle cx="19.6" cy="16.3" r="0.85" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

export default function Home() {
  const [selected, setSelected] = useState('TR');
  const [showSettings, setShowSettings] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [today, setToday] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setToday(
      new Intl.DateTimeFormat('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date()),
    );
  }, []);

  useEffect(() => {
    if (!accessToken()) {
      setAuthReady(true);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => setAccessToken(null))
      .finally(() => setAuthReady(true));
  }, []);

  const countriesQ = useQuery({
    queryKey: ['globe-countries'],
    queryFn: api.globeCountries,
    enabled: authReady && Boolean(user),
  });
  const countries = useMemo(() => countriesQ.data ?? [], [countriesQ.data]);

  const handleSelect = useCallback((iso: string) => setSelected(iso), []);

  if (!authReady) return <main className="auth-shell" />;
  if (!user) {
    return (
      <AuthScreen
        onAuthenticated={(session: AuthSession) => setUser(session.user)}
      />
    );
  }

  return (
    <main
      className={`app${leftOpen ? '' : ' l-closed'}${rightOpen ? '' : ' r-closed'}`}
    >
      <GlobeView
        selectedIso2={selected}
        onSelect={handleSelect}
        countries={countries}
      />

      <header className="topbar">
        <div className="tb-brand">
          <EyeLogo />
          <span className="tb-name">
            Gören<span className="tb-accent"> Göz</span>
          </span>
        </div>
        <div className="tb-actions">
          {today && <span className="tb-chip tb-date">{today}</span>}
          <button
            className="tb-chip tb-btn"
            onClick={() => setShowSettings(true)}
          >
            ⚙ AI Sağlayıcı
          </button>
          <button
            className="tb-chip tb-btn"
            onClick={() => {
              setAccessToken(null);
              setUser(null);
            }}
          >
            Çıkış
          </button>
        </div>
      </header>

      <ChatPanel iso2={selected} onClose={() => setLeftOpen(false)} />
      {!leftOpen && (
        <button
          className="reopen reopen-l"
          onClick={() => setLeftOpen(true)}
          title="Sohbeti aç"
        >
          💬
        </button>
      )}

      <CountryPanel
        iso2={selected}
        isAdmin={user.role === 'admin'}
        onClose={() => setRightOpen(false)}
      />
      {!rightOpen && (
        <button
          className="reopen reopen-r"
          onClick={() => setRightOpen(true)}
          title="Paneli aç"
        >
          ‹
        </button>
      )}

      <SettingsDrawer open={showSettings} onClose={() => setShowSettings(false)} />

      {countriesQ.isError && (
        <div className="api-warn">
          API'ye bağlanılamadı (localhost:4000). Küre yine de gezilebilir.
        </div>
      )}
    </main>
  );
}
