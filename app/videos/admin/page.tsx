'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { SunflowerField } from '@/components/sunflower-field';
import { ThemeToggle } from '@/components/theme-toggle';
import { PinGate, PIN_KEY } from '@/components/pin-gate';
import styles from './admin.module.scss';

const MASTER = '8548';
const onlyMaster = async (pin: string) => pin === MASTER;

interface VideoSummary {
  id: number;
  title: string;
  thumbnail_url: string | null;
  duration: number | null;
  created_at: string;
}

interface VideoFull extends VideoSummary {
  description: string | null;
  url_360p: string | null;
  url_720p: string | null;
  url_1080p: string | null;
}

interface EditState {
  id: number;
  title: string;
  desc: string;
  thumbUrl: string;
  url360: string;
  url720: string;
  url1080: string;
  duration: string;
}

// ── Section wrapper ───────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

// ── 3-dot menu ────────────────────────────────────────────

function DotsMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  return (
    <div className={styles.rowActions} ref={ref}>
      <button className={styles.dotsBtn} onClick={() => setOpen(o => !o)}
        aria-label="Options">⋮</button>
      {open && (
        <div className={styles.dropdown}>
          <button className={styles.dropItem} onClick={() => { onEdit(); close(); }}>Edit</button>
          <button className={`${styles.dropItem} ${styles.danger}`}
            onClick={() => { onDelete(); close(); }}>Delete</button>
        </div>
      )}
    </div>
  );
}

// ── Admin page ────────────────────────────────────────────

