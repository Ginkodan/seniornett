const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const DB_FILE = path.join(__dirname, 'users.db.json');

function loadUsersDb() {
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.users) ? parsed.users : [];
}

function getForwardedIp(headerValue) {
  if (!headerValue) return null;
  const first = headerValue.split(',')[0].trim();
  return first || null;
}

function findUser(users, sourceIp, sourcePort) {
  const byIp = sourceIp ? users.find((u) => u.vpnIp === sourceIp) : null;
  const byPort = sourcePort ? users.find((u) => String(u.localDevPort) === String(sourcePort)) : null;

  if (byIp && byPort && byIp.userId !== byPort.userId) {
    return { user: null, reason: 'ip-port-mismatch' };
  }

  return { user: byIp || byPort || null, reason: null };
}

app.get('/health', (_req, res) => {
  const users = loadUsersDb();
  res.json({ ok: true, users: users.length });
});

app.get('/api/whoami', (req, res) => {
  const users = loadUsersDb();
  const sourceIp = getForwardedIp(req.get('X-Forwarded-For'));
  const sourcePort = req.get('X-Source-Port');
  const { user, reason } = findUser(users, sourceIp, sourcePort);

  if (!user) {
    return res.status(403).json({
      error: 'Unknown or missing device identity',
      reason: reason || 'not-found',
    });
  }

  return res.json({
    authenticated: true,
    deviceId: user.deviceId,
    deviceLabel: user.deviceId,
    vpnIp: user.vpnIp,
    user: {
      id: user.userId,
      username: user.username,
      name: user.displayName,
      role: user.role,
    },
  });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`identity-api listening on ${port}`);
});
