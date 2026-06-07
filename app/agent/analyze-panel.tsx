'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './agent.module.scss';
import { StudyCards, type CardData } from '@/components/study-cards';

const ACCEPTED = [
  'application/pdf', 'text/*', '.txt', '.md', '.html', '.rtf',
  'image/png', 'image/jpeg', 'image/webp',
].join(',');

interface PastAnalysis {
  id: number;
  title: string | null;
  source_ref: string | null;
  created_at: string;
  data: CardData;
}

export function AnalyzePanel({ pin }: { pin: string | null }) {
  const [file,    setFile]    = useState<File | null>(null);
  const [url,     setUrl]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [notLaw,  setNotLaw]  = useState(false);
  const [cards,   setCards]   = useState<CardData | null>(null);
  const [past,    setPast]    = useState<PastAnalysis[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load past analyses
  useEffect(() => {
    if (!pin) return;
    fetch(`/api/analyze?pin=${encodeURIComponent(pin)}`)
      .then(r => (r.ok ? r.json() : []))
      .then(data => setPast(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [pin]);

  function clearFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!pin || (!file && !url.trim())) return;
    setLoading(true);
    setError('');
    setNotLaw(false);
    setCards(null);

    const form = new FormData();
    form.append('pinCode', pin);
    if (file) form.append('file', file);
    else form.append('url', url.trim());

    try {
      const res  = await fetch('/api/analyze', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Analysis failed.'); return; }
      if (data.lawRelated === false) { setNotLaw(true); return; }
      setCards(data.data as CardData);
      // refresh past list
      if (pin) {
        fetch(`/api/analyze?pin=${encodeURIComponent(pin)}`)
          .then(r => (r.ok ? r.json() : []))
          .then(d => setPast(Array.isArray(d) ? d : []))
          .catch(() => {});
      }
      setFile(null); setUrl('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      setError('Network error — is the dev server running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.analyzePanel}>
      <div className={styles.analyzeIntro}>
        <h2 className={styles.analyzeTitle}>Study Cards</h2>
        <p className={styles.analyzeSub}>
          Upload a law paper or paste a link. I&apos;ll break it into study cards — law sources only.
        </p>
      </div>

      {past.length > 0 && (
        <div className={styles.analyzeChips}>
          {past.map(p => (
            <button
              key={p.id}
              type="button"
              className={styles.analyzeChip}
              onClick={() => { setCards(p.data); setNotLaw(false); setError(''); }}
              title={p.source_ref ?? undefined}
            >
              {p.title || p.source_ref || `Analysis #${p.id}`}
            </button>
          ))}
        </div>
      )}

      <form className={styles.analyzeForm} onSubmit={handleAnalyze}>
        <div className={styles.analyzeInputs}>
          <label className={styles.analyzeFileBtn} title="Upload a file">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED}
              onChange={e => { setFile(e.target.files?.[0] ?? null); setUrl(''); }}
              className={styles.hiddenInput}
            />
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <path d="M12 7.5l-5 5a3.5 3.5 0 01-4.95-4.95l5.5-5.5a2 2 0 012.83 2.83L4.88 10.37a.5.5 0 01-.7-.7L9.5 4.35" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Upload
          </label>

          <span className={styles.analyzeOr}>or</span>

          <input
            type="url"
            className={styles.analyzeUrl}
            placeholder="Paste a law article / case / PDF link…"
            value={url}
            onChange={e => { setUrl(e.target.value); if (e.target.value) clearFile(); }}
          />

          <button
            type="submit"
            className={styles.analyzeSubmit}
            disabled={loading || (!file && !url.trim())}
          >
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>

        {file && (
          <span className={styles.fileChip}>
            {file.name}
            <button type="button" className={styles.clearBtn} onClick={clearFile}>×</button>
          </span>
        )}
      </form>

      <div className={styles.analyzeResult}>
        {loading && (
          <div className={styles.loadingRow}>
            <div className={styles.agentAvatar} />
            <div className={styles.loadingDots}>
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </div>
          </div>
        )}

        {error && <div className={styles.errorBanner}><strong>Error:</strong> {error}</div>}

        {notLaw && (
          <div className={styles.analyzeNotice}>
            I can only analyze law-related papers, Miss Melissa Villagran.
          </div>
        )}

        {cards && !loading && <StudyCards data={cards} />}
      </div>
    </div>
  );
}
