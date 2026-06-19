'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { FeedItem } from '@/lib/types';
import { timeAgo } from './shared';

export default function OverviewTab({
  iso2,
  risk,
  stab,
  agenda,
}: {
  iso2: string;
  risk: { label: string; tone: string; pct: number };
  stab: { label: string; tone: string };
  agenda: number | null;
  activeCount: number;
}) {
  const feedQ = useQuery({
    queryKey: ['feed', iso2],
    queryFn: () => api.feed(iso2, 8),
  });

  return (
    <div className="cp-tabbody">
      {agenda != null && (
        <div className="cp-kpis">
          <div className={`cp-kpi tone-${risk.tone}`}>
            <span className="cp-kpi-label">Genel Risk</span>
            <span className="cp-kpi-val">{risk.label}</span>
            <div className="cp-kpi-bar">
              <div className="cp-kpi-fill" style={{ width: `${risk.pct}%` }} />
            </div>
            <span className="cp-kpi-sub">{Math.round(agenda)}/100</span>
          </div>
          <div className={`cp-kpi tone-${stab.tone}`}>
            <span className="cp-kpi-label">İstikrar</span>
            <span className="cp-kpi-val">{stab.label}</span>
            <span className="cp-kpi-sub">gündem endeksi</span>
          </div>
        </div>
      )}

      <section className="cp-sec">
        <div className="cp-sec-head">
          <h4>Son Haberler</h4>
        </div>
        {feedQ.isLoading && <p className="cp-muted">Yükleniyor…</p>}
        {!feedQ.isLoading && (feedQ.data ?? []).length === 0 && (
          <p className="cp-empty">Bu ülke için henüz haber yok.</p>
        )}
        <div className="cp-news">
          {(feedQ.data ?? []).map((n: FeedItem, i) => (
            <a
              key={i}
              className="cp-news-item"
              href={n.url}
              target="_blank"
              rel="noreferrer"
            >
              <span className="cp-news-title">{n.title}</span>
              <span className="cp-news-meta">
                {n.source ?? '—'} · {timeAgo(n.published_at)}
              </span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ===================== TAHMİNLER ===================== */
