# SeniorNett TODO

For every change consider the `design-guide.md` before implementing a todo.

## Wave 2 — High Delight, Manageable Scope

- [ ] **Lotti live** — wire the existing Lotti assistant to a real LLM API (OpenAI / local Ollama). Keep mock as fallback. System prompt: patient, warm, Swiss German assistant.
- [ ] **Grokipedia for real** — replace the stub with curated explainers for common questions (news terms, health terms, government forms, scams, travel words).
- [ ] **Nachbarn for real** — turn the social stub into a private family/caregiver timeline with photos, short updates, and clear read/unread state.
- [ ] **Ferien polish** — persist trips, allow caregiver-prepared suggestions, and make the travel flow resumable without losing progress.
- [ ] **Music player** — curated playlist per user (stored in DB), large play/pause/next, volume. Stream from server or local files. No library browser for now.
- [ ] **Games: Memory** — classic card-flip memory game, large cards, 8–12 pairs, slow animations, win screen. Single most-requested cognitive game for this age group.
- [ ] **Kreuzworträtsel** — load a static German crossword (JSON format), touch-friendly grid, hint button, solution check. One new puzzle per week. No generator yet.
- [ ] **Contacts** — flat list of family contacts (name, photo, phone number). One tap → launch native dialler or Signal. Read from DB per user. No in-app calling.
- [ ] **Connection status widget** — top bar shows WireGuard connected / WiFi strength / offline. No settings, just visible state. Calm icons, no jargon.
- [ ] **Push notifications (caregiver → user)** — caregiver sends a short message ("Ich komme um 15 Uhr") which pops up on user's screen. Simple server-sent event or polling. No bidirectional chat yet.

---

## Wave 3 — Rounding Out

- [ ] **Photos** — grid of user photos from server-side folder, fullscreen tap, slideshow. Upload by caregiver. No editing.
- [ ] **Video calls** — simple WebRTC or FaceTime/Signal deep-link. Large accept/reject buttons, auto-answer option. Needs caregiver-managed contact list first.
- [ ] **Password manager** — encrypted per-user vault in DB (`pgcrypto`), master PIN entry on tablet, show/copy credentials. No browser autofill. Large UI.
- [ ] **Games: Jass / Sudoku** — add after Memory is validated with users.
- [ ] **Media: Video / TV** — curated YouTube playlist or IPTV stream. Fullscreen, large controls, no recommendations/autoplay rabbit hole.
- [ ] **Device sync status** — simple screen: what's on device, what's in cloud, last sync time. Read-only for user, actionable for caregiver.
- [ ] **Roaming / network settings** — display-only panel: WiFi name, signal, Bluetooth on/off, airplane mode toggle. Uses browser APIs where available; native bridge if in kiosk WebView.
- [ ] **Marketplace (Marktplatz)** — curated local listings from verified neighbours. Browse only for MLP, post later. Needs moderation design first.
- [ ] **Dating / Begleitung** — verified-member meetup requests. High trust requirement: design moderation + caregiver visibility before building.

---

## Infrastructure / Cross-cutting (do when needed, not upfront)

- [ ] DB migrations tooling (Flyway or raw SQL versioned files)
- [ ] Per-user feature flags in DB (`profile.flags`) to enable/disable modules per tablet
- [ ] Caregiver admin panel — manage contacts, photos, playlists, news sources for a user
- [ ] Audit log table + viewer (identity resolved, access denied, session events)
- [ ] Device revocation flow — remove WG key + set `disabled_at` in DB in one operation
- [ ] E2E tests (Playwright): news loads, contacts visible, memory game completes, identity correct per port
- [ ] CSP / HSTS / rate limiting hardening pass (before any public exposure)
