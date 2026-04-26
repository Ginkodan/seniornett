import { getPool } from "@/lib/db";
import type { RequestIdentity } from "@/lib/request-auth";
import { ensureChatRelationship, type ChatContactMessage } from "@/lib/chat-core";

type TableChatTopicRow = {
  topic_id: string;
  title: string;
  subtitle: string;
  description: string;
  sort_order: number;
};

type TableChatMessageRow = {
  id: number;
  topic_id: string;
  sender_user_id: string;
  sender_name: string;
  body: string;
  created_at: string;
};

type TableChatProfile = {
  location: string;
  age: string;
  interests: string[];
  note: string;
};

type TableChatPersonRow = {
  user_id: string;
  display_name: string;
  role: string;
  relationship_label: string | null;
  is_contact: boolean;
  profile: unknown;
};

export type TableChatTopic = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  peopleCount: number;
};

export type TableChatPerson = {
  id: string;
  name: string;
  role: string;
  label: string | null;
  isContact: boolean;
  profile: TableChatProfile;
};

export type TableChatMessage = ChatContactMessage & {
  topicId: string;
  senderName: string;
};

export type TableChatBootstrap = {
  user: {
    id: string;
    name: string;
    role: string;
  };
  topics: TableChatTopic[];
  joinedTopicIds: string[];
  currentTopic: TableChatTopic;
  people: TableChatPerson[];
  messages: TableChatMessage[];
};

const TABLE_CHAT_TOPICS: Array<Pick<TableChatTopicRow, "topic_id" | "title" | "subtitle" | "description" | "sort_order">> = [
  {
    topic_id: "stammtisch",
    title: "Stammtisch",
    subtitle: "Leichte Gespräche und erstes Kennenlernen",
    description: "Eine offene Gruppe für ruhige Gespräche.",
    sort_order: 1,
  },
  {
    topic_id: "reisen",
    title: "Reisen",
    subtitle: "Ferien, Ausflüge und Lieblingsorte",
    description: "Für kleine Geschichten von unterwegs.",
    sort_order: 2,
  },
  {
    topic_id: "alltag",
    title: "Alltag",
    subtitle: "Tipps, Küche und kleine Hilfe im Alltag",
    description: "Eine Gruppe für das, was den Tag leichter macht.",
    sort_order: 3,
  },
];

function parseProfile(input: unknown): TableChatProfile {
  const value = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const interestsRaw = value.interests;

  return {
    location: typeof value.location === "string" ? value.location : "",
    age: typeof value.age === "string" ? value.age : "",
    interests: Array.isArray(interestsRaw) ? interestsRaw.filter((item): item is string => typeof item === "string") : [],
    note: typeof value.note === "string" ? value.note : "",
  };
}

