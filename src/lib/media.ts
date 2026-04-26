import { createHash, randomUUID } from "crypto";
import { readdir, readFile } from "fs/promises";
import path from "path";

import { ensureChatSchema } from "@/lib/chat-core";
import { getPool } from "@/lib/db";
import { inferJson } from "@/lib/inference";
import { putObject, getObject } from "@/lib/object-storage";
import type { RequestIdentity } from "@/lib/request-auth";

type CurrentUserRow = {
  user_id: string;
  display_name: string;
  role: string;
  language: string;
};

type OwnerRow = {
  user_id: string;
  display_name: string;
  role: string;
  relationship_label: string | null;
  profile: unknown;
};

type CollectionRow = {
  id: string;
  name: string;
  kind: string;
  visibility: string;
  sort_order: number;
  item_count: string;
};

type MediaItemRow = {
  id: string;
  owner_user_id: string;
  kind: string;
  title: string;
  senior_label: string;
  plain_description: string;
  plain_summary: string;
  source_kind: string;
  source_person_id: string | null;
  received_at: string;
  sensitivity: string;
  lifecycle_state: string;
  created_at: string;
  updated_at: string;
  blob_bucket: string;
  blob_key: string;
  mime_type: string;
  byte_size: string;
  checksum: string;
  labels: string[] | null;
  collections: string[] | null;
  source_person_name: string | null;
};

export type MediaOwner = {
  id: string;
  name: string;
  role: string;
  label: string | null;
};

export type MediaCollection = {
  id: string;
  name: string;
  kind: string;
  visibility: string;
  sortOrder: number;
  count: number;
};

export type MediaItem = {
  id: string;
  ownerUserId: string;
  kind: string;
  title: string;
  seniorLabel: string;
  plainDescription: string;
  plainSummary: string;
  sourceKind: string;
  sourcePersonId: string | null;
  sourcePersonName: string | null;
  receivedAt: string;
  sensitivity: string;
  lifecycleState: string;
  createdAt: string;
  updatedAt: string;
  mimeType: string;
  byteSize: number;
  checksum: string;
  labels: string[];
  collections: string[];
  previewDataUrl: string | null;
};

export type MediaBootstrap = {
  user: {
    id: string;
    name: string;
    role: string;
    language: string;
  };
  owners: MediaOwner[];
  selectedOwnerId: string;
  collections: MediaCollection[];
  items: MediaItem[];
};

const MEDIA_BUCKET = process.env.SENIORNETT_MEDIA_S3_BUCKET || "seniornett-media";
const HEIDI_USER_ID = "user-parent-001";
const DEFAULT_COLLECTIONS = [
  { name: "Eingangskorb", kind: "inbox", sortOrder: 0 },
  { name: "Fotoalbum", kind: "album", sortOrder: 1 },
  { name: "Papiermappe", kind: "binder", sortOrder: 2 },
  { name: "Gesundheit", kind: "category", sortOrder: 3 },
  { name: "Versicherung", kind: "category", sortOrder: 4 },
  { name: "Geld & Rechnungen", kind: "category", sortOrder: 5 },
  { name: "Wohnen", kind: "category", sortOrder: 6 },
  { name: "Reisen", kind: "category", sortOrder: 7 },
  { name: "Notfall", kind: "emergency", sortOrder: 8 },
] as const;

