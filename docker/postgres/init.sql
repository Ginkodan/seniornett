DROP TABLE IF EXISTS users;

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
INSERT INTO users (
  user_id,
  username,
  display_name,
  role,
  device_id,
  wireguard_pub_key,
  vpn_ip,
  local_dev_port,
  profile
)
VALUES
  (
    'user-parent-001',
    'heidi',
    'Heidi',
    'user',
    'parent-tablet',
    'wg-pub-parent-demo',
    '10.44.0.25',
    5173,
    '{
      "vorname": "Heidi",
      "nachname": "Meier",
      "geburtsdatum": "14.03.1952",
      "blutgruppe": "A+",
      "krankenkasse": "SWICA",
      "kv_nummer": "756.1234.5678.90",
      "allergien": "Penicillin",
      "medikamente": "Ramipril 5 mg, Vitamin D",
      "hausarzt": "Dr. med. Claudia Keller, 044 555 10 20",
      "notfallkontakt": "Nina Meier, Tochter, 079 555 12 34"
    }'::jsonb
  ),
  (
    'user-grandpa-001',
    'walter',
    'Walter',
    'user',
    'grandpa-tablet',
    'wg-pub-grandpa-demo',
    '10.44.0.26',
    5174,
    '{
      "vorname": "Walter",
      "nachname": "Meier",
      "geburtsdatum": "22.11.1946",
      "blutgruppe": "0+",
      "krankenkasse": "CSS",
      "kv_nummer": "756.0987.6543.21",
      "allergien": "Keine bekannt",
      "medikamente": "Metformin 500 mg, Aspirin cardio 100 mg",
      "hausarzt": "Dr. med. Lukas Frei, 044 555 20 30",
      "notfallkontakt": "Nina Meier, Tochter, 079 555 12 34"
    }'::jsonb
  ),
  ('user-caregiver-001','nina',   'Nina',   'caregiver', 'caregiver-tablet', 'wg-pub-caregiver-demo', '10.44.0.27', 5175, '{}'::jsonb);
