import { randomUUID } from "crypto";

import { ensureChatRelationship } from "@/lib/chat-core";
import { getPool } from "@/lib/db";
import { buildMediaBootstrap } from "@/lib/media";
import { getObject } from "@/lib/object-storage";
import type { RequestIdentity } from "@/lib/request-auth";

type CurrentUserRow = {
  user_id: string;
  display_name: string;
  role: string;
  language: string;
};

type ListingRow = {
  id: string;
  owner_user_id: string;
  title: string;
  description: string;
  category: string;
  condition_label: string;
  pickup_area: string;
  status: string;
  created_at: string;
  owner_name: string;
  owner_role: string;
};

type ListingImageRow = {
  listing_id: string;
  mime_type: string;
  bucket: string;
  object_key: string;
};

export type MarketplacePhotoChoice = {
  mediaItemId: string;
  title: string;
  previewDataUrl: string;
};

export type MarketplaceListing = {
  id: string;
  ownerUserId: string;
  ownerName: string;
  ownerRole: string;
  title: string;
  description: string;
  category: string;
  conditionLabel: string;
  pickupArea: string;
  createdAt: string;
  isOwn: boolean;
  imagePreviews: string[];
};

export type MarketplaceBootstrap = {
  user: {
    id: string;
    name: string;
    role: string;
    language: string;
  };
  categories: string[];
  listings: MarketplaceListing[];
  photoChoices: MarketplacePhotoChoice[];
};

export type CreateMarketplaceListingInput = {
  title: string;
  description: string;
  category: string;
  conditionLabel: string;
  pickupArea: string;
  selectedPhotoIds: string[];
};

export type MarketplaceConversationTarget = {
  contactUserId: string;
  area: "care" | "friends";
};

const MARKETPLACE_CATEGORIES = ["Haushalt", "Bücher", "Küche", "Deko", "Freizeit", "Pflanzen"] as const;

const MARKETPLACE_SEED_LISTINGS = [
  {
    ownerUserId: "user-neighbor-001",
    title: "Leselampe für den Sessel",
    description: "Die Lampe funktioniert gut und gibt warmes Licht. Ich gebe sie gern weiter.",
    category: "Haushalt",
    conditionLabel: "Gut erhalten",
    pickupArea: "Basel",
  },
  {
    ownerUserId: "user-neighbor-002",
    title: "Drei Blumentöpfe",
    description: "Leichte Töpfe für Balkon oder Fenster. Sie sind sauber und sofort bereit.",
    category: "Pflanzen",
    conditionLabel: "Bereit zum Mitnehmen",
    pickupArea: "Lausanne",
  },
  {
    ownerUserId: "user-grandpa-001",
    title: "Reiseführer und Karten",
    description: "Ein kleines Bündel mit Reiseführern aus der Schweiz und von Italien.",
    category: "Bücher",
    conditionLabel: "Leicht gebraucht",
    pickupArea: "Luzern",
  },
] as const;

