'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { agendaColor, featureIso2, featureName, type GeoProps } from '@/lib/geo';
import type { GlobeCountry } from '@/lib/types';

// Natural Earth 110m ülke poligonları (CORS açık raw kaynak).
const GEOJSON_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

// Sinematik doku katmanları — hepsi bir kez yüklenir, GPU'da ucuz (kasmaz).
const TEX = {
  day: 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg', // gündüz yüzeyi
  topo: 'https://unpkg.com/three-globe/example/img/earth-topology.png', // kabartma (dağ rölyefi)
  water: 'https://unpkg.com/three-globe/example/img/earth-water.png', // okyanus maskesi (specular parlama)
  sky: 'https://unpkg.com/three-globe/example/img/night-sky.png', // yıldız alanı
  clouds:
    'https://raw.githubusercontent.com/turban/webgl-earth/master/images/fair_clouds_4k.png',
};

interface Feature {
  type: 'Feature';
  properties: GeoProps;
  geometry: { type: string; coordinates: unknown };
}

// Sabit (render'lar arası değişmeyen) accessor'lar — Globe katmanlarını boşuna
// güncellememek için modül düzeyinde tanımlı.
const SIDE_COLOR = () => 'rgba(0, 40, 70, 0.35)';
const STROKE_COLOR = () => 'rgba(8, 18, 28, 0.7)';
const RING_COLOR = () => (t: number) => `rgba(245, 179, 1, ${Math.max(0, 1 - t) * 0.85})`;

interface Props {
  selectedIso2: string;
  onSelect: (iso2: string) => void;
  countries: GlobeCountry[];
}

/** GeoJSON poligonundan kaba centroid (POV için yeterli). */
function featureCentroid(feature: Feature): { lat: number; lng: number } | null {
  const coords: number[][] = [];
  const walk = (arr: unknown): void => {
    if (!Array.isArray(arr)) return;
    if (typeof arr[0] === 'number' && typeof arr[1] === 'number') {
      coords.push(arr as number[]);
    } else {
      for (const a of arr) walk(a);
    }
  };
  walk(feature.geometry.coordinates);
  if (!coords.length) return null;
  let sx = 0;
  let sy = 0;
  for (const [lng, lat] of coords) {
    sx += lng;
    sy += lat;
  }
  return { lng: sx / coords.length, lat: sy / coords.length };
}

