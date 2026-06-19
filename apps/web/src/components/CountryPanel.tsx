'use client';

import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { api } from '@/lib/api';
import OverviewTab from './country-panel/OverviewTab';
import { isoToFlag, riskBand, stabilityBand } from './country-panel/shared';

const PredictionsTab = dynamic(() => import('./country-panel/PredictionsTab'));
const ScenariosTab = dynamic(() => import('./country-panel/ScenariosTab'));
const DataTab = dynamic(() => import('./country-panel/DataTab'));
const CalibrationTab = dynamic(() => import('./country-panel/CalibrationTab'));

interface Props {
  iso2: string;
  isAdmin: boolean;
  onClose?: () => void;
}

type Tab = 'genel' | 'tahmin' | 'senaryo' | 'veri' | 'kalibrasyon';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'genel', label: 'Genel', icon: '◍' },
  { id: 'tahmin', label: 'Tahminler', icon: '◈' },
  { id: 'senaryo', label: 'Senaryolar', icon: '⌖' },
  { id: 'veri', label: 'Veri', icon: '▤' },
  { id: 'kalibrasyon', label: 'Kalibrasyon', icon: '◎' },
];

export default function CountryPanel({ iso2, isAdmin, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('genel');
  const countryQ = useQuery({
    queryKey: ['country', iso2],
    queryFn: () => api.country(iso2),
  });
  const predictionsQ = useQuery({
    queryKey: ['predictions', iso2],
    queryFn: () => api.predictions(iso2),
  });

  const country = countryQ.data?.country;
  const name = country?.name_tr ?? country?.name ?? iso2;
  const agenda = countryQ.data?.agenda?.score ?? null;
  const risk = riskBand(agenda);
  const stability = stabilityBand(agenda);
  const activeCount = (predictionsQ.data ?? []).filter(
    (prediction) => !prediction.resolved,
  ).length;

  return (
    <aside className="cpanel">
      <header className="cp-head">
        {onClose ? (
          <button
            className="panel-collapse"
            onClick={onClose}
            title="Paneli kapat"
          >
            ›
          </button>
        ) : null}
        <span className="cp-flag">{isoToFlag(iso2)}</span>
        <div className="cp-id">
          <div className="cp-name">{name}</div>
          <div className="cp-region">{country?.region ?? '—'}</div>
        </div>
        {agenda != null ? (
          <div className="cp-chips">
            <span className={'cp-chip tone-' + risk.tone}>
              Risk · {risk.label}
            </span>
          </div>
        ) : null}
      </header>

      <nav className="cp-tabs">
        {TABS.map((item) => (
          <button
            key={item.id}
            className={'cp-tab ' + (item.id === tab ? 'active' : '')}
            onClick={() => setTab(item.id)}
          >
            <span className="cp-tab-ico">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="cp-scroll">
        {tab === 'genel' ? (
          <OverviewTab
            iso2={iso2}
            risk={risk}
            stab={stability}
            agenda={agenda}
            activeCount={activeCount}
          />
        ) : null}
        {tab === 'tahmin' ? (
          <PredictionsTab
            iso2={iso2}
            preds={predictionsQ.data ?? []}
            isAdmin={isAdmin}
          />
        ) : null}
        {tab === 'senaryo' ? (
          <ScenariosTab iso2={iso2} isAdmin={isAdmin} />
        ) : null}
        {tab === 'veri' ? <DataTab iso2={iso2} /> : null}
        {tab === 'kalibrasyon' ? <CalibrationTab /> : null}
      </div>
    </aside>
  );
}
