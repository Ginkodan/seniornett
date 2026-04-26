"use server";

import { headers } from "next/headers";

import { getPool } from "@/lib/db";
import { createEmptyProfile, normalizeProfile, type ProfileData } from "@/lib/profile";

async function getRequiredUserId(): Promise<string> {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("x-user-id")?.trim();

  if (!userId) {
    throw new Error("Kein Benutzer erkannt. Die Anfrage enthält keinen X-User-Id-Header.");
  }

  return userId;
}

export async function getProfileAction(): Promise<ProfileData> {
  const userId = await getRequiredUserId();
  const { rows } = await getPool().query<{ profile: unknown }>(
    "SELECT profile FROM users WHERE user_id = $1 LIMIT 1",
    [userId]
  );

  if (!rows[0]) {
    throw new Error("Benutzerprofil wurde in der Datenbank nicht gefunden.");
  }

  return normalizeProfile(rows[0].profile);
}

export async function saveProfileAction(profile: ProfileData): Promise<ProfileData> {
  const userId = await getRequiredUserId();
  const normalizedProfile = normalizeProfile(profile);
  const { rows } = await getPool().query<{ profile: unknown }>(
    `UPDATE users
     SET profile = $2::jsonb,
         updated_at = NOW()
     WHERE user_id = $1
     RETURNING profile`,
    [userId, JSON.stringify(normalizedProfile)]
  );

  if (!rows[0]) {
    throw new Error("Benutzerprofil konnte nicht gespeichert werden.");
  }

  return normalizeProfile(rows[0].profile ?? createEmptyProfile());
}
