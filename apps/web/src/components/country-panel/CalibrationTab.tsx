'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function CalibrationTab() {
  const calibQ = useQuery({
    queryKey: ['calibration', 'all'],
    queryFn: () => api.calibration(),
  });
  const c = calibQ.data;

  if (calibQ.isLoading) return <div className="cp-tabbody"><p className="cp-muted">Yükleniyor…</p></div>;
  if (!c || c.count === 0)
    return (
      <div className="cp-tabbody">
        <div className="cp-unproven">
          <span className="cp-unproven-badge">⚠ HENÜZ KANITLANMADI</span>
          <p>
            Bu sistemin tahmin doğruluğu <b>henüz ölçülmedi</b> — şu ana kadar{' '}
            <b>0 tahmin çözüldü</b>. Olasılıklar şu an "gerekçeli tahmin"dir,{' '}
            <b>kanıtlanmış isabet değil</b>.
          </p>
          <p className="cp-muted small">
            Tahminler vadesi geldikçe otomatik çözülür — kur/petrol/altın/Fed gibi
            sayısal hedefler gerçek piyasa verisiyle, diğerleri llm-hakemle — ve
            Brier skoru burada birikir. Doğruluk ancak o zaman kanıtlanır.
          </p>
        </div>
      </div>
    );

  const beatsHalf = (c.meanBrier ?? 1) < c.baseline.halfAlways;

  return (
    <div className="cp-tabbody">
      <div className="cp-kpis">
        <div className={`cp-kpi ${beatsHalf ? 'tone-ok' : 'tone-danger'}`}>
          <span className="cp-kpi-label">Brier Skoru</span>
          <span className="cp-kpi-val">{c.meanBrier?.toFixed(3)}</span>
          <span className="cp-kpi-sub">düşük = iyi</span>
        </div>
        <div className="cp-kpi tone-info">
          <span className="cp-kpi-label">Çözülmüş</span>
          <span className="cp-kpi-val accent">{c.count}</span>
          <span className="cp-kpi-sub">tahmin</span>
        </div>
        <div className="cp-kpi">
          <span className="cp-kpi-label">Naif 0.5</span>
          <span className="cp-kpi-val">{c.baseline.halfAlways.toFixed(3)}</span>
          <span className="cp-kpi-sub">referans</span>
        </div>
      </div>

      <div className={`cp-verdict ${beatsHalf ? 'ok' : 'warn'}`}>{c.verdict}</div>

      <section className="cp-sec">
        <div className="cp-sec-head">
          <h4>Güvenilirlik Eğrisi</h4>
        </div>
        <div className="cp-curve">
          {c.buckets.map((b, i) => (
            <div key={i} className="cp-curve-col" title={`${b.n} tahmin`}>
              <div className="cp-curve-bars">
                <div
                  className="cp-curve-pred"
                  style={{ height: `${(b.predicted ?? 0) * 100}%` }}
                />
                <div
                  className="cp-curve-obs"
                  style={{ height: `${(b.observed ?? 0) * 100}%` }}
                />
              </div>
              <span className="cp-curve-x">{Math.round(b.lo * 100)}</span>
            </div>
          ))}
        </div>
        <div className="cp-legend">
          <span><i className="sw pred" /> Tahmin edilen</span>
          <span><i className="sw obs" /> Gözlenen</span>
        </div>
      </section>

      {c.byModel.length > 0 && (
        <section className="cp-sec">
          <div className="cp-sec-head">
            <h4>Modele Göre</h4>
          </div>
          {c.byModel.map((m) => (
            <div key={m.key} className="cp-rank">
              <span className="cp-rank-key">{m.key}</span>
              <span className="cp-muted small">{m.count}</span>
              <b className="mono">{m.meanBrier.toFixed(3)}</b>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
