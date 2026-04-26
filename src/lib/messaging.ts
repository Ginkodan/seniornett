import { getPool } from "@/lib/db";
import type { RequestIdentity } from "@/lib/request-auth";

type AppUserRow = {
  user_id: string;
  username: string;
  display_name: string;
  role: string;
  device_id: string;
};

type ContactRow = AppUserRow & {
  relationship_label: string | null;
};

async function getCurrentUser(userId: string): Promise<AppUserRow> {
  const { rows } = await getPool().query<AppUserRow>(
    `SELECT user_id, username, display_name, role, device_id
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

async function getAllowedContacts(userId: string): Promise<ContactRow[]> {
  const { rows } = await getPool().query<ContactRow>(
    `SELECT u.user_id,
            u.username,
            u.display_name,
            u.role,
            u.device_id,
            rel.label AS relationship_label
     FROM chat_relationships rel
     JOIN users u ON u.user_id = rel.contact_user_id
     WHERE rel.user_id = $1
     ORDER BY CASE WHEN u.role = 'caregiver' THEN 0 ELSE 1 END, u.display_name ASC`,
    [userId]
  );

  return rows;
}

type ChatMessageRow = {
  id: number;
  sender_user_id: string;
  recipient_user_id: string;
  body: string;
  created_at: string;
};

async function isAllowedContact(userId: string, contactUserId: string): Promise<boolean> {
  const { rows } = await getPool().query<{ ok: boolean }>(
    `SELECT TRUE AS ok
     FROM chat_relationships
     WHERE user_id = $1 AND contact_user_id = $2
     LIMIT 1`,
    [userId, contactUserId]
  );

  return Boolean(rows[0]?.ok);
}

async function getConversationMessages(
  userId: string,
  contactUserId: string
): Promise<ChatMessageRow[]> {
  const { rows } = await getPool().query<ChatMessageRow>(
    `SELECT id, sender_user_id, recipient_user_id, body, created_at::text
     FROM chat_messages
     WHERE (sender_user_id = $1 AND recipient_user_id = $2)
        OR (sender_user_id = $2 AND recipient_user_id = $1)
     ORDER BY created_at ASC, id ASC`,
    [userId, contactUserId]
  );

  return rows;
}

async function ensureMessagingSchema(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_relationships (
      user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      contact_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      label TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, contact_user_id),
      CHECK (user_id <> contact_user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGSERIAL PRIMARY KEY,
      sender_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      recipient_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (sender_user_id <> recipient_user_id)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS chat_messages_pair_created_idx
    ON chat_messages (sender_user_id, recipient_user_id, created_at DESC)
  `);

  await pool.query(
    `INSERT INTO chat_relationships (user_id, contact_user_id, label)
     VALUES
       ('user-parent-001', 'user-caregiver-001', 'Tochter & Betreuung'),
       ('user-caregiver-001', 'user-parent-001', 'Mutter'),
       ('user-grandpa-001', 'user-caregiver-001', 'Tochter & Betreuung'),
       ('user-caregiver-001', 'user-grandpa-001', 'Vater')
     ON CONFLICT (user_id, contact_user_id) DO NOTHING`
  );
}

export async function buildMessagingBootstrap(identity: RequestIdentity) {
  await ensureMessagingSchema();

  const currentUser = await getCurrentUser(identity.userId);
  const allowedContacts = await getAllowedContacts(identity.userId);

  const contacts: Array<{
    id: string;
    name: string;
    role: string;
    label: string | null;
    messages: Array<{
      id: string;
      senderId: string;
      role: "own" | "other";
      text: string;
      timestamp: string;
    }>;
  }> = [];

  for (const contact of allowedContacts) {
    const messages = await getConversationMessages(currentUser.user_id, contact.user_id);

    contacts.push({
      id: contact.user_id,
      name: contact.display_name,
      role: contact.role,
      label: contact.relationship_label || null,
      messages: messages.map((message) => ({
        id: String(message.id),
        senderId: message.sender_user_id,
        role: message.sender_user_id === currentUser.user_id ? "own" : "other",
        text: message.body,
        timestamp: message.created_at,
      })),
    });
  }

  return {
    user: {
      id: currentUser.user_id,
      name: currentUser.display_name,
      role: currentUser.role,
    },
    contacts,
  };
}

export async function sendChatMessage(identity: RequestIdentity, contactUserId: string, text: string) {
  await ensureMessagingSchema();

  const body = text.trim();

  if (!body) {
    throw new Error("Bitte eine Nachricht eingeben.");
  }

  const allowed = await isAllowedContact(identity.userId, contactUserId);

  if (!allowed) {
    throw new Error("Diese Person ist nicht fuer den Chat freigegeben.");
  }

  const { rows } = await getPool().query<ChatMessageRow>(
    `INSERT INTO chat_messages (sender_user_id, recipient_user_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, sender_user_id, recipient_user_id, body, created_at::text`,
    [identity.userId, contactUserId, body]
  );

  return {
    id: String(rows[0].id),
    senderId: rows[0].sender_user_id,
    role: "own" as const,
    text: rows[0].body,
    timestamp: rows[0].created_at,
  };
}
