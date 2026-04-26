export const PROFILE_FIELDS = [
  { key: "vorname", label: "Vorname" },
  { key: "nachname", label: "Nachname" },
  { key: "geburtsdatum", label: "Geburtsdatum" },
  { key: "blutgruppe", label: "Blutgruppe" },
  { key: "krankenkasse", label: "Krankenkasse" },
  { key: "kv_nummer", label: "Versichertennummer" },
  { key: "allergien", label: "Allergien / Unverträglichkeiten" },
  { key: "medikamente", label: "Wichtige Medikamente" },
  { key: "hausarzt", label: "Hausarzt / Hausärztin" },
  { key: "notfallkontakt", label: "Notfallkontakt (Person + Telefon)" },
] as const;

export type ProfileKey = (typeof PROFILE_FIELDS)[number]["key"];
export type ProfileData = Record<ProfileKey, string>;

export function createEmptyProfile(): ProfileData {
  return Object.fromEntries(PROFILE_FIELDS.map((field) => [field.key, ""])) as ProfileData;
}

export function normalizeProfile(input: unknown): ProfileData {
  const normalized = createEmptyProfile();

  if (!input || typeof input !== "object") {
    return normalized;
  }

  for (const field of PROFILE_FIELDS) {
    const value = (input as Record<string, unknown>)[field.key];
    normalized[field.key] = typeof value === "string" ? value.trim() : "";
  }

  return normalized;
}

export function isProfileEmpty(profile: ProfileData): boolean {
  return PROFILE_FIELDS.every((field) => !profile[field.key]);
}
