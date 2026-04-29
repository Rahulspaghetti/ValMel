# ValMel — Maroon/Gold Redesign Spec

**Date:** 2026-04-29
**Approach:** Full port from `design.html`

---

## Overview

Replace the existing pink/rose soft theme with a deep maroon + gold aesthetic sourced from `design.html`. The site retains all current functionality (Bible card, weather card, message card, intro overlay, Spotify widget, agent link, theme toggle) while adopting a new visual identity: dark maroon background, frosted glass cards, gold accents, animated SVG sunflower field with mouse parallax, and a custom gold cursor.

Light mode becomes a cream/warm-gold inversion of the same design language — not a return to the old pink palette.

---

## Files Changed

| File | Type | Change |
|---|---|---|
| `app/layout.tsx` | Edit | Swap fonts: Cormorant Garamond + DM Sans |
| `app/globals.scss` | Edit | New CSS variables (dark + light themes) |
| `app/page.module.scss` | Edit | Full restyle: cards, header, weather, intro overlay |
| `app/page.tsx` | Edit | Wire new components; update weather card markup |
| `components/sunflower-field.tsx` | New | SVG sunflowers with mouse parallax |
| `components/custom-cursor.tsx` | New | Gold cursor dot + ring |

---

## Theme — CSS Variables

### Dark mode (`:root` or `.dark`)

```css
--bg-start:      #1a0508;
--bg-end:        #3b0a14;
--card-bg:       oklch(12% 0.06 15 / 0.75);
--card-border:   oklch(72% 0.14 75 / 0.18);
--gold:          oklch(72% 0.14 75);
--gold-pale:     oklch(85% 0.09 75);
--cream:         oklch(96% 0.015 75);
--text-dim:      oklch(80% 0.04 60);
```

### Light mode (`.light` or no `.dark` class)

```css
--bg-start:      #fdf6ee;
--bg-end:        #f5ede0;
--card-bg:       rgba(255, 248, 238, 0.78);
--card-border:   oklch(58% 0.14 75 / 0.25);
--gold:          oklch(58% 0.14 75);
--gold-pale:     oklch(45% 0.12 75);
--cream:         #1a0508;
--text-dim:      oklch(40% 0.06 60);
```

---

## Typography

| Role | Font | Weight | Style |
|---|---|---|---|
| Title, verse, message, weather temp | Cormorant Garamond | 300 | italic where appropriate |
| Labels, refs, UI text, weather rows | DM Sans | 300 / 400 / 500 | normal |

Loaded via `next/font/google` in `layout.tsx`. CSS variables: `--font-cormorant`, `--font-dm-sans`.

---

## New Components

### `components/sunflower-field.tsx`

- 12 sunflowers placed at fixed percentage positions across the viewport
- Each has `size`, `depth`, and `sway` parameters
- SVG per flower: 13 outer petals, 8 inner petals, stem, leaf, seed dots — matching `design.html` exactly
- `requestAnimationFrame` loop drives continuous sway angle (`Math.sin(time + offset) * sway`)
- Mouse position (0–1 normalized) shifts each flower by `(mouse - 0.5) * depth * 300px`
- Wrapped in `position: fixed; inset: -80px; pointer-events: none; z-index: 0`
- Accepts `mouse: { x: number; y: number }` prop from parent

### `components/custom-cursor.tsx`

- Hides system cursor via `cursor: none` injected on mount
- Gold dot: 10px circle, `mix-blend-mode: screen`, follows exact mouse position
- Gold ring: 32px, 1px border, follows with 80ms `setTimeout` delay
- Both use `position: fixed`, `pointer-events: none`, `z-index: 9998/9999`
- On `@media (hover: none)`: component renders nothing, system cursor restored

---

## Updated Components

### `app/page.tsx`

- Import and render `<SunflowerField mouse={mouse} />` (mouse state tracked via `mousemove`)
- Import and render `<CustomCursor />`
- Weather card markup updated to new layout (see below)
- Intro overlay markup unchanged; styling handled in `page.module.scss`
- `requestAnimationFrame` mouse smoothing loop (lerp 0.04) same pattern as `design.html`

### Weather card layout

Old: icon (110px img) → temp → city → description → feels-like

New:
```
[weather emoji icon, 38px]
[64px temp number in Cormorant, °C superscript]
[weather description, 13px DM Sans]
[rows: Humidity | value, Wind | value, Location | value]
```

**Weather lib change required:** `lib/weather.ts` extended to add `humidity: number` (from `data.main.humidity`) and `windspeed: number` (from `Math.round(data.wind.speed * 3.6)` km/h). Both fields already present in OpenWeatherMap response.

Icon display: OWM icon URL replaced with emoji via a small OWM-code → emoji map in the card component (e.g. `"01d"→"☀️"`, `"10d"→"🌧"`, `"11d"→"⛈"`). Keeps display layer self-contained without changing the lib interface beyond the two new fields.

---

## Card Styles

```
background:      var(--card-bg)
backdrop-filter: blur(20px) saturate(1.4)
border:          1px solid var(--card-border)
border-radius:   20px
padding:         32px 28px
min-height:      320px
box-shadow:      0 8px 40px oklch(5% 0.04 10 / 0.5), inset 0 1px 0 gold/12%
```

Top-edge shimmer: `::before` pseudo with linear-gradient gold line, opacity 0.4.

Hover: `translateY(-6px) scale(1.02)`, enhanced shadow + glow.

---

## Animations

| Name | Target | Detail |
|---|---|---|
| `fadeUp` | Cards, header | `opacity 0→1, translateY 24px→0`, 0.7s ease |
| Card stagger | Each card | delays: 0.1s / 0.25s / 0.4s |
| Sunflower sway | SVG flowers | `rAF` loop, `Math.sin` oscillation |
| Mouse parallax | SVG flowers | Per-flower depth factor, 0.6s cubic-bezier transition |
| Loading dots | Skeleton | `pulse` keyframe, opacity + scale |

---

## Intro Overlay

Restyled to match new theme:
- Background: `linear-gradient(135deg, var(--bg-start), var(--bg-end))`
- Greeting text: DM Sans, `--text-dim`
- Title "MeliBoo": Cormorant Garamond italic, `--gold-pale`
- Hint: DM Sans, `--text-dim`, pulse animation
- Behavior unchanged (localStorage key, tap to dismiss)

---

## Cursor Behaviour

- `cursor: none` on `body` (injected by `CustomCursor` on mount, cleaned on unmount)
- Touch devices: component returns `null`, no style injection
- Works in both light and dark mode (gold + `mix-blend-mode: screen` reads fine on cream too)

---

## Out of Scope

- Spotify widget: no style changes
- Agent page (`/agent`): no changes
- API routes: no changes
- `ThemeToggle` component: no changes (only CSS variables update around it)
