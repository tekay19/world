'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { ProviderMeta } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Status = { kind: 'idle' | 'ok' | 'err'; msg: string };

export default function SettingsDrawer({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [provider, setProvider] = useState('nvidia'); // NVIDIA varsayılan
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>({ kind: 'idle', msg: '' });

  async function pasteKey() {
    try {
      const t = await navigator.clipboard.readText();
      if (t) {
        setApiKey(t.trim());
        setShowKey(false);
      }
    } catch {
      setStatus({ kind: 'err', msg: 'Pano okunamadı (tarayıcı izni gerekebilir).' });
    }
  }

  const providersQ = useQuery({
    queryKey: ['llm-providers'],
    queryFn: api.llmProviders,
    enabled: open,
  });
  const savedQ = useQuery({
    queryKey: ['llm-saved'],
    queryFn: api.llmSaved,
    enabled: open,
  });

  const meta: ProviderMeta | undefined = useMemo(
    () => providersQ.data?.find((p) => p.id === provider),
    [providersQ.data, provider],
  );

  // Anahtar beklenen ön ekle başlıyor mu? (yalnızca yumuşak uyarı)
  const prefixOk =
    !meta?.keyPrefixHint || !apiKey || apiKey.startsWith(meta.keyPrefixHint);

  function selectProvider(id: string) {
    setProvider(id);
    setModels([]);
    setStatus({ kind: 'idle', msg: '' });
    const m = providersQ.data?.find((p) => p.id === id);
    setModel(m?.defaultModel ?? '');
  }

  const modelsMut = useMutation({
    mutationFn: () => api.llmModels(provider, apiKey || undefined),
    onSuccess: (d) => {
      setModels(d.models);
      setStatus({ kind: 'ok', msg: `${d.models.length} model bulundu.` });
      if (d.models.length && !d.models.includes(model)) setModel(d.models[0]);
    },
    onError: (e: Error) => setStatus({ kind: 'err', msg: e.message }),
  });

  const testMut = useMutation({
    mutationFn: () => api.llmTest(provider, apiKey || undefined, model || undefined),
    onSuccess: (d) =>
      setStatus({ kind: 'ok', msg: `Bağlantı tamam (${d.model}): "${d.sample}"` }),
    onError: (e: Error) => setStatus({ kind: 'err', msg: e.message }),
  });

  const saveMut = useMutation({
    mutationFn: () => api.llmSave(provider, apiKey, model || undefined),
    onSuccess: () => {
      setStatus({ kind: 'ok', msg: 'Kaydedildi ve doğrulandı.' });
      setApiKey('');
      qc.invalidateQueries({ queryKey: ['llm-saved'] });
    },
    onError: (e: Error) => setStatus({ kind: 'err', msg: e.message }),
  });

  const delMut = useMutation({
    mutationFn: (p: string) => api.llmDelete(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['llm-saved'] }),
  });

  if (!open) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <header className="panel-head">
          <div>
            <div className="panel-title">AI Sağlayıcı</div>
            <div className="panel-sub">BYOK · anahtarın şifreli saklanır, sunucuda kalır</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Kapat">
            ✕
          </button>
        </header>

        <div className="panel-body">
          {/* Kayıtlı sağlayıcılar */}
          <section className="block">
            <h3>Kayıtlı sağlayıcılar</h3>
            {savedQ.isLoading && <p className="muted small">Yükleniyor…</p>}
            {savedQ.data && savedQ.data.length === 0 && (
              <p className="muted small">Henüz anahtar eklenmedi.</p>
            )}
            {savedQ.data?.map((c) => (
              <div key={c.id} className="saved-row">
                <div>
                  <b>{c.provider}</b>{' '}
                  <span className="muted small">
                    {c.model ?? '—'} · {c.key_hint} · v{c.key_version}
                  </span>
                </div>
                <button
                  className="icon-btn"
                  onClick={() => delMut.mutate(c.provider)}
                  aria-label="Sil"
                >
                  🗑
                </button>
              </div>
            ))}
          </section>

          {/* Ekle / güncelle */}
          <section className="block">
            <h3>Ekle / güncelle</h3>

            <label className="field">
              <span>Sağlayıcı</span>
              <select
                value={provider}
                onChange={(e) => selectProvider(e.target.value)}
              >
                {providersQ.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>API anahtarı</span>
              <div className={`key-input${prefixOk ? '' : ' warn'}`}>
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  placeholder={
                    meta?.keyPrefixHint ? `${meta.keyPrefixHint}…` : '••••••••••••'
                  }
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                {apiKey && (
                  <button
                    type="button"
                    className="key-act"
                    title={showKey ? 'Gizle' : 'Göster'}
                    aria-label={showKey ? 'Anahtarı gizle' : 'Anahtarı göster'}
                    onClick={() => setShowKey((v) => !v)}
                  >
                    {showKey ? '🙈' : '👁'}
                  </button>
                )}
                <button
                  type="button"
                  className="key-act"
                  title="Panodan yapıştır"
                  aria-label="Panodan yapıştır"
                  onClick={pasteKey}
                >
                  📋
                </button>
                {apiKey && (
                  <button
                    type="button"
                    className="key-act"
                    title="Temizle"
                    aria-label="Anahtarı temizle"
                    onClick={() => setApiKey('')}
                  >
                    ✕
                  </button>
                )}
              </div>
              {meta?.keyPrefixHint &&
                (prefixOk ? (
                  <span className="key-hint muted">
                    Bu sağlayıcının anahtarı genelde <code>{meta.keyPrefixHint}</code>{' '}
                    ile başlar. Anahtar şifrelenir, sunucuda kalır.
                  </span>
                ) : (
                  <span className="key-hint warn">
                    ⚠ Anahtar genelde <code>{meta.keyPrefixHint}</code> ile başlar —
                    doğru sağlayıcıyı seçtiğinden emin ol.
                  </span>
                ))}
            </label>

            <div className="field-row">
              <label className="field grow">
                <span>Model</span>
                {models.length > 0 ? (
                  <select value={model} onChange={(e) => setModel(e.target.value)}>
                    {models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={model}
                    placeholder={meta?.defaultModel ?? 'model-id'}
                    onChange={(e) => setModel(e.target.value)}
                  />
                )}
              </label>
              <button
                className="btn ghost"
                onClick={() => modelsMut.mutate()}
                disabled={modelsMut.isPending}
              >
                {modelsMut.isPending ? '…' : 'Modelleri getir'}
              </button>
            </div>

            {models.length > 0 && (
              <p className="muted small">
                Canlı katalog ({models.length}). Özel ID için listeden seçip
                değiştirebilirsin.
              </p>
            )}

            <div className="btn-row">
              <button
                className="btn ghost"
                onClick={() => testMut.mutate()}
                disabled={testMut.isPending}
              >
                {testMut.isPending ? 'Test…' : 'Bağlantıyı test et'}
              </button>
              <button
                className="btn primary"
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || !apiKey}
              >
                {saveMut.isPending ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>

            {status.kind !== 'idle' && (
              <p className={status.kind === 'ok' ? 'status ok' : 'status err'}>
                {status.msg}
              </p>
            )}

            {meta?.docsUrl && (
              <p className="muted small">
                Anahtar:{' '}
                <a href={meta.docsUrl} target="_blank" rel="noreferrer">
                  {meta.docsUrl}
                </a>
              </p>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