const DEMO_ASSET_TITLES: Record<string, { title: string; summary: string; collections: string[]; labels: string[] }> = {
  "berg.jpg": {
    title: "Berg im Sonnenlicht",
    summary: "Ein helles Foto vom Berg.",
    collections: ["Eingangskorb", "Fotoalbum"],
    labels: ["Berg", "Natur", "Foto"],
  },
  "file_example_JPG_100kB.jpg": {
    title: "Beispiel-Foto",
    summary: "Ein Beispielbild zum Anschauen.",
    collections: ["Eingangskorb", "Fotoalbum"],
    labels: ["Foto", "Beispiel"],
  },
  "file_example_PNG_500kB.png": {
    title: "Beispiel-Bild",
    summary: "Ein weiteres Bild für die Ersteinrichtung.",
    collections: ["Eingangskorb", "Fotoalbum"],
    labels: ["Bild", "Beispiel"],
  },
  "file_example_GIF_500kB.gif": {
    title: "Animiertes Beispiel",
    summary: "Eine kleine animierte Datei.",
    collections: ["Eingangskorb", "Fotoalbum"],
    labels: ["GIF", "Beispiel"],
  },
  "file-sample_150kB.pdf": {
    title: "Beispiel-Papier",
    summary: "Ein PDF als Beispiel für wichtige Papiere.",
    collections: ["Eingangskorb", "Papiermappe", "Gesundheit"],
    labels: ["PDF", "Papier", "Beispiel"],
  },
  "file-sample_100kB.docx": {
    title: "Beispiel-Dokument",
    summary: "Ein Textdokument als Beispiel.",
    collections: ["Eingangskorb", "Papiermappe"],
    labels: ["Dokument", "Beispiel"],
  },
};

function createChecksum(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function humanizeName(value: string) {
  const base = value.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  if (!base) return "Unbenannt";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function detectKind(fileName: string, mimeType: string) {
  if (mimeType.startsWith("image/")) return "photo";
  if (mimeType === "application/pdf" || /\.(pdf)$/i.test(fileName)) return "document";
  if (/\.(doc|docx)$/i.test(fileName)) return "document";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "unknown";
}

function detectMimeType(fileName: string, fallback = "application/octet-stream") {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".doc")) return "application/msword";
  return fallback;
}