async function ensureTableChatSchema(): Promise<void> {
  const pool = getPool();

  await pool.query(`
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
      )
    ON CONFLICT (user_id) DO UPDATE
      SET profile = COALESCE(users.profile, '{}'::jsonb) || EXCLUDED.profile
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS table_chat_topics (
      topic_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      description TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS table_chat_presence (
      user_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
      topic_id TEXT NOT NULL REFERENCES table_chat_topics(topic_id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE table_chat_presence
    DROP CONSTRAINT IF EXISTS table_chat_presence_pkey
  `);

  await pool.query(`
    ALTER TABLE table_chat_presence
    ADD PRIMARY KEY (user_id, topic_id)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS table_chat_messages (
      id BIGSERIAL PRIMARY KEY,
      topic_id TEXT NOT NULL REFERENCES table_chat_topics(topic_id) ON DELETE CASCADE,
      sender_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS table_chat_messages_topic_created_idx
    ON table_chat_messages (topic_id, created_at ASC, id ASC)
  `);

  for (const topic of TABLE_CHAT_TOPICS) {
    await pool.query(
      `INSERT INTO table_chat_topics (topic_id, title, subtitle, description, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (topic_id) DO UPDATE
       SET title = EXCLUDED.title,
           subtitle = EXCLUDED.subtitle,
           description = EXCLUDED.description,
           sort_order = EXCLUDED.sort_order`,
      [topic.topic_id, topic.title, topic.subtitle, topic.description, topic.sort_order]
    );
  }

  await pool.query(
    `UPDATE table_chat_messages
     SET body = 'Hoi miteinander. Wer ist heute in der Gruppe?'
     WHERE topic_id = 'stammtisch'
       AND sender_user_id = 'user-parent-001'
       AND body = 'Hoi miteinander. Wer sitzt heute mit am Tisch?'`
  );

  await pool.query(`
    INSERT INTO table_chat_presence (user_id, topic_id)
    VALUES
      ('user-parent-001', 'stammtisch'),
      ('user-caregiver-001', 'stammtisch'),
      ('user-grandpa-001', 'reisen'),
      ('user-neighbor-001', 'reisen'),
      ('user-neighbor-002', 'alltag')
    ON CONFLICT (user_id, topic_id) DO NOTHING
  `);

  const { rows: messageCountRows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM table_chat_messages`
  );

  if (Number(messageCountRows[0]?.count || "0") === 0) {
    await pool.query(`
      INSERT INTO table_chat_messages (topic_id, sender_user_id, body, created_at)
      VALUES
        ('stammtisch', 'user-parent-001', 'Hoi miteinander. Wer ist heute in der Gruppe?', NOW() - INTERVAL '25 minutes'),
        ('stammtisch', 'user-caregiver-001', 'Ich habe kurz Zeit und einen Kaffee vor mir.', NOW() - INTERVAL '23 minutes'),
        ('reisen', 'user-grandpa-001', 'Ich würde gern wieder ans Meer fahren.', NOW() - INTERVAL '20 minutes'),
        ('reisen', 'user-neighbor-001', 'Für mich wäre eine kurze Zugreise ideal.', NOW() - INTERVAL '18 minutes'),
        ('alltag', 'user-neighbor-002', 'Hat jemand ein gutes Rezept für einen einfachen Apfelkuchen?', NOW() - INTERVAL '15 minutes')
    `);
  }

  await pool.query(`
    WITH ranked AS (
      SELECT ctid,
             row_number() OVER (
               PARTITION BY topic_id, sender_user_id, body
               ORDER BY created_at ASC, id ASC
             ) AS rn
      FROM table_chat_messages
      WHERE (topic_id = 'stammtisch' AND sender_user_id = 'user-parent-001' AND body = 'Hoi miteinander. Wer ist heute in der Gruppe?')
         OR (topic_id = 'stammtisch' AND sender_user_id = 'user-caregiver-001' AND body = 'Ich habe kurz Zeit und einen Kaffee vor mir.')
         OR (topic_id = 'reisen' AND sender_user_id = 'user-grandpa-001' AND body = 'Ich würde gern wieder ans Meer fahren.')
         OR (topic_id = 'reisen' AND sender_user_id = 'user-neighbor-001' AND body = 'Für mich wäre eine kurze Zugreise ideal.')
         OR (topic_id = 'alltag' AND sender_user_id = 'user-neighbor-002' AND body = 'Hat jemand ein gutes Rezept für einen einfachen Apfelkuchen?')
    )
    DELETE FROM table_chat_messages
    WHERE ctid IN (SELECT ctid FROM ranked WHERE rn > 1)
  `);
}

async function getCurrentUser(userId: string) {
  const { rows } = await getPool().query<{ user_id: string; display_name: string; role: string }>(
    `SELECT user_id, display_name, role
     FROM users
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );

  if (!rows[0]) {
    throw new Error("Benutzerprofil wurde in der Datenbank nicht gefunden.");
  }

  return rows[0];
}

async function getJoinedTopicIds(userId: string): Promise<string[]> {
  const { rows } = await getPool().query<{ topic_id: string }>(
    `SELECT topic_id
     FROM table_chat_presence
     WHERE user_id = $1
     ORDER BY joined_at DESC, topic_id ASC`,
    [userId]
  );

  return rows.map((row) => row.topic_id);
}

