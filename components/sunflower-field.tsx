'use client';

import { useRef, useEffect } from 'react';

interface FlowerDef {
  x: number;
  y: number;
  size: number;
  depth: number;
  sway: number;
}

const FLOWERS: FlowerDef[] = [
  { x: 5,  y: 15, size: 140, depth: 0.06,  sway: 4.2 },
  { x: 18, y: 55, size: 105, depth: 0.04,  sway: 5.1 },
  { x: 2,  y: 72, size: 160, depth: 0.08,  sway: 3.8 },
  { x: 25, y: 82, size: 90,  depth: 0.035, sway: 6.2 },
  { x: 73, y: 10, size: 130, depth: 0.07,  sway: 4.5 },
  { x: 88, y: 40, size: 150, depth: 0.09,  sway: 3.5 },
  { x: 80, y: 75, size: 110, depth: 0.05,  sway: 5.4 },
  { x: 92, y: 80, size: 95,  depth: 0.04,  sway: 6.0 },
  { x: 45, y: 5,  size: 120, depth: 0.06,  sway: 4.8 },
  { x: 55, y: 88, size: 100, depth: 0.045, sway: 5.5 },
  { x: 38, y: 70, size: 85,  depth: 0.03,  sway: 7.0 },
  { x: 65, y: 60, size: 75,  depth: 0.025, sway: 7.5 },
];

function SunflowerSVG({ size }: { size: number }) {
  const outerPetals = Array.from({ length: 13 }, (_, i) => (
    <ellipse
      key={i}
      cx="0"
      cy={-(size * 0.36)}
      rx={size * 0.09}
      ry={size * 0.22}
      fill="oklch(72% 0.18 75)"
      transform={`rotate(${(i / 13) * 360})`}
      opacity="0.92"
    />
  ));

  const innerPetals = Array.from({ length: 8 }, (_, i) => (
    <ellipse
      key={i}
      cx="0"
      cy={-(size * 0.28)}
      rx={size * 0.07}
      ry={size * 0.15}
      fill="oklch(78% 0.16 68)"
      transform={`rotate(${(i / 8) * 360 + 13})`}
      opacity="0.7"
    />
  ));

  const outerSeeds = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const r = size * 0.09;
    return (
      <circle key={i} cx={Math.cos(a) * r} cy={Math.sin(a) * r}
        r={size * 0.018} fill="oklch(38% 0.07 50)" opacity="0.6" />
    );
  });

  const innerSeeds = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    const r = size * 0.05;
    return (
      <circle key={i} cx={Math.cos(a) * r} cy={Math.sin(a) * r}
        r={size * 0.016} fill="oklch(40% 0.07 52)" opacity="0.5" />
    );
  });

  return (
    <svg
      width={size}
      height={size * 1.8}
      viewBox={`${-size / 2} ${-size / 2} ${size} ${size * 1.8}`}
      style={{ overflow: 'visible' }}
    >
      <path
        d={`M0,${size * 0.18} C${-size * 0.04},${size * 0.4} ${size * 0.04},${size * 0.7} 0,${size}`}
        stroke="oklch(35% 0.08 140)"
        strokeWidth={size * 0.06}
        fill="none"
        strokeLinecap="round"
      />
      <ellipse
        cx={size * 0.12} cy={size * 0.52}
        rx={size * 0.14} ry={size * 0.07}
        fill="oklch(38% 0.1 138)"
        transform={`rotate(30, ${size * 0.12}, ${size * 0.52})`}
        opacity="0.9"
      />
      <g>{outerPetals}</g>
      <g>{innerPetals}</g>
      <circle cx="0" cy="0" r={size * 0.19} fill="oklch(28% 0.06 45)" />
      <circle cx="0" cy="0" r={size * 0.14} fill="oklch(22% 0.05 40)" />
      {outerSeeds}
      {innerSeeds}
    </svg>
  );
}

export function SunflowerField() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const targetRef = useRef({ x: 0.5, y: 0.5 });
  const frameRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const lastRef = useRef<number>(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      targetRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };
    window.addEventListener('mousemove', onMove);

    const tick = (now: number) => {
      const delta = lastRef.current ? (now - lastRef.current) * 0.001 : 0;
      lastRef.current = now;
      timeRef.current += delta;

      // Lerp mouse
      const m = mouseRef.current;
      const t = targetRef.current;
      m.x += (t.x - m.x) * 0.04;
      m.y += (t.y - m.y) * 0.04;

      if (containerRef.current) {
        const els = containerRef.current.querySelectorAll<HTMLDivElement>('[data-flower]');
        els.forEach((el, i) => {
          const f = FLOWERS[i];
          const dx = (m.x - 0.5) * f.depth * 300;
          const dy = (m.y - 0.5) * f.depth * 200;
          const sway = Math.sin(timeRef.current * 0.8 + i * 0.9) * f.sway;
          el.style.transform = `translate(${dx}px, ${dy}px) rotate(${sway}deg)`;
        });
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: '-80px',
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
    >
      {FLOWERS.map((f, i) => (
        <div
          key={i}
          data-flower
          style={{
            position: 'absolute',
            left: `${f.x}%`,
            top: `${f.y}%`,
            transformOrigin: 'bottom center',
            opacity: 0.55 + f.depth * 3,
            willChange: 'transform',
          }}
        >
          <SunflowerSVG size={f.size} />
        </div>
      ))}
    </div>
  );
}
