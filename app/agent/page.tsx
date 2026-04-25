'use client';

import { useState, useRef, ChangeEvent, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './agent.module.scss';
import { ThemeToggle } from '@/components/theme-toggle';

// ------------------------------------------------------------------ types

interface ApiSuccess { response: string; sessionId: string; }
interface ApiError   { error: string; }
type ApiResult = ApiSuccess | ApiError;

interface PastSession {
  session_id : string;
  created_at : string;
  preview    : string | null;
}

interface HistoryItem {
  intent   : string;
  response : string;
  filename : string | null;
}

// ------------------------------------------------------------------ helpers

function generateSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function relativeDate(iso: string): string {
  const d    = new Date(iso);
  const now  = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const ACCEPTED_TYPES = [
  'text/*', 'application/pdf', 'application/json',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.c', '.cpp',
  '.cs', '.rb', '.php', '.swift', '.kt', '.md', '.yaml', '.yml', '.toml',
  '.csv', '.xml', '.html', '.css', '.scss',
].join(',');

const PIN_KEY = 'meli_pin';

// ------------------------------------------------------------------ PinGate

function PinGate({ onUnlock }: { onUnlock: (pin: string) => void }) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error,  setError]  = useState('');
  const ref0 = useRef<HTMLInputElement>(null);
  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);
  const ref3 = useRef<HTMLInputElement>(null);
  const refs = [ref0, ref1, ref2, ref3];

  useEffect(() => { ref0.current?.focus(); }, []);

  function handleDigit(idx: number, val: string) {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[idx] = val.slice(-1);
    setDigits(next);
    setError('');
    if (val && idx < 3) refs[idx + 1].current?.focus();
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      refs[idx - 1].current?.focus();
    }
    if (e.key === 'Enter') submit(digits);
  }

  function submit(d = digits) {
    const pin = d.join('');
    if (pin.length < 4) { setError('Enter all 4 digits'); return; }
    sessionStorage.setItem(PIN_KEY, pin);
    onUnlock(pin);
  }

  return (
    <div className={styles.pinOverlay}>
      <div className={styles.pinBox}>
        <p className={styles.pinTitle}>MeliBoo Law</p>
        <p className={styles.pinSubtitle}>Enter your 4-digit PIN to continue</p>
        <div className={styles.pinInputs}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={refs[i]}
              className={styles.pinDigit}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
            />
          ))}
        </div>
        {error && <p className={styles.pinError}>{error}</p>}
        <button
          className={styles.pinSubmit}
          onClick={() => submit()}
          disabled={digits.join('').length < 4}
        >
          Unlock
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ component