async function joinTopic(userId: string, topicId: string): Promise<void> {
  await getPool().query(
    `INSERT INTO table_chat_presence (user_id, topic_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, topic_id) DO UPDATE SET joined_at = NOW()`,
    [userId, topicId]
  );
}

async function getTopics(): Promise<TableChatTopic[]> {
  const { rows } = await getPool().query<TableChatTopicRow & { people_count: string }>(
    `SELECT t.topic_id, t.title, t.subtitle, t.description, t.sort_order,
            COUNT(p.user_id)::text AS people_count
     FROM table_chat_topics t
     LEFT JOIN table_chat_presence p ON p.topic_id = t.topic_id
     GROUP BY t.topic_id, t.title, t.subtitle, t.description, t.sort_order
     ORDER BY t.sort_order ASC, t.topic_id ASC`
  );

  return rows.map((row) => ({
    id: row.topic_id,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    peopleCount: Number(row.people_count || "0"),
  }));
}

async function getCurrentTopicId(userId: string, requestedTopicId?: string | null): Promise<string> {
  const topicId = requestedTopicId || (await getJoinedTopicIds(userId))[0];
  const { rows } = await getPool().query<{ topic_id: string }>(
    `SELECT topic_id
     FROM table_chat_topics
     WHERE topic_id = $1
     LIMIT 1`,
    [topicId]
  );

  return rows[0]?.topic_id || (await getTopics())[0]?.id || "stammtisch";
}

async function getTopicMessages(topicId: string, currentUserId: string): Promise<TableChatMessage[]> {
  const { rows } = await getPool().query<TableChatMessageRow>(
    `SELECT m.id,
            m.topic_id,
            m.sender_user_id,
            u.display_name AS sender_name,
            m.body,
            m.created_at::text
     FROM table_chat_messages m
     JOIN users u ON u.user_id = m.sender_user_id
     WHERE m.topic_id = $1
     ORDER BY m.created_at ASC, m.id ASC`,
    [topicId]
  );

  return rows.map((row) => ({
    id: String(row.id),
    topicId: row.topic_id,
    senderId: row.sender_user_id,
    senderName: row.sender_name,
    role: row.sender_user_id === currentUserId ? "own" : "other",
    text: row.body,
    timestamp: row.created_at,
  }));
}

async function getTopicPeople(topicId: string, currentUserId: string): Promise<TableChatPerson[]> {
  const { rows } = await getPool().query<TableChatPersonRow>(
    `WITH visible_people AS (
       SELECT p.user_id
       FROM table_chat_presence p
       WHERE p.topic_id = $1
       UNION
       SELECT m.sender_user_id AS user_id
       FROM table_chat_messages m
       WHERE m.topic_id = $1
     )
     SELECT u.user_id,
            u.display_name,
            u.role,
            rel.label AS relationship_label,
            CASE WHEN rel.contact_user_id IS NULL THEN FALSE ELSE TRUE END AS is_contact,
            u.profile
     FROM visible_people vp
     JOIN users u ON u.user_id = vp.user_id
     LEFT JOIN chat_relationships rel
       ON rel.user_id = $2
      AND rel.contact_user_id = u.user_id
     WHERE u.user_id <> $2
     ORDER BY u.display_name ASC`,
    [topicId, currentUserId]
  );

  return rows.map((row) => ({
    id: row.user_id,
    name: row.display_name,
    role: row.role,
    label: row.relationship_label || null,
    isContact: row.is_contact,
    profile: parseProfile((row.profile as Record<string, unknown> | null)?.tableChat),
  }));
}

async function getCurrentTopicView(currentUserId: string, requestedTopicId?: string | null) {
  const topics = await getTopics();
  const joinedTopicIds = await getJoinedTopicIds(currentUserId);
  const currentTopicId = await getCurrentTopicId(currentUserId, requestedTopicId);
  const currentTopic = topics.find((topic) => topic.id === currentTopicId) || topics[0];

  if (!currentTopic) {
    throw new Error("Es konnte keine Gruppe gefunden werden.");
  }

  return {
    topics,
    joinedTopicIds,
    currentTopic,
    people: await getTopicPeople(currentTopic.id, currentUserId),
    messages: await getTopicMessages(currentTopic.id, currentUserId),
  };
}

