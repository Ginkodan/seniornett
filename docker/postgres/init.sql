DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_relationships;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  user_id            TEXT        PRIMARY KEY,
  username           TEXT        UNIQUE NOT NULL,
  display_name       TEXT        NOT NULL,
  language           TEXT        NOT NULL DEFAULT 'de' CHECK (language IN ('de', 'fr')),
  role               TEXT        NOT NULL CHECK (role IN ('user', 'caregiver', 'admin')),
  device_id          TEXT        UNIQUE NOT NULL,
  wireguard_pub_key  TEXT        UNIQUE NOT NULL,
  vpn_ip             INET        UNIQUE NOT NULL,
  local_dev_port     INTEGER     UNIQUE,
  profile            JSONB       NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_relationships (
  user_id          TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  contact_user_id  TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  label            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, contact_user_id),
  CHECK (user_id <> contact_user_id)
);

CREATE TABLE chat_messages (
  id               BIGSERIAL   PRIMARY KEY,
  sender_user_id   TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  recipient_user_id TEXT       NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  body             TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (sender_user_id <> recipient_user_id)
);

CREATE INDEX chat_messages_pair_created_idx
  ON chat_messages (sender_user_id, recipient_user_id, created_at DESC);

-- Seed data (mirrors former users.db.json)
INSERT INTO users (
  user_id,
  username,
  display_name,
  language,
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
    'de',
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
    'fr',
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
  ('user-caregiver-001','nina',   'Nina',   'de', 'caregiver', 'caregiver-tablet', 'wg-pub-caregiver-demo', '10.44.0.27', 5175, '{}'::jsonb);

INSERT INTO chat_relationships (user_id, contact_user_id, label)
VALUES
  ('user-parent-001', 'user-caregiver-001', 'Tochter & Betreuung'),
  ('user-caregiver-001', 'user-parent-001', 'Mutter'),
  ('user-grandpa-001', 'user-caregiver-001', 'Tochter & Betreuung'),
  ('user-caregiver-001', 'user-grandpa-001', 'Vater');

INSERT INTO chat_messages (sender_user_id, recipient_user_id, body, created_at)
VALUES
  ('user-parent-001', 'user-caregiver-001', 'Hallo Nina', NOW() - INTERVAL '2 hours'),
  ('user-caregiver-001', 'user-parent-001', 'Hellooo', NOW() - INTERVAL '1 hour 50 minutes'),
  ('user-caregiver-001', 'user-parent-001', 'Blibal', NOW() - INTERVAL '1 hour 49 minutes'),
  ('user-parent-001', 'user-caregiver-001', 'Hallo Heidi', NOW() - INTERVAL '30 minutes'),
  ('user-caregiver-001', 'user-parent-001', 'Hi!', NOW() - INTERVAL '29 minutes'),
  ('user-grandpa-001', 'user-caregiver-001', 'Bisch du do?', NOW() - INTERVAL '20 minutes'),
  ('user-caregiver-001', 'user-grandpa-001', 'Ja, ich bin da.', NOW() - INTERVAL '19 minutes');