function isInlinePreview(mimeType: string) {
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

function toDataUrl(mimeType: string, bytes: Buffer) {
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

function normalizeLabels(raw: string | undefined) {
  return (raw || "")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9äöüÄÖÜ\s-]+/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeSearchText(value: string) {
  const normalized = normalizeSearchText(value);
  if (!normalized) {
    return [];
  }

  const tokens = new Set<string>();

  for (const token of normalized.split(" ")) {
    if (!token) continue;
    tokens.add(token);

    const stripped = token
      .replace(/(innen|innen|ern|eren|er|en|em|es|e|n|s)$/i, "")
      .replace(/(bilder|bild|fotos|foto|bildern)$/i, "")
      .trim();

    if (stripped && stripped.length >= 3) {
      tokens.add(stripped);
    }
  }

  return Array.from(tokens);
}

function buildItemSearchBlob(item: MediaItem) {
  return [
    item.title,
    item.seniorLabel,
    item.plainDescription,
    item.plainSummary,
    item.sourcePersonName,
    item.labels.join(" "),
    item.collections.join(" "),
  ]
    .filter(Boolean)
    .join(" ");
}

function scoreMediaItemForSearch(item: MediaItem, needle: string, terms: string[]) {
  const haystack = normalizeSearchText(buildItemSearchBlob(item));
  const title = normalizeSearchText([item.title, item.seniorLabel].filter(Boolean).join(" "));
  const labels = normalizeSearchText(item.labels.join(" "));
  const collections = normalizeSearchText(item.collections.join(" "));
  const summary = normalizeSearchText([item.plainDescription, item.plainSummary].filter(Boolean).join(" "));
  const tokens = tokenizeSearchText(buildItemSearchBlob(item));

  let score = 0;

  if (haystack.includes(needle)) {
    score += 120;
  }

  for (const term of terms) {
    if (!term) continue;

    if (title.includes(term)) score += 25;
    if (labels.includes(term)) score += 35;
    if (collections.includes(term)) score += 10;
    if (summary.includes(term)) score += 8;

    for (const token of tokens) {
      if (token === term) {
        score += 18;
      } else if (token.includes(term) || term.includes(token)) {
        score += 6;
      }
    }
  }

  return score;
}

type SearchExpansion = {
  keywords?: string[];
  phrases?: string[];
};

async function expandSearchQuery(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return { keywords: [], phrases: [] };

  try {
    const { value } = await inferJson<SearchExpansion>(
      [
        "Du hilfst beim Finden von Fotos und Papieren in SeniorNett.",
        "Antworte nur mit JSON im Format {\"keywords\":[...],\"phrases\":[...]}.",
        "Gib kurze Suchworte auf Deutsch zurück, die die Frage besser treffen.",
        "Frage: ",
        trimmed,
      ].join("\n"),
      {
        generation_options: {
          max_new_tokens: 120,
          temperature: 0.1,
          top_p: 0.9,
        },
      }
    );

    const keywords = (value?.keywords || []).map((entry) => entry.trim()).filter(Boolean);
    const phrases = (value?.phrases || []).map((entry) => entry.trim()).filter(Boolean);
    return {
      keywords,
      phrases,
    };
  } catch {
    return { keywords: [], phrases: [] };
  }
}

async function getCurrentUser(identity: RequestIdentity): Promise<CurrentUserRow> {
  const { rows } = await getPool().query<CurrentUserRow>(
    `SELECT user_id, display_name, role, language
     FROM users
     WHERE user_id = $1
     LIMIT 1`,
    [identity.userId]
  );

  if (!rows[0]) {
    throw new Error("Benutzerprofil wurde in der Datenbank nicht gefunden.");
  }

  return rows[0];
}

async function getAccessibleOwners(currentUser: CurrentUserRow): Promise<OwnerRow[]> {
  await ensureChatSchema();

  if (currentUser.role === "user") {
    const { rows } = await getPool().query<OwnerRow>(
      `SELECT u.user_id, u.display_name, u.role, rel.label AS relationship_label, u.profile
       FROM users u
       LEFT JOIN chat_relationships rel
         ON rel.user_id = $1 AND rel.contact_user_id = u.user_id
       WHERE u.user_id = $1
       LIMIT 1`,
      [currentUser.user_id]
    );

    return rows;
  }

  const { rows } = await getPool().query<OwnerRow>(
    `SELECT u.user_id, u.display_name, u.role, rel.label AS relationship_label, u.profile
     FROM users u
     LEFT JOIN chat_relationships rel
       ON rel.user_id = $1 AND rel.contact_user_id = u.user_id
     WHERE u.role = 'user'
     ORDER BY CASE WHEN rel.label IS NOT NULL THEN 0 ELSE 1 END, u.display_name ASC`,
    [currentUser.user_id]
  );

  return rows;
}

async function ensureDefaultCollections(ownerUserId: string) {
  for (const collection of DEFAULT_COLLECTIONS) {
    await getPool().query(
      `INSERT INTO media_collections (id, owner_user_id, name, kind, visibility, sort_order)
       VALUES ($1, $2, $3, $4, 'private', $5)
       ON CONFLICT (owner_user_id, name)
       DO UPDATE SET kind = EXCLUDED.kind,
                     visibility = EXCLUDED.visibility,
                     sort_order = EXCLUDED.sort_order`,
      [`collection-${ownerUserId}-${collection.sortOrder}`, ownerUserId, collection.name, collection.kind, collection.sortOrder]
    );
  }
}

async function getCollections(ownerUserId: string): Promise<MediaCollection[]> {
  const { rows } = await getPool().query<CollectionRow>(
    `SELECT c.id,
            c.name,
            c.kind,
            c.visibility,
            c.sort_order,
            COUNT(mic.media_item_id)::text AS item_count
     FROM media_collections c
     LEFT JOIN media_item_collections mic
       ON mic.collection_id = c.id
     LEFT JOIN media_items mi
       ON mi.id = mic.media_item_id AND mi.owner_user_id = c.owner_user_id
     WHERE c.owner_user_id = $1
     GROUP BY c.id
     ORDER BY c.sort_order ASC, c.name ASC`,
    [ownerUserId]
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    visibility: row.visibility,
    sortOrder: row.sort_order,
    count: Number(row.item_count || 0),
  }));
}

async function getSourcePersonName(sourcePersonId: string | null): Promise<string | null> {
  if (!sourcePersonId) return null;

  const { rows } = await getPool().query<{ display_name: string }>(
    `SELECT display_name
     FROM users
     WHERE user_id = $1
     LIMIT 1`,
    [sourcePersonId]
  );

  return rows[0]?.display_name || null;
}