export default function GlobeGL({ selectedIso2, onSelect, countries }: Props) {
  const globeRef = useRef<any>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudsRef = useRef<THREE.Mesh | null>(null);
  const rafRef = useRef<number | null>(null);

  // Sinematik küre yüzeyi: gündüz dokusu + kabartma rölyefi + okyanus specular
  // parlaması. Dokular asenkron yüklenip materyale işlenir (bir kez; sonrası GPU).
  const globeMaterial = useMemo(() => {
    const mat = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(TEX.day, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      mat.map = t;
      mat.needsUpdate = true;
    });
    loader.load(TEX.topo, (t) => {
      mat.bumpMap = t;
      mat.bumpScale = 5;
      mat.needsUpdate = true;
    });
    loader.load(TEX.water, (t) => {
      mat.specularMap = t;
      mat.specular = new THREE.Color(0x2a3b57); // okyanusta loş mavi güneş parlaması
      mat.shininess = 14;
      mat.needsUpdate = true;
    });
    return mat;
  }, []);

  const [polygons, setPolygons] = useState<Feature[]>([]);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [ready, setReady] = useState(false);

  // iso2 → ülke (gündem skoru + konum)
  const byIso2 = useMemo(() => {
    const m = new Map<string, GlobeCountry>();
    for (const c of countries) m.set(c.iso2.toUpperCase(), c);
    return m;
  }, [countries]);

  const featureByIso2 = useMemo(() => {
    const m = new Map<string, Feature>();
    for (const f of polygons) {
      const iso = featureIso2(f.properties);
      if (iso) m.set(iso, f);
    }
    return m;
  }, [polygons]);

  // Pencere boyutu (küre tam ekran arka plan)
  useEffect(() => {
    const update = () => setDims({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // GeoJSON yükle
  useEffect(() => {
    let alive = true;
    fetch(GEOJSON_URL)
      .then((r) => r.json())
      .then((data: { features: Feature[] }) => {
        if (!alive) return;
        const feats = (data.features ?? []).filter(
          (f) => featureName(f.properties) !== 'Antarctica',
        );
        setPolygons(feats);
      })
      .catch(() => setPolygons([]));
    return () => {
      alive = false;
    };
  }, []);

  const centroidFor = useCallback(
    (iso2: string): { lat: number; lng: number } | null => {
      const c = byIso2.get(iso2);
      if (c && c.lat != null && c.lng != null) return { lat: c.lat, lng: c.lng };
      const f = featureByIso2.get(iso2);
      return f ? featureCentroid(f) : null;
    },
    [byIso2, featureByIso2],
  );

  // Küre hazır → otomatik dönüş + etkileşimde durdur/sürdür + zoom sınırları
  const handleReady = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    // Performans: retina'da pixel ratio'yu sınırla (DPR 2 = 4x piksel → ağır/janklı).
    const renderer = g.renderer?.();
    if (renderer?.setPixelRatio) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    }
    const controls = g.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.45; // hafif, akıcı dönüş
    controls.enableDamping = true;
    controls.dampingFactor = 0.12; // akıcı atalet
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 1.1;
    // Tekerlek/pinch zoom sınırları (yüzeye fazla yapışmasın, çok uzaklaşmasın)
    controls.minDistance = 135;
    controls.maxDistance = 480;

    const pause = () => {
      controls.autoRotate = false;
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
    const scheduleResume = () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      resumeTimer.current = setTimeout(() => {
        controls.autoRotate = true;
      }, 2500); // etkileşimden sonra daha çabuk yeniden dön
    };
    controls.addEventListener('start', pause);
    controls.addEventListener('end', scheduleResume);

    // --- Sinematik sahne: stüdyo ışıklandırma + kayan bulut katmanı ---
    try {
      const scene = g.scene();
      // Mevcut ışıkları stüdyo düzenine al (göreli ayar — three sürümünden bağımsız).
      scene.traverse((o: any) => {
        if (o.isDirectionalLight) {
          o.color.set(0xfff2e0); // sıcak güneş (key light)
          o.position.set(1.2, 0.6, 1); // yandan → belirgin terminatör + okyanus parlaması
        } else if (o.isAmbientLight) {
          o.color.set(0x4a5d80); // soğuk dolgu — gece tarafı tamamen kararmasın
          o.intensity *= 1.15;
        }
      });
      // Arkadan soğuk kenar (rim) ışığı — sinematik silüet hâlesi.
      const rim = new THREE.DirectionalLight(0x6f9bff, 0.55);
      rim.position.set(-1.4, -0.4, -1.2);
      scene.add(rim);

      // Bulut katmanı: yüzeyin hemen üstünde, yavaşça kayan ayrı yarı-saydam küre.
      const R = g.getGlobeRadius();
      const cloudsMat = new THREE.MeshPhongMaterial({
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      });
      new THREE.TextureLoader().load(TEX.clouds, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        cloudsMat.map = t;
        cloudsMat.needsUpdate = true;
      });
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(R * 1.015, 64, 48),
        cloudsMat,
      );
      scene.add(clouds);
      cloudsRef.current = clouds;

      const drift = () => {
        if (cloudsRef.current) cloudsRef.current.rotation.y += 0.00035; // hafif kayış
        rafRef.current = requestAnimationFrame(drift);
      };
      drift();
    } catch {
      /* sahne erişimi beklenenden farklıysa sessiz geç — küre yine çalışır */
    }

    // Giriş animasyonu: uzaktan başla; seçim efekti ülkeye süzülecek.
    g.pointOfView({ altitude: 3.6 }, 0);

    setReady(true);
  }, []);

  // Unmount'ta bulut sürüş döngüsünü durdur.
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Zoom kontrolleri (altitude tabanlı, sınırlı, akıcı geçiş)
  const ZOOM_MIN = 0.28;
  const ZOOM_MAX = 3.6;
  const zoom = useCallback((factor: number) => {
    const g = globeRef.current;
    if (!g) return;
    const pov = g.pointOfView();
    const altitude = Math.min(
      ZOOM_MAX,
      Math.max(ZOOM_MIN, (pov.altitude ?? 1.7) * factor),
    );
    g.pointOfView({ altitude }, 350);
  }, []);

  const resetView = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    const c = centroidFor(selectedIso2);
    g.pointOfView(
      c ? { lat: c.lat, lng: c.lng, altitude: 1.7 } : { altitude: 2.3 },
      800,
    );
  }, [selectedIso2, centroidFor]);

  // Seçim değişince ülkeye dön + konum halkası
  useEffect(() => {
    if (!ready || !globeRef.current) return;
    const c = centroidFor(selectedIso2);
    if (!c) return;
    globeRef.current.pointOfView(
      { lat: c.lat, lng: c.lng, altitude: 1.7 },
      1200,
    );
  }, [ready, selectedIso2, centroidFor]);

  const ringsData = useMemo(() => {
    const c = centroidFor(selectedIso2);
    return c ? [{ lat: c.lat, lng: c.lng }] : [];
  }, [selectedIso2, centroidFor]);

  // Stabil accessor'lar — yalnız seçim/veri değişince yeniden oluşur (kasmayı önler).
  const polygonAltitude = useCallback(
    (d: object) => {
      const iso = featureIso2((d as Feature).properties);
      return iso && iso === selectedIso2 ? 0.06 : 0.012;
    },
    [selectedIso2],
  );
  const polygonCapColor = useCallback(
    (d: object) => {
      const iso = featureIso2((d as Feature).properties);
      if (iso && iso === selectedIso2) return '#f5b301';
      const score = iso ? byIso2.get(iso)?.agendaScore ?? null : null;
      return agendaColor(score);
    },
    [selectedIso2, byIso2],
  );
  const polygonLabel = useCallback(
    (d: object) => {
      const f = d as Feature;
      const iso = featureIso2(f.properties);
      const c = iso ? byIso2.get(iso) : undefined;
      const nm = c?.name_tr ?? featureName(f.properties);
      const score = c?.agendaScore;
      return `<div class="globe-tooltip"><b>${nm}</b>${
        iso ? ` <span class="iso">${iso}</span>` : ''
      }${score != null ? `<br/>Gündem endeksi: ${Math.round(score)}` : ''}</div>`;
    },
    [byIso2],
  );
  const onPolygonClick = useCallback(
    (d: object) => {
      const iso = featureIso2((d as Feature).properties);
      if (iso) onSelect(iso);
    },
    [onSelect],
  );

  if (!dims) {
    return (
      <div className="globe-loading" role="status">
        Dünya yükleniyor…
      </div>
    );
  }

  return (
    <>
    <Globe
      ref={globeRef}
      width={dims.w}
      height={dims.h}
      onGlobeReady={handleReady}
      backgroundColor="rgba(0,0,0,0)"
      backgroundImageUrl={TEX.sky}
      globeMaterial={globeMaterial}
      showAtmosphere
      atmosphereColor="#5b9bff"
      atmosphereAltitude={0.2}
      rendererConfig={{ antialias: false, powerPreference: 'high-performance' }}
      // Ülke poligonları (stabil accessor'lar — hover state yok → kasma yok)
      polygonsData={polygons}
      polygonsTransitionDuration={0}
      polygonAltitude={polygonAltitude}
      polygonCapColor={polygonCapColor}
      polygonSideColor={SIDE_COLOR}
      polygonStrokeColor={STROKE_COLOR}
      polygonLabel={polygonLabel}
      onPolygonClick={onPolygonClick}
      // Seçili ülke konum halkası (pulse)
      ringsData={ringsData}
      ringColor={RING_COLOR}
      ringMaxRadius={5}
      ringPropagationSpeed={2.4}
      ringRepeatPeriod={650}
      ringAltitude={0.011}
    />

    {/* Zoom / görünüm kontrolleri */}
    <div className="globe-controls" role="group" aria-label="Küre kontrolleri">
      <button type="button" title="Yakınlaştır" aria-label="Yakınlaştır" onClick={() => zoom(0.7)}>
        ＋
      </button>
      <button type="button" title="Uzaklaştır" aria-label="Uzaklaştır" onClick={() => zoom(1.42)}>
        －
      </button>
      <button type="button" title="Seçili ülkeye dön" aria-label="Görünümü sıfırla" onClick={resetView}>
        ⟳
      </button>
    </div>
    </>
  );
}