function toDataUrl(mimeType: string, bytes: Buffer) {
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

async function getCurrentUser(userId: string): Promise<CurrentUserRow> {
  const { rows } = await getPool().query<CurrentUserRow>(
    `SELECT user_id, display_name, role, language
     FROM users
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );

  if (!rows[0]) {
    throw new Error("Benutzerprofil wurde nicht gefunden.");
  }

  return rows[0];
}

export async function ensureMarketplaceSchema(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketplace_listings (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      condition_label TEXT NOT NULL,
      pickup_area TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketplace_listing_images (
      listing_id TEXT NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
      media_item_id TEXT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (listing_id, media_item_id)
    )
  `);
}

async function ensureMarketplaceSeed(): Promise<void> {
  const { rows } = await getPool().query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM marketplace_listings`
  );

  if (Number(rows[0]?.count || "0") > 0) {
    return;
  }

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    for (const listing of MARKETPLACE_SEED_LISTINGS) {
      await client.query(
        `INSERT INTO marketplace_listings (
           id, owner_user_id, title, description, category, condition_label, pickup_area, status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')`,
        [
          `listing_${randomUUID()}`,
          listing.ownerUserId,
          listing.title,
          listing.description,
          listing.category,
          listing.conditionLabel,
          listing.pickupArea,
        ]
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

async function getListingImageMap(listingIds: string[]) {
  if (!listingIds.length) {
    return new Map<string, string[]>();
  }

  const { rows } = await getPool().query<ListingImageRow>(
    `SELECT li.listing_id, mb.mime_type, mb.bucket, mb.object_key
     FROM marketplace_listing_images li
     JOIN media_blobs mb
       ON mb.media_item_id = li.media_item_id AND mb.variant = 'original'
     WHERE li.listing_id = ANY($1::text[])
     ORDER BY li.listing_id ASC, li.sort_order ASC`,
    [listingIds]
  );

  const imageMap = new Map<string, string[]>();

  for (const row of rows) {
    const bytes = await getObject(row.bucket, row.object_key);
    const current = imageMap.get(row.listing_id) || [];
    current.push(toDataUrl(row.mime_type, bytes));
    imageMap.set(row.listing_id, current);
  }

  return imageMap;
}

async function getListings(currentUserId: string): Promise<MarketplaceListing[]> {
  const { rows } = await getPool().query<ListingRow>(
    `SELECT ml.id,
            ml.owner_user_id,
            ml.title,
            ml.description,
            ml.category,
            ml.condition_label,
            ml.pickup_area,
            ml.status,
            ml.created_at::text,
            u.display_name AS owner_name,
            u.role AS owner_role
     FROM marketplace_listings ml
     JOIN users u ON u.user_id = ml.owner_user_id
     WHERE ml.status = 'active'
     ORDER BY ml.created_at DESC, ml.title ASC`
  );

  const imageMap = await getListingImageMap(rows.map((row) => row.id));

  return rows.map((row) => ({
    id: row.id,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name,
    ownerRole: row.owner_role,
    title: row.title,
    description: row.description,
    category: row.category,
    conditionLabel: row.condition_label,
    pickupArea: row.pickup_area,
    createdAt: row.created_at,
    isOwn: row.owner_user_id === currentUserId,
    imagePreviews: imageMap.get(row.id) || [],
  }));
}

async function getPhotoChoices(identity: RequestIdentity, currentUser: CurrentUserRow): Promise<MarketplacePhotoChoice[]> {
  const media = await buildMediaBootstrap(identity, currentUser.user_id);

  return media.items
    .filter((item) => item.kind === "photo" && item.previewDataUrl)
    .slice(0, 12)
    .map((item) => ({
      mediaItemId: item.id,
      title: item.title,
      previewDataUrl: item.previewDataUrl || "",
    }));
}

export async function buildMarketplaceBootstrap(identity: RequestIdentity): Promise<MarketplaceBootstrap> {
  await ensureMarketplaceSchema();
  await ensureMarketplaceSeed();

  const currentUser = await getCurrentUser(identity.userId);
  const [listings, photoChoices] = await Promise.all([
    getListings(currentUser.user_id),
    getPhotoChoices(identity, currentUser),
  ]);

  return {
    user: {
      id: currentUser.user_id,
      name: currentUser.display_name,
      role: currentUser.role,
      language: currentUser.language,
    },
    categories: ["Alle", ...MARKETPLACE_CATEGORIES],
    listings,
    photoChoices,
  };
}

export async function createMarketplaceListing(
  identity: RequestIdentity,
  input: CreateMarketplaceListingInput
): Promise<MarketplaceBootstrap> {
  await ensureMarketplaceSchema();

  const currentUser = await getCurrentUser(identity.userId);
  const title = input.title.trim();
  const description = input.description.trim();
  const category = input.category.trim();
  const conditionLabel = input.conditionLabel.trim();
  const pickupArea = input.pickupArea.trim();

  if (!title) {
    throw new Error("Bitte geben Sie einen Titel ein.");
  }

  if (!description) {
    throw new Error("Bitte beschreiben Sie den Gegenstand kurz.");
  }

  if (!category) {
    throw new Error("Bitte wählen Sie eine Kategorie.");
  }

  if (!conditionLabel) {
    throw new Error("Bitte sagen Sie kurz, in welchem Zustand der Gegenstand ist.");
  }

  if (!pickupArea) {
    throw new Error("Bitte geben Sie den Ort für die Abholung an.");
  }

  const selectedPhotoIds = Array.from(new Set(input.selectedPhotoIds)).slice(0, 3);
  let validPhotoIds: string[] = [];

  if (selectedPhotoIds.length) {
    const { rows } = await getPool().query<{ id: string }>(
      `SELECT mi.id
       FROM media_items mi
       WHERE mi.owner_user_id = $1
         AND mi.kind = 'photo'
         AND mi.id = ANY($2::text[])`,
      [currentUser.user_id, selectedPhotoIds]
    );

    const validIds = new Set(rows.map((row) => row.id));
    validPhotoIds = selectedPhotoIds.filter((photoId) => validIds.has(photoId));
  }

  const listingId = `listing_${randomUUID()}`;
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO marketplace_listings (
         id, owner_user_id, title, description, category, condition_label, pickup_area, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')`,
      [listingId, currentUser.user_id, title, description, category, conditionLabel, pickupArea]
    );

    for (const [index, mediaItemId] of validPhotoIds.entries()) {
      await client.query(
        `INSERT INTO marketplace_listing_images (listing_id, media_item_id, sort_order)
         VALUES ($1, $2, $3)`,
        [listingId, mediaItemId, index]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return buildMarketplaceBootstrap(identity);
}

export async function startMarketplaceConversation(
  identity: RequestIdentity,
  listingId: string
): Promise<MarketplaceConversationTarget> {
  await ensureMarketplaceSchema();

  const currentUser = await getCurrentUser(identity.userId);
  const { rows } = await getPool().query<{ owner_user_id: string; owner_role: string }>(
    `SELECT ml.owner_user_id, u.role AS owner_role
     FROM marketplace_listings ml
     JOIN users u ON u.user_id = ml.owner_user_id
     WHERE ml.id = $1
       AND ml.status = 'active'
     LIMIT 1`,
    [listingId]
  );

  if (!rows[0]) {
    throw new Error("Dieses Inserat ist nicht mehr verfügbar.");
  }

  const sellerUserId = rows[0].owner_user_id;

  if (sellerUserId === currentUser.user_id) {
    throw new Error("Das ist Ihr eigenes Inserat.");
  }

  await ensureChatRelationship(currentUser.user_id, sellerUserId, "Kontakt");
  await ensureChatRelationship(sellerUserId, currentUser.user_id, "Interessent");

  return {
    contactUserId: sellerUserId,
    area: rows[0].owner_role === "caregiver" ? "care" : "friends",
  };
}

export async function deleteMarketplaceListing(identity: RequestIdentity, listingId: string): Promise<MarketplaceBootstrap> {
  await ensureMarketplaceSchema();

  const currentUser = await getCurrentUser(identity.userId);
  const { rows } = await getPool().query<{ owner_user_id: string }>(
    `SELECT owner_user_id
     FROM marketplace_listings
     WHERE id = $1
       AND status = 'active'
     LIMIT 1`,
    [listingId]
  );

  if (!rows[0]) {
    throw new Error("Dieses Inserat wurde bereits entfernt.");
  }

  if (rows[0].owner_user_id !== currentUser.user_id) {
    throw new Error("Nur eigene Inserate können entfernt werden.");
  }

  await getPool().query(
    `UPDATE marketplace_listings
     SET status = 'deleted'
     WHERE id = $1`,
    [listingId]
  );

  return buildMarketplaceBootstrap(identity);
}
