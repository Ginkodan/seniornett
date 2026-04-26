# SeniorNett

Calm, high-contrast Next.js app for senior users: home, messages, social hub, media, weather, map, audio, video, lexicon, and emergency info.

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
# install browser drivers
npm run visual:install

# create screnshots and generate report
npm run visual:audit
npm run visual:report
```