function getContactLabel(profile: TableChatProfile): string {
  if (profile.interests.length) {
    return profile.interests.slice(0, 2).join(" · ");
  }

  if (profile.location) {
    return profile.location;
  }

  return "TableChat";
}

export async function buildTableChatBootstrap(
  identity: RequestIdentity,
  topicId?: string | null
): Promise<TableChatBootstrap> {
  await ensureTableChatSchema();
  const currentUser = await getCurrentUser(identity.userId);
  const view = await getCurrentTopicView(currentUser.user_id, topicId);

  return {
    user: {
      id: currentUser.user_id,
      name: currentUser.display_name,
      role: currentUser.role,
    },
    topics: view.topics,
    joinedTopicIds: view.joinedTopicIds,
    currentTopic: view.currentTopic,
    people: view.people.map((person) => ({
      ...person,
      label: person.label || getContactLabel(person.profile),
    })),
    messages: view.messages,
  };
}

export async function setTableChatTopic(identity: RequestIdentity, topicId: string): Promise<TableChatBootstrap> {
  await ensureTableChatSchema();

  const { rows } = await getPool().query<{ topic_id: string }>(
    `SELECT topic_id
     FROM table_chat_topics
     WHERE topic_id = $1
     LIMIT 1`,
    [topicId]
  );

  if (!rows[0]) {
    throw new Error("Diese Gruppe ist nicht vorhanden.");
  }

  await joinTopic(identity.userId, topicId);
  return buildTableChatBootstrap(identity, topicId);
}

export async function sendTableChatMessage(identity: RequestIdentity, topicId: string, text: string) {
  await ensureTableChatSchema();
  const currentUser = await getCurrentUser(identity.userId);

  const body = text.trim();

  if (!body) {
    throw new Error("Bitte eine Nachricht eingeben.");
  }

  const { rows } = await getPool().query<{ ok: boolean }>(
    `SELECT TRUE AS ok
     FROM table_chat_topics
     WHERE topic_id = $1
     LIMIT 1`,
    [topicId]
  );

  if (!rows[0]?.ok) {
    throw new Error("Diese Gruppe ist nicht vorhanden.");
  }

  await joinTopic(identity.userId, topicId);

  const { rows: inserted } = await getPool().query<TableChatMessageRow>(
    `INSERT INTO table_chat_messages (topic_id, sender_user_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, topic_id, sender_user_id, body, created_at::text`,
    [topicId, identity.userId, body]
  );

  if (!inserted[0]) {
    throw new Error("Nachricht konnte nicht gespeichert werden.");
  }

  return {
    id: String(inserted[0].id),
    topicId: inserted[0].topic_id,
    senderId: inserted[0].sender_user_id,
    senderName: currentUser.display_name,
    role: "own" as const,
    text: inserted[0].body,
    timestamp: inserted[0].created_at,
  };
}

export async function hopToPrivateChat(identity: RequestIdentity, contactUserId: string): Promise<void> {
  await ensureTableChatSchema();

  const { rows } = await getPool().query<{ contact_label: string; display_name: string }>(
    `SELECT u.display_name,
            COALESCE((u.profile->'tableChat'->>'label'), u.display_name) AS contact_label
     FROM users u
     WHERE u.user_id = $1
       AND u.user_id <> $2
       AND (
         EXISTS (
           SELECT 1
           FROM table_chat_presence p
           WHERE p.user_id = u.user_id
         )
         OR EXISTS (
           SELECT 1
           FROM table_chat_messages m
           WHERE m.sender_user_id = u.user_id
         )
       )
     LIMIT 1`,
    [contactUserId, identity.userId]
  );

  if (!rows[0]) {
    throw new Error("Diese Person ist gerade nicht sichtbar.");
  }

  await ensureChatRelationship(identity.userId, contactUserId, "TableChat-Kontakt");
  await ensureChatRelationship(contactUserId, identity.userId, rows[0].contact_label);
}
