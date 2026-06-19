'use client';

import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { ChatAnswer } from '@/lib/types';

function isoToFlag(iso: string): string {
  const cc = (iso || '').toUpperCase();
  if (cc.length !== 2 || cc === 'NC') return '🏳️';
  const base = 0x1f1e6;
  return String.fromCodePoint(
    base + cc.charCodeAt(0) - 65,
    base + cc.charCodeAt(1) - 65,
  );
}

const EXAMPLES = [
  'Kılıçdaroğlu partiden gider mi?',
  'Faiz yıl sonuna kadar düşer mi?',
  '2028 seçimini kim kazanır?',
];

function errAnswer(e: unknown): ChatAnswer {
  return {
    answer: `Cevap üretilemedi: ${(e as Error).message}`,
    probability: null,
    reasoning: '',
    watch: [],
    sources: [],
    model: '',
  };
}

export default function ChatPanel({
  iso2,
  onClose,
}: {
  iso2: string;
  onClose?: () => void;
}) {
  const [q, setQ] = useState('');
  const [thread, setThread] = useState<Array<{ q: string; a: ChatAnswer | null }>>(
    [],
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  const askMut = useMutation({
    mutationFn: (question: string) => {
      const history = thread
        .filter((m) => m.a && m.a.answer)
        .slice(-6)
        .map((m) => ({ q: m.q, a: m.a!.answer }));
      return api.ask(iso2, question, history);
    },
  });

  // Ülke değişince sohbeti sıfırla (bağlam karışmasın).
  useEffect(() => setThread([]), [iso2]);

  // Yeni mesaj/cevap gelince en alta kaydır.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread]);

  const submit = () => {
    const question = q.trim();
    if (question.length < 3 || askMut.isPending) return;
    setQ('');
    setThread((t) => [...t, { q: question, a: null }]);
    askMut.mutate(question, {
      onSuccess: (a) =>
        setThread((t) =>
          t.map((m, i) => (i === t.length - 1 ? { ...m, a } : m)),
        ),
      onError: (e) =>
        setThread((t) =>
          t.map((m, i) =>
            i === t.length - 1 ? { ...m, a: errAnswer(e) } : m,
          ),
        ),
    });
  };

  return (
    <aside className="chatpanel">
      <header className="chat-head">
        <span className="chat-head-ico">💬</span>
        <div className="chat-head-id">
          <div className="chat-head-title">Sor</div>
          <div className="chat-head-sub">
            {isoToFlag(iso2)} {iso2} · hafızalı · canlı veri
          </div>
        </div>
        {thread.length > 0 && (
          <button className="chat-clear" onClick={() => setThread([])}>
            temizle
          </button>
        )}
        {onClose && (
          <button className="panel-collapse" onClick={onClose} title="Paneli kapat">
            ‹
          </button>
        )}
      </header>

      <div className="chat-scroll" ref={scrollRef}>
        {thread.length === 0 && (
          <div className="chat-empty">
            <p>
              Seçili ülke bağlamında bir soru sor — sistem güncel
              haber/olay/makro/piyasa + canlı web verisiyle kalibre, atıflı yanıt
              verir. Takip soruları hatırlanır.
            </p>
            <div className="chat-examples">
              {EXAMPLES.map((ex) => (
                <button key={ex} className="chat-ex" onClick={() => setQ(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
        {thread.map((m, i) => (
          <div key={i} className="chat-qa">
            <div className="chat-q">{m.q}</div>
            {m.a ? (
              <ChatAnswerView a={m.a} />
            ) : (
              <div className="chat-thinking">Düşünüyor… web taranıyor, sentezleniyor</div>
            )}
          </div>
        ))}
      </div>

      <div className="chat-input-row">
        <textarea
          className="chat-input"
          placeholder="Bir soru sor…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
        />
        <button
          className="chat-send"
          onClick={submit}
          disabled={askMut.isPending || q.trim().length < 3}
        >
          {askMut.isPending ? '…' : '↑'}
        </button>
      </div>
    </aside>
  );
}

function ChatAnswerView({ a }: { a: ChatAnswer }) {
  return (
    <div className="chat-a">
      <div className="chat-a-main">
        {a.probability != null && (
          <span className="chat-a-prob">{Math.round(a.probability * 100)}%</span>
        )}
        <span>{a.answer}</span>
      </div>
      {a.reasoning && <p className="chat-a-reason">{a.reasoning}</p>}
      {a.watch?.length > 0 && (
        <div className="chat-a-watch">
          <span className="chat-a-tag">👁 İzlenecekler</span>
          <ul>
            {a.watch.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {a.sources?.length > 0 && (
        <div className="chat-a-src">
          {a.sources.slice(0, 6).map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noreferrer">
              {s.title}
            </a>
          ))}
        </div>
      )}
      {a.model && <span className="chat-a-model">{a.model}</span>}
    </div>
  );
}