export default function AgentPage() {
  const [pin,       setPin]       = useState<string | null>(null);
  const [sessionId, setSessionId] = useState(generateSessionId);
  const [history,   setHistory]   = useState<HistoryItem[]>([]);
  const [intent,    setIntent]    = useState('');
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState<ApiResult | null>(null);
  const [file,      setFile]      = useState<File | null>(null);
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
  const [sidebarOpen,       setSidebarOpen]       = useState(false);
  const [sidebarCollapsed,  setSidebarCollapsed]  = useState(false);

  const fileInputRef   = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(PIN_KEY);
    if (stored) setPin(stored);
  }, []);

  const loadSessions = useCallback(async (p: string) => {
    try {
      const res = await fetch(`/api/sessions?pin=${p}`);
      if (res.ok) setPastSessions(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (pin) loadSessions(pin);
  }, [pin, loadSessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading]);

  function handleTextareaInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
  }

  function clearFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function startNewSession() {
    setSessionId(generateSessionId());
    setHistory([]);
    setResult(null);
    setIntent('');
    clearFile();
    setSidebarOpen(false);
  }

  async function loadPastSession(id: string) {
    if (!pin) return;
    setSidebarOpen(false);
    try {
      const res = await fetch(`/api/sessions/${id}?pin=${pin}`);
      if (!res.ok) return;
      const msgs: Array<{ intent: string; response: string; filename: string | null }> = await res.json();
      setSessionId(id);
      setHistory(msgs.map(m => ({ intent: m.intent, response: m.response, filename: m.filename })));
      setResult(null);
    } catch { /* silent */ }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!intent.trim() || !pin) return;
    setLoading(true);
    setResult(null);

    const form = new FormData();
    form.append('intent', intent.trim());
    form.append('sessionId', sessionId);
    form.append('pinCode', pin);
    if (file) form.append('file', file);

    try {
      const res  = await fetch('/api/agent', { method: 'POST', body: form });
      const data = (await res.json()) as ApiResult;
      setResult(data);
      if (!('error' in data)) {
        setHistory(prev => [...prev, { intent: intent.trim(), response: data.response, filename: file?.name ?? null }]);
        setIntent('');
        clearFile();
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        await loadSessions(pin);
      }
    } catch {
      setResult({ error: 'Network error — is the dev server running?' });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  const hasError = result && 'error' in result;

  return (
    <div className={styles.shell}>

      {!pin && <PinGate onUnlock={setPin} />}

      {/* ── Flowers ── */}
      <div className={styles.flowers} aria-hidden="true">
        {[1,2,3,4,5,6].map(i => (
          <span key={i} className={`${styles.flower} ${styles[`f${i}`]}`}
            style={{ backgroundImage: `url('/assets/sunflower.png')` }} />
        ))}
      </div>

      {/* ── Sidebar backdrop (mobile) ── */}
      {sidebarOpen && (
        <div className={styles.sidebarBackdrop} onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''} ${sidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
        <div className={styles.sidebarTop}>
          <div className={styles.brandRow}>
            <div className={styles.brandDot} />
            <span className={styles.brandName}>MeliBoo Law</span>
            <button
              className={styles.collapseBtn}
              type="button"
              onClick={() => setSidebarCollapsed(c => !c)}
              title="Collapse sidebar"
            >‹</button>
          </div>
          <button className={styles.newChatBtn} type="button" onClick={startNewSession}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            New session
          </button>
        </div>

        <div className={styles.sidebarSection}>
          <div className={styles.sidebarLabel}>Sessions</div>
          {pastSessions.length === 0 && (
            <p className={styles.docEmpty}>No past sessions</p>
          )}
          {pastSessions.map(s => (
            <div
              key={s.session_id}
              className={`${styles.historyItem} ${s.session_id === sessionId ? styles.historyItemActive : ''}`}
              onClick={() => loadPastSession(s.session_id)}
            >
              <span className={styles.historyItemTitle}>
                {s.preview ? (s.preview.length > 38 ? s.preview.slice(0, 38) + '…' : s.preview) : 'Empty session'}
              </span>
              <span className={styles.historyItemMeta}>{relativeDate(s.created_at)}</span>
            </div>
          ))}
        </div>

        <div className={styles.sidebarFoot}>
          <div className={styles.sessionPill}>
            <p className={styles.sessionLabel}>PIN ····</p>
            <code className={styles.sessionCode}>{sessionId}</code>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className={styles.main}>

        <div className={styles.topbar}>
          <button
            className={styles.menuBtn}
            type="button"
            onClick={() => setSidebarOpen(o => !o)}
            title="Menu"
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <path d="M1 3h12M1 7h12M1 11h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
          {sidebarCollapsed && (
            <button
              className={styles.iconBtn}
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              title="Expand sidebar"
            >›</button>
          )}
          <span className={styles.topbarTitle}>
            {history.length > 0
              ? (history[0].intent.length > 42
                  ? history[0].intent.slice(0, 42) + '…'
                  : history[0].intent)
              : 'Madame MeliBoo'}
          </span>
          <div className={styles.topbarActions}>
            <button className={styles.iconBtn} type="button" title="Session info">
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M7 6.5v4M7 4.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
            <ThemeToggle className={styles.themeToggle} />
          </div>
        </div>

        <div className={styles.messages}>
          {history.length === 0 && !loading && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon} />
              <p className={styles.emptyTitle}>Ask a law question</p>
              <p className={styles.emptySubtitle}>Sessions are saved automatically.</p>
            </div>
          )}

          {history.map((item, idx) => (
            <div key={idx} className={styles.turn}>
              {idx > 0 && <div className={styles.turnDivider} />}
              <div className={styles.humanRow}>
                <div className={styles.humanBubble}>
                  {item.filename && (
                    <div className={styles.fileBadge}>
                      <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
                        <path d="M2 1h4l2 2v6H2V1z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
                      </svg>
                      {item.filename}
                    </div>
                  )}
                  {item.intent}
                </div>
              </div>
              <div className={styles.agentRow}>
                <div className={styles.agentAvatar} />
                <div className={styles.agentBubble}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {item.response}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}

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

          {hasError && (
            <div className={styles.errorBanner}>
              <strong>Error:</strong> {(result as ApiError).error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form className={styles.inputBar} onSubmit={handleSubmit}>
          <div className={styles.inputWrap}>
            <div className={styles.inputTop}>
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                placeholder="Ask me a law question, Miss Melissa Villagrand… (Shift+Enter for newline)"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                onInput={handleTextareaInput}
                onKeyDown={handleKeyDown}
                rows={1}
                required
              />
              <button className={styles.sendBtn} type="submit" disabled={loading || !intent.trim()}>
                {loading ? '…' : (
                  <>
                    Send
                    <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                      <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </>
                )}
              </button>
            </div>

            <div className={styles.inputBottom}>
              <label className={styles.attachBtn} title="Attach file">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  onChange={handleFileChange}
                  className={styles.hiddenInput}
                />
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                  <path d="M12 7.5l-5 5a3.5 3.5 0 01-4.95-4.95l5.5-5.5a2 2 0 012.83 2.83L4.88 10.37a.5.5 0 01-.7-.7L9.5 4.35" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              </label>
              {file && (
                <span className={styles.fileChip}>
                  {file.name}
                  <button type="button" className={styles.clearBtn} onClick={clearFile}>×</button>
                </span>
              )}
              <span className={styles.inputHint}>Enter to send</span>
            </div>
          </div>
        </form>

      </main>
    </div>
  );
}
