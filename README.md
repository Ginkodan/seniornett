# SeniorNett

Calm, high-contrast Next.js app for senior users: home, messages, social hub, marketplace, media, weather, map, audio, video, lexicon, and emergency info.

## Design Direction

The current UI uses a calm tablet-first system with:

- Atkinson Hyperlegible throughout the app
- warm neutral backgrounds
- colorful but restrained app tiles
- clear page headers with subtitles
- stronger focus styles and larger touch targets
- explicit labels for primary actions

The goal is readability first, with color used for orientation and grouping rather than decoration.

## Quick Start

```bash
docker compose up
```

Open a seeded device view:

- `http://localhost:5173`
- `http://localhost:5174`
- `http://localhost:5175`

The nginx proxy maps local ports to seeded device identities from `docker/postgres/init.sql`. Ports `5173..5185` are reserved for local device views.

## Local App Only

```bash
npm install
npm run dev
```

Default app port: `5176`.

## Tablet Review

The main review viewport is labeled `tablet-landscape` and uses `1180x820`.

```bash
npm run ui:review
```

This command:

- captures after screenshots in `reports/ui-review/after/tablet-landscape/`
- checks keyboard focus movement
- checks for obvious keyboard traps
- checks the tablet layout again at `1024x768`
- generates color-vision-deficiency screenshots for the home screen in `reports/accessibility/screenshots/tablet-landscape/`

The before screenshots live in `reports/ui-review/before/tablet-landscape/`.

## Accessibility Audit

```bash
npm run a11y:install
npm run a11y:audit
```

You can point the audit at a running app:

```bash
A11Y_BASE_URL=http://127.0.0.1:5176 npm run a11y:audit
```

Reports are written to:

- `reports/accessibility/a11y-results.json`
- `reports/accessibility/a11y-report.md`
- `reports/accessibility/screenshots/tablet-landscape/`

The audit fails on serious or critical accessibility violations.

## Checks

```bash
npm run lint
npm run build
```

## Stack

- `src/app`: Next routes and server actions
- `src/components`: TSX screens and shared UI primitives
- `src/components/ui`: reusable design-system building blocks
- `src/lib`: domain logic and shared helpers
- `docker/postgres/init.sql`: users, relationships, chat/media seed data
- `docker/nginx/nginx.conf`: local device identity routing

## Services

`docker compose up` starts:

- Next app
- Postgres
- identity API
- nginx device proxy
- Garage S3-compatible media storage

## Add a Local User

1. Add the user/device rows in `docker/postgres/init.sql`.
2. Pick a free `local_dev_port` in `5173..5185`.
3. Restart with:

```bash
docker compose up --build
```

No app or proxy code change is needed for ports in that range.

## UI Screenshots

```bash
# or, if you only need browsers installed
npm run a11y:install

# capture screenshots and run the review
npm run ui:review
```

## Output Locations

- `reports/ui-review/before/tablet-landscape/`
- `reports/ui-review/after/tablet-landscape/`
- `reports/accessibility/screenshots/tablet-landscape/`
- `reports/accessibility/a11y-results.json`
- `reports/accessibility/a11y-report.md`

## Interpreting Failures

- `ui:review` failures usually mean a route did not render, keyboard focus did not move, or the tablet layout overflowed horizontally.
- `a11y:audit` failures with `serious` or `critical` impact need attention before release.
- If the audit is pointed at a running app with `A11Y_BASE_URL`, make sure the server matches the code you want to check.
