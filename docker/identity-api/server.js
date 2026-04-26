/* eslint-disable @typescript-eslint/no-require-imports */

const express = require('express');
const { Pool } = require('pg');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function getForwardedIp(headerValue) {
  if (!headerValue) return null;
  return headerValue.split(',')[0].trim() || null;
}

async function findUser(sourceIp, sourcePort) {
  const { rows } = await pool.query(
    `SELECT user_id, username, display_name, language, role, device_id, vpn_ip::text AS vpn_ip
     FROM users
     WHERE vpn_ip = $1::inet OR local_dev_port = $2
     LIMIT 2`,
    [sourceIp || null, sourcePort ? Number(sourcePort) : null]
  );

  if (rows.length === 0) return { user: null, reason: 'not-found' };
  if (rows.length === 2 && rows[0].user_id !== rows[1].user_id)
    return { user: null, reason: 'ip-port-mismatch' };

  return { user: rows[0], reason: null };
}

app.get('/health', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) AS count FROM users');
    res.json({ ok: true, users: Number(rows[0].count) });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

// Called by nginx auth_request on every request.
// Returns 200 + identity headers on success, 403 on unknown/mismatched device.
// No body — nginx only reads the status code and response headers.
app.get('/internal/auth', async (req, res) => {
  const sourceIp = getForwardedIp(req.get('X-Forwarded-For'));
  const sourcePort = req.get('X-Source-Port');
  const { user } = await findUser(sourceIp, sourcePort);

  if (!user) {
    return res.status(403).end();
  }

  res.set('X-User-Id',   user.user_id);
  res.set('X-User-Name', user.display_name);
  res.set('X-User-Language', user.language || 'de');
  res.set('X-User-Role', user.role);
  res.set('X-Device-Id', user.device_id);
  res.set('X-Vpn-Ip',    user.vpn_ip);
  return res.status(200).end();
});

// Called by the SPA after nginx has validated identity and injected headers.
// Reads injected headers — no second IP lookup needed.
app.get('/api/identity', (req, res) => {
  const userId   = req.get('X-User-Id');
  const userName = req.get('X-User-Name');
  const userLanguage = req.get('X-User-Language') || 'de';
  const role     = req.get('X-User-Role');
  const deviceId = req.get('X-Device-Id');
  const vpnIp    = req.get('X-Vpn-Ip');

  if (!userId) {
    return res.status(403).json({ error: 'Missing identity headers — request did not pass auth_request?' });
  }

  return res.json({
    authenticated: true,
    deviceId,
    vpnIp,
    user: { id: userId, name: userName, role, language: userLanguage },
  });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`identity-api listening on ${port}`);
});
