'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './pin-gate.module.scss';

export const PIN_KEY = 'meli_pin';

export type PinValidator = (pin: string) => Promise<boolean>;

const apiValidator: PinValidator = async (pin: string) => {
  try {
    const res = await fetch(`/api/auth/pin?pin=${encodeURIComponent(pin)}`);
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.valid);
  } catch {
    return false;
  }
};

interface PinGateProps {
  onUnlock: (pin: string) => void;
  title?: string;
  subtitle?: string;
  /** Optional async validator. Default: hits /api/auth/pin. Return false for invalid. */
  validate?: PinValidator;
}

export function PinGate({
  onUnlock,
  title = 'MeliBoo',
  subtitle = 'Enter your 4-digit PIN to continue',
  validate = apiValidator,
}: PinGateProps) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error,  setError]  = useState('');
  const [busy,   setBusy]   = useState(false);
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => { refs[0].current?.focus(); }, []);

  function handleDigit(idx: number, val: string) {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[idx] = val.slice(-1);
    setDigits(next);
    setError('');
    if (val && idx < 3) refs[idx + 1].current?.focus();
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) refs[idx - 1].current?.focus();
    if (e.key === 'Enter') submit(digits);
  }

  async function submit(d = digits) {
    const pin = d.join('');
    if (pin.length < 4) { setError('Enter all 4 digits'); return; }
    setBusy(true);
    const ok = await validate(pin);
    setBusy(false);
    if (!ok) { setError('Incorrect PIN'); return; }
    sessionStorage.setItem(PIN_KEY, pin);
    onUnlock(pin);
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.box}>
        <p className={styles.title}>{title}</p>
        <p className={styles.subtitle}>{subtitle}</p>
        <div className={styles.inputs}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={refs[i]}
              className={styles.digit}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
            />
          ))}
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <button
          className={styles.submit}
          onClick={() => submit()}
          disabled={digits.join('').length < 4 || busy}
        >
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </div>
    </div>
  );
}
