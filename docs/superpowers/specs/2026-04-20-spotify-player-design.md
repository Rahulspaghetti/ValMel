# Spotify Player — Design Spec
Date: 2026-04-20

## Goal
Persistent Spotify login (no repeated auth prompts) + a playlist-picker modal that shuffles and plays a chosen playlist on the in-page Spotify Web Playback SDK device.

---

## Token Persistence Fix

**Problem:** After the OAuth callback redirects to `/?spotify=connected`, the widget is still mounted in "checking" state and never transitions to "connected" because it doesn't react to the URL param.

**Fix:** In `SpotifyWidget`, on mount:
1. Check `window.location.search` for `?spotify=connected`.
2. If present, strip the param from the URL (via `history.replaceState`) and call `fetchToken()` immediately to set status to `connected`.
3. Existing cookie logic handles all future visits — refresh token lives for 1 year, access token auto-refreshes. No DB changes needed.

---

## New API Routes

### `GET /api/spotify/playlists`
- Reads `sp_access` cookie (or refreshes via `sp_refresh`).
- Calls Spotify `GET /me/playlists?limit=50`.
- Returns `{ playlists: Array<{ id, uri, name, imageUrl, trackCount }> }`.
- Returns 401 if not connected.

### `POST /api/spotify/play`
- Body: `{ playlistUri: string, deviceId: string }`.
- Reads/refreshes access token from cookie.
- Calls `PUT https://api.spotify.com/v1/me/player/shuffle?state=true&device_id={deviceId}`.
- Calls `PUT https://api.spotify.com/v1/me/player/play?device_id={deviceId}` with body `{ context_uri: playlistUri }`.
- Returns 204 on success, 401/500 on error.

---

## Widget Changes

### State additions
- `deviceId: string | null` — captured from SDK `ready` event, stored in state (already goes to `ready` handler; needs to be lifted into component state).
- `modalOpen: boolean` — controls playlist picker visibility.

### Behaviour on mount
- If `?spotify=connected` in URL → strip param, fetch token, set status `connected`.

### New UI: playlist button
- When `status === 'connected' && ready`: show a small playlist/music icon button in the widget controls row.
- Clicking it opens the modal.

### Controls row unchanged
- Prev / Play-Pause / Next / Collapse remain as-is.

---

## Playlist Picker Modal

**Trigger:** playlist button in widget.

**Appearance:** frosted-glass panel, slides up from bottom-right over the widget. Styled to match existing card/glass aesthetic (`var(--card-bg-glass)`, `var(--border)`).

**Content:**
- Header: "Your Playlists" + close button.
- List of playlists: cover art thumbnail (40×40) + name + track count.
- Loading skeleton while fetch is in flight.
- Error state if fetch fails (retry button).

**Interaction:**
- Tap a playlist → call `POST /api/spotify/play` with `{ playlistUri, deviceId }` → close modal → widget shows now-playing track within a few seconds.
- Only one playlist can be active at a time; no multi-select.

**Caching:** playlists fetched once per widget mount, cached in component state. No server-side cache needed.

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `app/api/spotify/playlists/route.ts` | New — proxy Spotify playlists endpoint |
| `app/api/spotify/play/route.ts` | New — enable shuffle + start playback |
| `components/spotify-widget.tsx` | Add deviceId state, URL param fix, modal open/close, playlist button |
| `components/spotify-widget.module.scss` | Add modal, playlist list, thumbnail styles |

No DB changes. No new dependencies.

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Not logged in | Widget shows "Connect Spotify" button (unchanged) |
| Token expired | `/api/spotify/playlists` and `/api/spotify/play` refresh via `sp_refresh` cookie automatically |
| Spotify Premium not active | SDK fires `account_error` → widget sets status `disconnected` (existing behaviour) |
| Device not ready | Playlist button disabled until `ready === true` |
| Play API fails | Modal stays open, show inline error message |

---

## Out of Scope
- Search for individual tracks
- Queue management
- Volume control
- Lyrics display
