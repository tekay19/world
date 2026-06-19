'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import type { ScenarioReport } from '@/lib/types';
import ScenarioReportView from '../ScenarioReportView';
import CategoryStrip from './CategoryStrip';

export default function ScenariosTab({ iso2, isAdmin }: { iso2: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [cat, setCat] = useState('siyaset');
  const [openReport, setOpenReport] = useState<ScenarioReport | null>(null);

  const [stage, setStage] = useState('');

  const scenariosQ = useQuery({
    queryKey: ['scenarios', iso2],
    queryFn: () => api.scenarios(iso2),
  });
  const genMut = useMutation({
    // Aşama-ilerleme SSE: boş ekran yerine canlı "bağlam → araştırma → model → kayıt".
    mutationFn: () =>
      api.generateScenariosStream(iso2, cat, 1825, (e) =>
        setStage(e.detail ?? e.stage),
      ),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['scenarios', iso2] });
      setOpenReport(r); // yeni rapor: hemen oku
    },
    onSettled: () => setStage(''),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => api.deleteScenario(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenarios', iso2] }),
  });

  const reports = scenariosQ.data ?? [];

  return (
    <div className="cp-tabbody">
      <CategoryStrip category={cat} onChange={setCat} />
      <div className="cp-sec-head">
        <h4>Stratejik Öngörü Raporu</h4>
        <button
          className="cp-btn sm"
          onClick={() => genMut.mutate()}
          disabled={genMut.isPending}
        >
          {genMut.isPending ? 'Yazılıyor…' : '✨ Rapor Üret'}
        </button>
      </div>
      <p className="cp-empty">
        Kehanet değil — güç dengeleri, ekonomi, seçim takvimi ve kurumsal gidişat
        üzerinden 5-yıl olasılık analizi. Canlı web kaynakları + makro veri +
        piyasa priorları uzun-form bir rapora sentezlenir.
      </p>
      {genMut.isPending && (
        <p className="cp-muted">
          <span className="cp-spin" aria-hidden /> {stage || 'Başlatılıyor…'}
        </p>
      )}
      {genMut.isError && <p className="cp-err">{(genMut.error as Error).message}</p>}
      {scenariosQ.isLoading && <p className="cp-muted">Yükleniyor…</p>}
      {!scenariosQ.isLoading && reports.length === 0 && !genMut.isPending && (
        <p className="cp-empty">
          Henüz rapor yok. <b>✨ Rapor Üret</b> ile başla.
        </p>
      )}

      <div className="cp-replist">
        {reports.map((r) => (
          <ReportCard key={r.id} r={r} onOpen={() => setOpenReport(r)} />
        ))}
      </div>

      {openReport && (
        <ScenarioReportView
          report={openReport}
          onClose={() => setOpenReport(null)}
          onDelete={isAdmin ? () => delMut.mutate(openReport.id) : undefined}
        />
      )}
    </div>
  );
}

function ReportCard({ r, onOpen }: { r: ScenarioReport; onOpen: () => void }) {
  const date = new Date(r.created_at).toLocaleDateString('tr-TR');
  const top = [...(r.scenarios ?? [])].sort(
    (a, b) => b.probability - a.probability,
  )[0];
  return (
    <button className="cp-repcard" onClick={onOpen}>
      <div className="cp-repcard-top">
        <span className="cp-horizon">{r.horizon ?? '5 yıl'}</span>
        <span className="cp-repcard-arrow">Oku →</span>
      </div>
      <div className="cp-repcard-title">{r.title ?? 'Senaryo Raporu'}</div>
      {top && (
        <div className="cp-repcard-scn">
          <b>{Math.round((top.probability ?? 0) * 100)}%</b> {top.label}
        </div>
      )}
      <div className="cp-repcard-meta">
        {r.sections?.length ?? 0} bölüm · {r.scenarios?.length ?? 0} senaryo ·{' '}
        {r.sources?.length ?? 0} kaynak · {date}
      </div>
    </button>
  );
}

/* ===================== VERİ ===================== */
