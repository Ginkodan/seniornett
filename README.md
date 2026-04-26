# seniornett

Local WireGuard-style device identity setup with a custom chat UI.

Identity and chat data live in Postgres via `docker/postgres/init.sql`.

## Run

```bash
docker compose up
```

Open one of these URLs:

- `http://localhost:5173` (parent-tablet -> 10.44.0.25)
- `http://localhost:5174` (grandpa-tablet -> 10.44.0.26)
- `http://localhost:5175` (caregiver-tablet -> 10.44.0.27)

The top bar shows "Wer bin ich?" based on the port (device in production).

## Messaging

- Chat history is stored in Postgres through `chat_messages`.
- Only contacts listed in `chat_relationships` are exposed in the UI.
- Messages remain available even after browser cache is cleared.

## Live development

- Edit files in `src/` as usual.
- Vite hot reload updates all three client pages immediately.
- Keep three browser windows open (5173/5174/5175) to develop and compare client views in parallel.

## Add a user (single place)

1. Edit the seeded user rows in `docker/postgres/init.sql`
2. Add a user with fields like:
   - `user_id`, `username`, `display_name`, `role`
   - `wireguard_pub_key`, `vpn_ip`, `local_dev_port`, `device_id`
3. Choose any free `localDevPort` in `5173..5185`
4. Restart stack: `docker compose up --build`

No app/proxy code change needed for new users in that range.
