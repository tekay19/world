'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ScenarioReport } from '@/lib/types';

function paras(text: string) {
  return text
    .split(/\n\n+/)
    .filter((p) => p.trim())
    .map((p, i) => (
      <p key={i} className="rr-p">
        {p.trim()}
      </p>
    ));
}

export default function ScenarioReportView({
  report,
  onClose,
  onDelete,
}: {
  report: ScenarioReport;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const scenarios = [...(report.scenarios ?? [])].sort(
    (a, b) => b.probability - a.probability,
  );
  const date = new Date(report.created_at).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div className="rr-overlay" onClick={onClose}>
      <article className="rr-doc" onClick={(e) => e.stopPropagation()}>
        <button className="rr-close" onClick={onClose} aria-label="Kapat">
          ✕
        </button>

        <div className="rr-kicker">
          <span className="rr-horizon">{report.horizon ?? '5 yıl'}</span>
          STRATEJİK ÖNGÖRÜ RAPORU
        </div>
        {report.title && <h1 className="rr-title">{report.title}</h1>}
        {report.framing && <p className="rr-lead">{report.framing}</p>}
        <div className="rr-meta">
          {report.model ?? '—'} · {date}
          {report.confidence && <> · güven: {report.confidence}</>}
          {report.sources?.length > 0 && <> · {report.sources.length} kaynak</>}
        </div>

        {report.thesis && (
          <section className="rr-thesis">
            <h2 className="rr-h2">Ana Tahmin</h2>
            {paras(report.thesis)}
          </section>
        )}

        {scenarios.length > 0 && (
          <section className="rr-sec">
            <h2 className="rr-h2">Senaryo Dağılımı</h2>
            <div className="rr-scns">
              {scenarios.map((sc, i) => (
                <div key={i} className="rr-scn">
                  <div className="rr-scn-top">
                    <span className="rr-scn-prob">
                      {Math.round((sc.probability ?? 0) * 100)}%
                    </span>
                    <h3 className="rr-scn-label">{sc.label}</h3>
                  </div>
                  <div className="rr-scn-bar">
                    <div
                      className="rr-scn-fill"
                      style={{ width: `${Math.round((sc.probability ?? 0) * 100)}%` }}
                    />
                  </div>
                  {sc.summary && <p className="rr-scn-sum">{sc.summary}</p>}
                  {sc.consequences?.length > 0 && (
                    <ul className="rr-ul">
                      {sc.consequences.map((c, j) => (
                        <li key={j}>{c}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {(report.sections ?? []).map((s, i) => (
          <section key={i} className="rr-sec">
            <h2 className="rr-h2">{s.title}</h2>
            {paras(s.body)}
          </section>
        ))}

        {report.uncertainty && (
          <div className="rr-callout">
            <b>İndirgenemez belirsizlik.</b> {report.uncertainty}
          </div>
        )}

        {report.bottom_line && (
          <blockquote className="rr-quote">{report.bottom_line}</blockquote>
        )}

        {report.key_questions?.length > 0 && (
          <section className="rr-sec">
            <h2 className="rr-h2">Belirleyici Sorular</h2>
            <ul className="rr-ul rr-ul-q">
              {report.key_questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </section>
        )}

        {report.sources?.length > 0 && (
          <section className="rr-sec rr-sources">
            <h2 className="rr-h2">Kaynaklar</h2>
            <ol className="rr-srclist">
              {report.sources.map((s, i) => (
                <li key={i}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="rr-doc-foot">
          {onDelete && (
            <button
              className="rr-del"
              onClick={() => {
                if (confirm('Bu rapor silinsin mi?')) {
                  onDelete();
                  onClose();
                }
              }}
            >
              🗑 Raporu sil
            </button>
          )}
          <button className="rr-close-btn" onClick={onClose}>
            Kapat
          </button>
        </div>
      </article>
    </div>,
    document.body,
  );
}
