# seniornett

Local WireGuard-style device identity setup.

Identity "DB" lives in: `docker/identity-api/users.db.json`

## Run

```bash
docker compose up
```

Open one of these URLs:
- http://localhost:5173 (parent-tablet -> 10.44.0.25)
- http://localhost:5174 (grandpa-tablet -> 10.44.0.26)
- http://localhost:5175 (caregiver-tablet -> 10.44.0.27)

The top bar shows "Wer bin ich?" based on the port (device in production).

## Live development

- Edit files in `src/` as usual.
- Vite hot reload updates all three client pages immediately.
- Keep three browser windows open (5173/5174/5175) to develop and compare client views in parallel.

## Add a user (single place)

1. Edit `docker/identity-api/users.db.json`
2. Add one object with fields like:
	- `userId`, `username`, `displayName`, `role`
	- `wireguardPublicKey`, `vpnIp`, `localDevPort`, `deviceId`
3. Choose any free `localDevPort` in `5173..5185`
4. Restart stack: `docker compose up --build`

No app/proxy code change needed for new users in that range.