async function getMediaItems(ownerUserId: string): Promise<MediaItem[]> {
  const { rows } = await getPool().query<MediaItemRow>(
    `SELECT mi.id,
            mi.owner_user_id,
            mi.kind,
            mi.title,
            mi.senior_label,
            mi.plain_description,
            mi.plain_summary,
            mi.source_kind,
            mi.source_person_id,
            mi.received_at::text,
            mi.sensitivity,
            mi.lifecycle_state,
            mi.created_at::text,
            mi.updated_at::text,
            mb.bucket AS blob_bucket,
            mb.object_key AS blob_key,
            mb.mime_type,
            mb.byte_size::text,
            mb.checksum,
            COALESCE(array_agg(DISTINCT ml.label) FILTER (WHERE ml.label IS NOT NULL), ARRAY[]::text[]) AS labels,
            COALESCE(array_agg(DISTINCT mc.name) FILTER (WHERE mc.name IS NOT NULL), ARRAY[]::text[]) AS collections
     FROM media_items mi
     JOIN media_blobs mb
       ON mb.media_item_id = mi.id AND mb.variant = 'original'
     LEFT JOIN media_labels ml
       ON ml.media_item_id = mi.id
     LEFT JOIN media_item_collections mic
       ON mic.media_item_id = mi.id
     LEFT JOIN media_collections mc
       ON mc.id = mic.collection_id
     WHERE mi.owner_user_id = $1
     GROUP BY mi.id, mb.bucket, mb.object_key, mb.mime_type, mb.byte_size, mb.checksum
     ORDER BY mi.created_at DESC, mi.title ASC`,
    [ownerUserId]
  );

  const items: MediaItem[] = [];

  for (const row of rows) {
    const bytes = await getObject(row.blob_bucket, row.blob_key);
    const previewDataUrl = isInlinePreview(row.mime_type) ? toDataUrl(row.mime_type, bytes) : null;
    const sourcePersonName = await getSourcePersonName(row.source_person_id);

    items.push({
      id: row.id,
      ownerUserId: row.owner_user_id,
      kind: row.kind,
      title: row.title,
      seniorLabel: row.senior_label,
      plainDescription: row.plain_description,
      plainSummary: row.plain_summary,
      sourceKind: row.source_kind,
      sourcePersonId: row.source_person_id,
      sourcePersonName,
      receivedAt: row.received_at,
      sensitivity: row.sensitivity,
      lifecycleState: row.lifecycle_state,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      mimeType: row.mime_type,
      byteSize: Number(row.byte_size || 0),
      checksum: row.checksum,
      labels: row.labels || [],
      collections: row.collections || [],
      previewDataUrl,
    });
  }

  return items;
}

