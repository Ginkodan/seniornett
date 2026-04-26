DROP TABLE IF EXISTS table_chat_messages;
DROP TABLE IF EXISTS table_chat_presence;
DROP TABLE IF EXISTS table_chat_topics;
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
      "notfallkontakt": "Nina Meier, Tochter, 079 555 12 34",
      "tableChat": {
        "location": "Zürich",
        "age": "72",
        "interests": ["Jassen", "Kochen", "Spaziergänge"],
        "note": "Mag freundliche Gespräche und eine ruhige Runde in der Gruppe."
      }
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
      "notfallkontakt": "Nina Meier, Tochter, 079 555 12 34",
      "tableChat": {
        "location": "Luzern",
        "age": "79",
        "interests": ["Reisen", "Bücher", "Velofahrten"],
        "note": "Erzählt gern von Ausflügen und hört anderen gern zu."
      }
    }'::jsonb
  ),
  (
    'user-caregiver-001',
    'nina',
    'Nina',
    'de',
    'caregiver',
    'caregiver-tablet',
    'wg-pub-caregiver-demo',
    '10.44.0.27',
    5175,
    '{
      "vorname": "Nina",
      "nachname": "Meier",
      "tableChat": {
        "location": "Bern",
        "age": "48",
        "interests": ["Kaffee", "Gespräche", "Wandern"],
        "note": "Nimmt sich gern Zeit für ein gutes Gespräch."
      }
    }'::jsonb
  ),
  (
    'user-neighbor-001',
    'ruth',
    'Ruth',
    'de',
    'user',
    'neighbor-tablet-001',
    'wg-pub-neighbor-001-demo',
    '10.44.0.28',
    5176,
    '{
      "vorname": "Ruth",
      "nachname": "Schmid",
      "tableChat": {
        "location": "Basel",
        "age": "71",
        "interests": ["Backen", "Jassen", "Blumen"],
        "note": "Freut sich über ruhige Gespräche und einen Kaffee."
      }
    }'::jsonb
  ),
  (
    'user-neighbor-002',
    'peter',
    'Peter',
    'fr',
    'user',
    'neighbor-tablet-002',
    'wg-pub-neighbor-002-demo',
    '10.44.0.29',
    5177,
    '{
      "vorname": "Peter",
      "nachname": "Hug",
      "tableChat": {
        "location": "Lausanne",
        "age": "68",
        "interests": ["Kochen", "Fotografie", "Reisen"],
        "note": "Mag kleine Ausflüge und neue Begegnungen."
      }
    }'::jsonb
  );

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

CREATE TABLE table_chat_topics (
  topic_id         TEXT        PRIMARY KEY,
  title            TEXT        NOT NULL,
  subtitle         TEXT        NOT NULL,
  description      TEXT        NOT NULL,
  sort_order       INTEGER     NOT NULL
);

CREATE TABLE table_chat_presence (
  user_id          TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  topic_id         TEXT        NOT NULL REFERENCES table_chat_topics(topic_id) ON DELETE CASCADE,
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, topic_id)
);

CREATE TABLE table_chat_messages (
  id               BIGSERIAL   PRIMARY KEY,
  topic_id         TEXT        NOT NULL REFERENCES table_chat_topics(topic_id) ON DELETE CASCADE,
  sender_user_id   TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  body             TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX table_chat_messages_topic_created_idx
  ON table_chat_messages (topic_id, created_at ASC, id ASC);

INSERT INTO table_chat_topics (topic_id, title, subtitle, description, sort_order)
VALUES
  ('stammtisch', 'Stammtisch', 'Leichte Gespräche und erstes Kennenlernen', 'Eine offene Gruppe für ruhige Gespräche.', 1),
  ('reisen', 'Reisen', 'Ferien, Ausflüge und Lieblingsorte', 'Für kleine Geschichten von unterwegs.', 2),
  ('alltag', 'Alltag', 'Tipps, Küche und kleine Hilfe im Alltag', 'Eine Gruppe für das, was den Tag leichter macht.', 3);

INSERT INTO table_chat_presence (user_id, topic_id)
VALUES
  ('user-parent-001', 'stammtisch'),
  ('user-caregiver-001', 'stammtisch'),
  ('user-grandpa-001', 'reisen'),
  ('user-neighbor-001', 'reisen'),
  ('user-neighbor-002', 'alltag');

INSERT INTO table_chat_messages (topic_id, sender_user_id, body, created_at)
VALUES
  ('stammtisch', 'user-parent-001', 'Hoi miteinander. Wer ist heute in der Gruppe?', NOW() - INTERVAL '25 minutes'),
  ('stammtisch', 'user-caregiver-001', 'Ich habe kurz Zeit und einen Kaffee vor mir.', NOW() - INTERVAL '23 minutes'),
  ('reisen', 'user-grandpa-001', 'Ich würde gern wieder ans Meer fahren.', NOW() - INTERVAL '20 minutes'),
  ('reisen', 'user-neighbor-001', 'Für mich wäre eine kurze Zugreise ideal.', NOW() - INTERVAL '18 minutes'),
  ('alltag', 'user-neighbor-002', 'Hat jemand ein gutes Rezept für einen einfachen Apfelkuchen?', NOW() - INTERVAL '15 minutes');
