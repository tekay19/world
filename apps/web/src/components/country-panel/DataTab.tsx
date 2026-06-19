'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ExternalPrior, MarketSignal, StructuralIndicator } from '@/lib/types';
import { fmtNum } from './shared';

export default function DataTab({ iso2 }: { iso2: string }) {
  const structuralQ = useQuery({
    queryKey: ['structural', iso2],
    queryFn: () => api.structural(iso2),
  });
  const signalsQ = useQuery({
    queryKey: ['signals'],
    queryFn: () => api.signals(),
  });
  const priorsQ = useQuery({
    queryKey: ['priors', iso2],
    queryFn: () => api.priors(iso2),
  });

  const trendIcon = (t: string | null) =>
    t === 'up' ? '↑' : t === 'down' ? '↓' : t === 'flat' ? '→' : '';

  return (
    <div className="cp-tabbody">
      <section className="cp-sec">
        <div className="cp-sec-head">
          <h4>Makro Göstergeler</h4>
          <span className="cp-muted small">Dünya Bankası</span>
        </div>
        {structuralQ.isLoading && <p className="cp-muted">Yükleniyor…</p>}
        {!structuralQ.isLoading && (structuralQ.data ?? []).length === 0 && (
          <p className="cp-empty">Bu ülke için yapısal veri yok.</p>
        )}
        <div className="cp-grid">
          {(structuralQ.data ?? []).map((m: StructuralIndicator) => (
            <div key={m.key} className="cp-metric">
              <span className="cp-metric-label">{m.label}</span>
              <span className="cp-metric-val">
                {m.display}
                <i className={`cp-trend t-${m.trend ?? 'na'}`}>
                  {trendIcon(m.trend)}
                </i>
              </span>
              <span className="cp-metric-sub">{m.year}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="cp-sec">
        <div className="cp-sec-head">
          <h4>Piyasa Sinyalleri</h4>
          <span className="cp-muted small">FRED · TwelveData · ECB</span>
        </div>
        {signalsQ.isLoading && <p className="cp-muted">Yükleniyor…</p>}
        <div className="cp-grid">
          {(signalsQ.data ?? []).map((m: MarketSignal) => (
            <div key={m.key} className="cp-metric">
              <span className="cp-metric-label">{m.label}</span>
              <span className="cp-metric-val">{fmtNum(m.value)}</span>
              <span className="cp-metric-sub">
                {m.changePct != null && (
                  <em className={m.changePct >= 0 ? 'pos' : 'neg'}>
                    {m.changePct >= 0 ? '+' : ''}
                    {m.changePct.toFixed(1)}%{' '}
                  </em>
                )}
                {m.source}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="cp-sec">
        <div className="cp-sec-head">
          <h4>Dış Priorlar</h4>
          <span className="cp-muted small">tahmin piyasası</span>
        </div>
        {priorsQ.isLoading && <p className="cp-muted">Piyasalar sorgulanıyor…</p>}
        {!priorsQ.isLoading && (priorsQ.data ?? []).length === 0 && (
          <p className="cp-empty">İlgili açık piyasa bulunamadı.</p>
        )}
        <div className="cp-priors">
          {(priorsQ.data ?? []).map((p: ExternalPrior, i) => (
            <a
              key={i}
              className="cp-prior"
              href={p.url}
              target="_blank"
              rel="noreferrer"
            >
              <div className="cp-prior-top">
                <span className={`cp-src ${p.source}`}>{p.source}</span>
                {p.probability != null && (
                  <span className="cp-prior-pct">
                    {Math.round(p.probability * 100)}%
                  </span>
                )}
              </div>
              <span className="cp-prior-q">{p.question}</span>
              {p.probability != null && (
                <div className="cp-prior-bar">
                  <div
                    className="cp-prior-fill"
                    style={{ width: `${p.probability * 100}%` }}
                  />
                </div>
              )}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ===================== KALİBRASYON ===================== */