async function ensureSeedAssets(ownerUserId: string, sourcePersonId: string | null) {
  if (ownerUserId !== HEIDI_USER_ID) {
    return;
  }

  const { rows } = await getPool().query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM media_items
     WHERE owner_user_id = $1`,
    [ownerUserId]
  );

  if (Number(rows[0]?.count || 0) > 0) {
    return;
  }

  const assetDir = path.join(process.cwd(), "assets");
  const files = await readdir(assetDir);

  for (const fileName of files.sort()) {
    const assetPath = path.join(assetDir, fileName);
    const bytes = await readFile(assetPath);
    const mimeType = detectMimeType(fileName);
    const kind = detectKind(fileName, mimeType);
    const checksum = createChecksum(bytes);
    const itemId = `media_${randomUUID()}`;
    const objectKey = `${ownerUserId}/${itemId}/${fileName}`;
    const assetMeta = DEMO_ASSET_TITLES[fileName] || {
      title: humanizeName(fileName),
      summary: "Ein Beispiel für die Ersteinrichtung.",
      collections: kind === "photo" ? ["Eingangskorb", "Fotoalbum"] : ["Eingangskorb", "Papiermappe"],
      labels: [kind === "photo" ? "Foto" : "Papier", "Beispiel"],
    };

    await putObject(MEDIA_BUCKET, objectKey, bytes, mimeType);
    const client = await getPool().connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO media_items (
           id, owner_user_id, kind, title, senior_label, plain_description,
           plain_summary, source_kind, source_person_id, sensitivity, lifecycle_state
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'import', $8, 'normal', 'arrived')`,
        [
          itemId,
          ownerUserId,
          kind,
          assetMeta.title,
          assetMeta.title,
          assetMeta.summary,
          assetMeta.summary,
          sourcePersonId,
        ]
      );

      await client.query(
        `INSERT INTO media_blobs (id, media_item_id, bucket, object_key, mime_type, byte_size, checksum, variant)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'original')`,
        [`blob_${randomUUID()}`, itemId, MEDIA_BUCKET, objectKey, mimeType, bytes.byteLength, checksum]
      );

      await client.query(
        `INSERT INTO media_text_index (media_item_id, searchable_text, language)
         VALUES ($1, $2, 'de')`,
        [itemId, [assetMeta.title, assetMeta.summary, assetMeta.labels.join(" ")].join(" ")]
      );

      for (const label of assetMeta.labels) {
        await client.query(
          `INSERT INTO media_labels (id, media_item_id, label, label_type, source, confidence)
           VALUES ($1, $2, $3, $4, 'import', 0.9)`,
          [`label_${randomUUID()}`, itemId, label, label === "Foto" || label === "Papier" ? "document_kind" : "topic"]
        );
      }

      for (const collectionName of assetMeta.collections) {
        const { rows: collectionRows } = await client.query<{ id: string }>(
          `SELECT id
           FROM media_collections
           WHERE owner_user_id = $1 AND name = $2
           LIMIT 1`,
          [ownerUserId, collectionName]
        );

        if (!collectionRows[0]) {
          continue;
        }

        await client.query(
          `INSERT INTO media_item_collections (media_item_id, collection_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [itemId, collectionRows[0].id]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

async function getAccessibleOwnerIds(currentUser: CurrentUserRow, requestedOwnerId?: string | null) {
  const owners = await getAccessibleOwners(currentUser);
  const ownerIds = owners.map((owner) => owner.user_id);

  if (requestedOwnerId && ownerIds.includes(requestedOwnerId)) {
    return { owners, selectedOwnerId: requestedOwnerId };
  }

  return { owners, selectedOwnerId: ownerIds[0] || currentUser.user_id };
}

async function buildMediaCollections(ownerUserId: string): Promise<MediaCollection[]> {
  await ensureDefaultCollections(ownerUserId);
  return getCollections(ownerUserId);
}

export async function buildMediaBootstrap(identity: RequestIdentity, requestedOwnerId?: string | null): Promise<MediaBootstrap> {
  const currentUser = await getCurrentUser(identity);
  const { owners, selectedOwnerId } = await getAccessibleOwnerIds(currentUser, requestedOwnerId);
  await buildMediaCollections(selectedOwnerId);
  await ensureSeedAssets(selectedOwnerId, currentUser.role === "caregiver" ? currentUser.user_id : null);

  const collections = await getCollections(selectedOwnerId);
  const items = await getMediaItems(selectedOwnerId);

  return {
    user: {
      id: currentUser.user_id,
      name: currentUser.display_name,
      role: currentUser.role,
      language: currentUser.language,
    },
    owners: owners.map((owner) => ({
      id: owner.user_id,
      name: owner.display_name,
      role: owner.role,
      label: owner.relationship_label,
    })),
    selectedOwnerId,
    collections,
    items,
  };
}

export async function uploadMediaItem(identity: RequestIdentity, formData: FormData) {
  const currentUser = await getCurrentUser(identity);
  const requestedOwnerId = String(formData.get("ownerUserId") || currentUser.user_id);
  const { owners, selectedOwnerId } = await getAccessibleOwnerIds(currentUser, requestedOwnerId);
  if (!owners.some((owner) => owner.user_id === selectedOwnerId)) {
    throw new Error("Der ausgewählte Mensch ist nicht freigegeben.");
  }

  await ensureDefaultCollections(selectedOwnerId);

  const title = String(formData.get("title") || "").trim();
  const summary = String(formData.get("summary") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const labelList = normalizeLabels(String(formData.get("labels") || ""));
  const file = formData.get("file");
  const collectionId = String(formData.get("collectionId") || "").trim();

  if (!(file instanceof File)) {
    throw new Error("Bitte eine Datei auswählen.");
  }

  const fileName = file.name || "datei";
  const mimeType = file.type || detectMimeType(fileName);
  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = detectKind(fileName, mimeType);
  const itemId = `media_${randomUUID()}`;
  const objectKey = `${selectedOwnerId}/${itemId}/${fileName}`;
  const checksum = createChecksum(bytes);

  await putObject(MEDIA_BUCKET, objectKey, bytes, mimeType);

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO media_items (
         id, owner_user_id, kind, title, senior_label, plain_description,
         plain_summary, source_kind, source_person_id, sensitivity, lifecycle_state
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'upload', $8, 'normal', 'arrived')`,
      [
        itemId,
        selectedOwnerId,
        kind,
        title || humanizeName(fileName),
        title || humanizeName(fileName),
        description,
        summary || description || title || humanizeName(fileName),
        currentUser.user_id,
      ]
    );

    await client.query(
      `INSERT INTO media_blobs (id, media_item_id, bucket, object_key, mime_type, byte_size, checksum, variant)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'original')`,
      [`blob_${randomUUID()}`, itemId, MEDIA_BUCKET, objectKey, mimeType, bytes.byteLength, checksum]
    );

    await client.query(
      `INSERT INTO media_text_index (media_item_id, searchable_text, language)
       VALUES ($1, $2, 'de')
       ON CONFLICT (media_item_id) DO UPDATE
       SET searchable_text = EXCLUDED.searchable_text`,
      [itemId, [title, summary, description, labelList.join(" ")].filter(Boolean).join(" ")]
    );

    for (const label of labelList) {
      await client.query(
        `INSERT INTO media_labels (id, media_item_id, label, label_type, source, confidence, confirmed_by_user_id)
         VALUES ($1, $2, $3, $4, 'human', 1, $5)`,
        [`label_${randomUUID()}`, itemId, label, "topic", currentUser.user_id]
      );
    }

    const collectionNames = new Set<string>();
    collectionNames.add("Eingangskorb");
    if (kind === "photo") {
      collectionNames.add("Fotoalbum");
    } else {
      collectionNames.add("Papiermappe");
    }

    if (collectionId) {
      const { rows } = await client.query<{ name: string }>(
        `SELECT name
         FROM media_collections
         WHERE id = $1 AND owner_user_id = $2
         LIMIT 1`,
        [collectionId, selectedOwnerId]
      );

      if (rows[0]?.name) {
        collectionNames.add(rows[0].name);
      }
    }

    for (const name of collectionNames) {
      const { rows } = await client.query<{ id: string }>(
        `SELECT id
         FROM media_collections
         WHERE owner_user_id = $1 AND name = $2
         LIMIT 1`,
        [selectedOwnerId, name]
      );

      if (rows[0]) {
        await client.query(
          `INSERT INTO media_item_collections (media_item_id, collection_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [itemId, rows[0].id]
        );
      }
    }

    await client.query(
      `INSERT INTO media_events (id, media_item_id, actor_user_id, event_type, event_payload)
       VALUES ($1, $2, $3, 'item_uploaded', $4::jsonb)`,
      [
        `event_${randomUUID()}`,
        itemId,
        currentUser.user_id,
        JSON.stringify({
          ownerUserId: selectedOwnerId,
          fileName,
          kind,
          labels: labelList,
        }),
      ]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return {
    itemId,
  };
}

export async function searchMediaItems(identity: RequestIdentity, requestedOwnerId: string | null | undefined, query: string) {
  const bootstrap = await buildMediaBootstrap(identity, requestedOwnerId);
  const needle = normalizeSearchText(query);

  if (!needle) {
    return bootstrap.items;
  }

  const expansion = await expandSearchQuery(query);
  const searchTerms = new Set<string>([
    ...tokenizeSearchText(query),
    ...expansion.keywords.flatMap((value) => tokenizeSearchText(value)),
    ...expansion.phrases.flatMap((value) => tokenizeSearchText(value)),
  ]);

  return bootstrap.items
    .map((item) => ({
      item,
      score: scoreMediaItemForSearch(item, needle, Array.from(searchTerms)),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return Date.parse(right.item.receivedAt) - Date.parse(left.item.receivedAt);
    })
    .map((entry) => entry.item);
}
