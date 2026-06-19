'use client';

import dynamic from 'next/dynamic';
import type { GlobeCountry } from '@/lib/types';

// react-globe.gl yalnızca istemcide (Three.js, window) — ssr:false şart.
const GlobeGL = dynamic(() => import('./GlobeGL'), {
  ssr: false,
  loading: () => <div className="globe-loading">Dünya yükleniyor…</div>,
});

interface Props {
  selectedIso2: string;
  onSelect: (iso2: string) => void;
  countries: GlobeCountry[];
}

export default function GlobeView(props: Props) {
  return (
    <div className="globe-stage">
      <GlobeGL {...props} />
    </div>
  );
}
