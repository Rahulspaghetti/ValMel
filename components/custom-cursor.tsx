'use client';

import { useState, useEffect } from 'react';

export function CustomCursor() {
  const [dot, setDot] = useState({ x: -100, y: -100 });
  const [ring, setRing] = useState({ x: -100, y: -100 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't activate on touch-only devices
    if (window.matchMedia('(hover: none)').matches) return;

    const onMove = (e: MouseEvent) => {
      setDot({ x: e.clientX, y: e.clientY });
      setTimeout(() => setRing({ x: e.clientX, y: e.clientY }), 80);
      if (!visible) setVisible(true);
    };

    document.body.style.cursor = 'none';
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      document.body.style.cursor = '';
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          width: 10,
          height: 10,
          background: 'var(--cursor-color, oklch(72% 0.14 75))',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 9999,
          left: dot.x,
          top: dot.y,
          transform: 'translate(-50%, -50%)',
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'fixed',
          width: 32,
          height: 32,
          border: '1px solid oklch(72% 0.14 75 / 0.5)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 9998,
          left: ring.x,
          top: ring.y,
          transform: 'translate(-50%, -50%)',
          transition: 'left 0.12s ease, top 0.12s ease',
        }}
      />
    </>
  );
}