export default function VideoAdminPage() {
  const [pin,         setPin]         = useState<string | null>(null);
  const [videos,      setVideos]      = useState<VideoSummary[]>([]);
  const [detailCache, setDetailCache] = useState<Map<number, VideoFull>>(new Map());
  const [msg,         setMsg]         = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Add form state
  const [title,    setTitle]    = useState('');
  const [desc,     setDesc]     = useState('');
  const [thumbUrl, setThumbUrl] = useState('');
  const [url360,   setUrl360]   = useState('');
  const [url720,   setUrl720]   = useState('');
  const [url1080,  setUrl1080]  = useState('');
  const [duration, setDuration] = useState('');
  const [subLang,  setSubLang]  = useState('');
  const [subLabel, setSubLabel] = useState('');
  const [subVtt,   setSubVtt]   = useState('');

  // Edit state
  const [editing, setEditing] = useState<EditState | null>(null);

  // ── Restore PIN from session ──────────────────────────────
  useEffect(() => {
    const saved = sessionStorage.getItem(PIN_KEY);
    if (saved === MASTER) setPin(saved);
  }, []);

  // ── Load videos + asynchronously fetch all details ────────
  useEffect(() => {
    if (!pin) return;

    fetch('/api/videos')
      .then(r => r.json())
      .then((list: VideoSummary[]) => {
        if (!Array.isArray(list)) return;
        setVideos(list);

        // Fetch all video details in parallel
        Promise.all(
          list.map(v =>
            fetch(`/api/videos/${v.id}`)
              .then(r => r.json())
              .then((full: VideoFull) => ({ id: v.id, full }))
              .catch(() => null)
          )
        ).then(results => {
          const map = new Map<number, VideoFull>();
          results.forEach(r => { if (r) map.set(r.id, r.full); });
          setDetailCache(map);
        });
      })
      .catch(() => {});
  }, [pin]);

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(''), 3500);
  }

  function resetAddForm() {
    setTitle(''); setDesc(''); setThumbUrl('');
    setUrl360(''); setUrl720(''); setUrl1080('');
    setDuration(''); setSubLang(''); setSubLabel(''); setSubVtt('');
  }

  // ── Add video ─────────────────────────────────────────────
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/videos', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        pin: MASTER, title,
        description  : desc     || undefined,
        thumbnail_url: thumbUrl || undefined,
        url_360p     : url360   || undefined,
        url_720p     : url720   || undefined,
        url_1080p    : url1080  || undefined,
        duration     : duration ? Math.round(parseFloat(duration) * 60) : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) { flash(data.error ?? 'Error adding video.'); return; }

    setVideos(prev => [data, ...prev]);

    // Cache the new video's full details
    const fullRes  = await fetch(`/api/videos/${data.id}`);
    const fullData = await fullRes.json();
    setDetailCache(prev => new Map(prev).set(data.id, fullData));

    if (subVtt.trim()) {
      const subRes = await fetch(`/api/videos/${data.id}/subtitles`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          pin: MASTER,
          language   : subLang  || 'en',
          label      : subLabel || 'Subtitle',
          vtt_content: subVtt,
        }),
      });
      const subData = await subRes.json();
      if (!subRes.ok) {
        flash('Video added but subtitle failed: ' + (subData.error ?? ''));
        resetAddForm(); setShowAddForm(false); return;
      }
    }

    resetAddForm();
    setShowAddForm(false);
    flash(subVtt.trim() ? 'Video and subtitle added.' : 'Video added.');
  }

  // ── Open edit (instant — data already cached) ─────────────
  function openEdit(v: VideoSummary) {
    const full = detailCache.get(v.id);
    setEditing({
      id      : v.id,
      title   : full?.title          ?? v.title,
      desc    : full?.description    ?? '',
      thumbUrl: full?.thumbnail_url  ?? v.thumbnail_url ?? '',
      url360  : full?.url_360p       ?? '',
      url720  : full?.url_720p       ?? '',
      url1080 : full?.url_1080p      ?? '',
      duration: (full?.duration ?? v.duration)
        ? String(+((full?.duration ?? v.duration)! / 60).toFixed(2))
        : '',
    });
  }

  // ── Save edit ─────────────────────────────────────────────
  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const res = await fetch(`/api/videos/${editing.id}`, {
      method : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        pin          : MASTER,
        title        : editing.title,
        description  : editing.desc     || undefined,
        thumbnail_url: editing.thumbUrl || undefined,
        url_360p     : editing.url360   || undefined,
        url_720p     : editing.url720   || undefined,
        url_1080p    : editing.url1080  || undefined,
        duration     : editing.duration
          ? Math.round(parseFloat(editing.duration) * 60)
          : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) { flash(data.error ?? 'Error updating video.'); return; }

    setVideos(prev => prev.map(v => v.id === data.id ? data : v));
    // Update cache
    setDetailCache(prev => {
      const next = new Map(prev);
      const existing = next.get(data.id);
      if (existing) next.set(data.id, { ...existing, ...data });
      return next;
    });
    setEditing(null);
    flash('Video updated.');
  }

  function setEditField(field: keyof EditState, value: string) {
    setEditing(prev => prev ? { ...prev, [field]: value } : null);
  }

  // ── Delete video ──────────────────────────────────────────
  async function deleteVideo(id: number) {
    if (!confirm('Delete this video and its subtitles?')) return;
    await fetch(`/api/videos/${id}?pin=${MASTER}`, { method: 'DELETE' });
    setVideos(prev => prev.filter(v => v.id !== id));
    setDetailCache(prev => { const next = new Map(prev); next.delete(id); return next; });
    if (editing?.id === id) setEditing(null);
    flash('Video deleted.');
  }

  if (!pin) return <PinGate title="Video Admin" subtitle="Enter master PIN to continue" onUnlock={setPin} validate={onlyMaster} />;

  return (
    <div className={styles.scene}>
      <SunflowerField />
      <ThemeToggle />

      <div className={styles.page}>
        <h1 className={styles.title}>Video Admin</h1>

        {msg && <p className={styles.toast}>{msg}</p>}

        {/* ── Add Video toggle ── */}
        {!showAddForm ? (
          <div className={styles.addToggleRow}>
            <button className={styles.addToggleBtn} onClick={() => setShowAddForm(true)}>
              + Add Video
            </button>
          </div>
        ) : (
          <div className={styles.formWrapper}>
            <Section title="Add Video">
              <form className={styles.form} onSubmit={handleAdd}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Title *</label>
                  <input className={styles.input} value={title}
                    onChange={e => setTitle(e.target.value)} required />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Description</label>
                  <textarea className={styles.textarea} value={desc}
                    onChange={e => setDesc(e.target.value)} />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Thumbnail URL</label>
                  <input className={styles.input} type="url" value={thumbUrl}
                    onChange={e => setThumbUrl(e.target.value)} />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>URL 360p</label>
                  <input className={styles.input} type="url" value={url360}
                    onChange={e => setUrl360(e.target.value)} />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>URL 720p</label>
                  <input className={styles.input} type="url" value={url720}
                    onChange={e => setUrl720(e.target.value)} />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>URL 1080p</label>
                  <input className={styles.input} type="url" value={url1080}
                    onChange={e => setUrl1080(e.target.value)} />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Duration (minutes)</label>
                  <input className={styles.input} type="number" min="0" step="0.1"
                    value={duration} onChange={e => setDuration(e.target.value)} />
                </div>

                <hr className={styles.divider} />
                <p className={styles.label} style={{ marginBottom: '-0.5rem' }}>Subtitle — optional</p>

                <div className={styles.twoCol}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Language code (e.g. en)</label>
                    <input className={styles.input} value={subLang}
                      onChange={e => setSubLang(e.target.value)} />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Label (e.g. English)</label>
                    <input className={styles.input} value={subLabel}
                      onChange={e => setSubLabel(e.target.value)} />
                  </div>
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>VTT Content</label>
                  <textarea className={`${styles.textarea} ${styles.vttArea}`}
                    value={subVtt} onChange={e => setSubVtt(e.target.value)}
                    placeholder={'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello world'} />
                </div>

                <div className={styles.editActions}>
                  <button type="submit" className={styles.submitBtn}>Add Video</button>
                  <button type="button" className={styles.cancelBtn}
                    onClick={() => { resetAddForm(); setShowAddForm(false); }}>
                    Cancel
                  </button>
                </div>
              </form>
            </Section>
          </div>
        )}

        {/* ── Existing Videos ── */}
        <Section title="Existing Videos">
          {videos.length === 0 ? (
            <p className={styles.emptyNote}>No videos yet.</p>
          ) : (
            <ul className={styles.videoList}>
              {videos.map(v => (
                <li key={v.id}>
                  <div className={styles.videoRow}>
                    <span>
                      <span className={styles.videoRowTitle}>{v.title}</span>
                      <span className={styles.videoRowId}>#{v.id}</span>
                    </span>
                    <DotsMenu
                      onEdit={() => openEdit(v)}
                      onDelete={() => deleteVideo(v.id)}
                    />
                  </div>

                  {editing?.id === v.id && (
                    <form className={styles.editSection} onSubmit={handleEdit}>
                      <p className={styles.editTitle}>Editing — {v.title}</p>

                      <div className={styles.fieldGroup}>
                        <label className={styles.label}>Title *</label>
                        <input className={styles.input} value={editing.title}
                          onChange={e => setEditField('title', e.target.value)} required />
                      </div>
                      <div className={styles.fieldGroup}>
                        <label className={styles.label}>Description</label>
                        <textarea className={styles.textarea} value={editing.desc}
                          onChange={e => setEditField('desc', e.target.value)} />
                      </div>
                      <div className={styles.fieldGroup}>
                        <label className={styles.label}>Thumbnail URL</label>
                        <input className={styles.input} type="url" value={editing.thumbUrl}
                          onChange={e => setEditField('thumbUrl', e.target.value)} />
                      </div>
                      <div className={styles.fieldGroup}>
                        <label className={styles.label}>URL 360p</label>
                        <input className={styles.input} type="url" value={editing.url360}
                          onChange={e => setEditField('url360', e.target.value)} />
                      </div>
                      <div className={styles.fieldGroup}>
                        <label className={styles.label}>URL 720p</label>
                        <input className={styles.input} type="url" value={editing.url720}
                          onChange={e => setEditField('url720', e.target.value)} />
                      </div>
                      <div className={styles.fieldGroup}>
                        <label className={styles.label}>URL 1080p</label>
                        <input className={styles.input} type="url" value={editing.url1080}
                          onChange={e => setEditField('url1080', e.target.value)} />
                      </div>
                      <div className={styles.fieldGroup}>
                        <label className={styles.label}>Duration (minutes)</label>
                        <input className={styles.input} type="number" min="0" step="0.1"
                          value={editing.duration}
                          onChange={e => setEditField('duration', e.target.value)} />
                      </div>

                      <div className={styles.editActions}>
                        <button type="submit" className={styles.submitBtn}>Save</button>
                        <button type="button" className={styles.cancelBtn}
                          onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Link href="/videos" className={styles.back}>← Videos</Link>
      </div>
    </div>
  );
}
