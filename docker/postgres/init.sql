CREATE TABLE users (
  user_id            TEXT        PRIMARY KEY,
  username           TEXT        UNIQUE NOT NULL,
  display_name       TEXT        NOT NULL,
  role               TEXT        NOT NULL CHECK (role IN ('user', 'caregiver', 'admin')),
  device_id          TEXT        UNIQUE NOT NULL,
  wireguard_pub_key  TEXT        UNIQUE NOT NULL,
  vpn_ip             INET        UNIQUE NOT NULL,
  local_dev_port     INTEGER     UNIQUE,
  profile            JSONB       NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed data (mirrors former users.db.json)
INSERT INTO users (user_id, username, display_name, role, device_id, wireguard_pub_key, vpn_ip, local_dev_port)
VALUES
  ('user-parent-001',   'heidi',    'Heidi', 'user',      'parent-tablet',    'wg-pub-parent-demo',    '10.44.0.25', 5173),
  ('user-grandpa-001',  'walter',   'Walter','user',       'grandpa-tablet',   'wg-pub-grandpa-demo',   '10.44.0.26', 5174),
  ('user-caregiver-001','nina',     'Nina',  'caregiver',  'caregiver-tablet', 'wg-pub-caregiver-demo', '10.44.0.27', 5175);
