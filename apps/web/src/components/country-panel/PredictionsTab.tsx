'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import type { Prediction, PredictionHistoryPoint } from '@/lib/types';
import CategoryStrip from './CategoryStrip';
import { confTone, pct } from './shared';

export default function PredictionsTab({
  iso2,
  preds,
  isAdmin,
}: {
  iso2: string;
  preds: Prediction[];
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const [cat, setCat] = useState('siyaset');
  const [stage, setStage] = useState('');

  const calibQ = useQuery({
    queryKey: ['calibration', cat],
    queryFn: () => api.calibration({ topic: cat }),
  });
  const generateMut = useMutation({
    // Aşama-ilerleme SSE: 20-60sn boyunca canlı "bağlam → araştırma → model → kayıt".
    mutationFn: () =>
      api.generatePredictionsStream(iso2, cat, (e) =>
        setStage(e.detail ?? e.stage),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['predictions', iso2] });
      qc.invalidateQueries({ queryKey: ['calibration', cat] });
    },
    onSettled: () => setStage(''),
  });
  const resolveMut = useMutation({
    mutationFn: (v: { id: string; outcome: boolean }) =>
      api.resolvePrediction(v.id, v.outcome),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['predictions', iso2] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deletePrediction(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['predictions', iso2] }),
  });
  const clearMut = useMutation({
    mutationFn: () => api.clearPredictions(iso2),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['predictions', iso2] }),
  });
  const repredictMut = useMutation({
    mutationFn: () => api.repredict(iso2),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['predictions', iso2] });
      qc.invalidateQueries({ queryKey: ['phist'] });
    },
  });

  const items = preds.filter((p) => p.topic === cat);
  const calib = calibQ.data;

  return (
    <div className="cp-tabbody">
      <CategoryStrip category={cat} onChange={setCat} />

      <div className="cp-sec-head">
        <h4>Gelecek tahminleri</h4>
        <div className="cp-actions">
          {isAdmin && preds.length > 0 && (
            <button
              className="cp-btn ghost sm"
              onClick={() => {
                if (confirm('Bu ülkenin TÜM tahminleri silinsin mi?'))
                  clearMut.mutate();
              }}
              disabled={clearMut.isPending}
            >
              🗑
            </button>
          )}
          {preds.length > 0 && (
            <button
              className="cp-btn ghost sm"
              title="Yeniden üret + aynı tahminleri eşle (olasılık sürüklenmesi)"
              onClick={() => repredictMut.mutate()}
              disabled={repredictMut.isPending}
            >
              {repredictMut.isPending ? 'Revize…' : '↻ Revize'}
            </button>
          )}
          <button
            className="cp-btn sm"
            onClick={() => generateMut.mutate()}
            disabled={generateMut.isPending}
          >
            {generateMut.isPending ? 'Üretiliyor…' : '✨ Üret'}
          </button>
        </div>
      </div>

      {generateMut.isPending && (
        <p className="cp-muted">
          <span className="cp-spin" aria-hidden /> {stage || 'Başlatılıyor…'}
        </p>
      )}
      {generateMut.isError && (
        <p className="cp-err">{(generateMut.error as Error).message}</p>
      )}
      {items.length === 0 && !generateMut.isPending && (
        <p className="cp-empty">
          Bu kategoride tahmin yok. <b>✨ Üret</b> — haberlerden kesin-yön'lü,
          kalibre, gerekçeli öngörüler çıkarır.
        </p>
      )}

      {items.map((p) => (
        <PredictionCard
          key={p.id}
          p={p}
          onResolve={(o) => resolveMut.mutate({ id: p.id, outcome: o })}
          resolving={resolveMut.isPending}
          onDelete={() => deleteMut.mutate(p.id)}
          isAdmin={isAdmin}
        />
      ))}

      {items.length > 0 && (
        <div className="cp-calib-strip">
          {!calib || calib.count === 0 ? (
            <span className="cp-muted">
              Kalibrasyon: henüz çözülmüş tahmin yok (vade gelince ölçülür).
            </span>
          ) : (
            <span className="cp-muted">
              {calib.count} çözülmüş · Brier{' '}
              <b className="mono">{calib.meanBrier?.toFixed(3)}</b> (naif 0.5 ={' '}
              {calib.baseline.halfAlways.toFixed(3)})
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function DriftBlock({ hist }: { hist: PredictionHistoryPoint[] }) {
  const pts = hist.map((h) => Math.round((h.probability ?? 0) * 100));
  const first = pts[0];
  const last = pts[pts.length - 1];
  const delta = last - first;
  const W = 130;
  const H = 30;
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const range = Math.max(1, max - min);
  const path = pts
    .map((v, i) => {
      const x = pts.length > 1 ? (i / (pts.length - 1)) * (W - 4) + 2 : W / 2;
      const y = H - 3 - ((v - min) / range) * (H - 6);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const d = (s: string) =>
    new Date(s).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  return (
    <div className="cp-drift">
      <span className="cp-tag">📈 Olasılık sürüklenmesi · {hist.length} revizyon</span>
      <div className="cp-drift-row">
        <svg
          className="cp-spark"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
        >
          <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />
        </svg>
        <span className="cp-drift-val">
          {first}%{' '}
          <span className={delta >= 0 ? 'pos' : 'neg'}>
            {delta >= 0 ? '↗' : '↘'} {Math.abs(delta)} puan
          </span>{' '}
          → <b>{last}%</b>
        </span>
      </div>
      <span className="cp-muted small">
        {d(hist[0].generated_at)} → {d(hist[hist.length - 1].generated_at)}
      </span>
    </div>
  );
}

function PredictionCard({
  p,
  onResolve,
  resolving,
  onDelete,
  isAdmin,
}: {
  p: Prediction;
  onResolve: (outcome: boolean) => void;
  resolving: boolean;
  onDelete: () => void;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const prob = p.probability ?? 0;
  const dateStr = new Date(p.resolve_at).toLocaleDateString('tr-TR');
  const due = new Date(p.resolve_at).getTime() <= Date.now();

  const histQ = useQuery({
    queryKey: ['phist', p.id],
    queryFn: () => api.predictionHistory(p.id),
    enabled: open,
  });
  const hist = (histQ.data ?? []).filter((h) => h.probability != null);

  return (
    <div className={`cp-pred ${p.resolved ? 'resolved' : ''}`}>
      <button className="cp-pred-row" onClick={() => setOpen((v) => !v)}>
        <div className="cp-pred-prob">
          <span className="cp-pred-pct">{pct(prob)}</span>
          <span className={`cp-pred-badge cf-${confTone(p.confidence)}`}>
            {p.confidence ?? '—'}
          </span>
        </div>
        <div className="cp-pred-main">
          <div className="cp-pred-claim">{p.question}</div>
          <div className="cp-pred-meta">
            <span>Çözüm {dateStr}</span>
            <span>Baz {pct(p.base_rate)}</span>
          </div>
        </div>
        <span className={`cp-chev ${open ? 'open' : ''}`}>›</span>
      </button>
      <div className="cp-pred-track">
        <div className="cp-pred-fill" style={{ width: `${prob * 100}%` }} />
      </div>

      {open && (
        <div className="cp-pred-detail">
          {hist.length > 1 && <DriftBlock hist={hist} />}
          {p.rationale && (
            <div className="cp-block">
              <span className="cp-tag">💬 Yorum</span>
              {p.rationale}
            </div>
          )}
          {p.resolution_criteria && (
            <div className="cp-block">
              <span className="cp-tag">Çözümleme kriteri</span>
              {p.resolution_criteria}
            </div>
          )}
          {p.counter_argument && (
            <div className="cp-block counter">
              <span className="cp-tag">⚖ Karşı-tez</span>
              {p.counter_argument}
            </div>
          )}

          {p.resolved ? (
            <div className={`cp-result ${p.outcome ? 'yes' : 'no'}`}>
              {p.outcome ? '✓ Gerçekleşti' : '✗ Gerçekleşmedi'}
              {p.brier != null && (
                <span className="cp-muted small"> · Brier {p.brier.toFixed(3)}</span>
              )}
            </div>
          ) : (
            due && isAdmin && (
              <div className="cp-resolve">
                <span className="cp-muted small">Çözümle:</span>
                <button
                  className="cp-btn ghost xs"
                  disabled={resolving}
                  onClick={() => onResolve(true)}
                >
                  ✓ Oldu
                </button>
                <button
                  className="cp-btn ghost xs"
                  disabled={resolving}
                  onClick={() => onResolve(false)}
                >
                  ✗ Olmadı
                </button>
              </div>
            )
          )}
          {isAdmin && <div className="cp-pred-foot">
            <button
              className="cp-del"
              onClick={() => {
                if (confirm('Bu tahmin silinsin mi?')) onDelete();
              }}
            >
              🗑 Sil
            </button>
          </div>}
        </div>
      )}
    </div>
  );
}

/* ===================== SENARYOLAR (makale okuyucu) ===================== */
