import de from "@/locales/de.json";
import fr from "@/locales/fr.json";

export const SUPPORTED_LANGUAGES = ["de", "fr"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const LOCALE_TAGS: Record<Language, string> = {
  de: "de-CH",
  fr: "fr-CH",
};

const DICTIONARIES = {
  de,
  fr,
} as const;

type TranslationDict = typeof de;

function isSupportedLanguage(value: string | null | undefined): value is Language {
  return value === "de" || value === "fr";
}

export function normalizeLanguage(value: string | null | undefined): Language {
  if (!value) {
    return "de";
  }

  const lower = value.trim().toLowerCase();
  if (lower.startsWith("fr")) return "fr";
  if (lower.startsWith("de")) return "de";
  return isSupportedLanguage(lower) ? lower : "de";
}

export function getLocaleTag(language: string | null | undefined): string {
  return LOCALE_TAGS[normalizeLanguage(language)];
}

function getPathValue(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, source);
}

function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = values[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

export function createTranslator(language: string | null | undefined) {
  const locale = normalizeLanguage(language);
  const dictionary = DICTIONARIES[locale] as TranslationDict;

  return (path: string, values?: Record<string, string | number>) => {
    const translated = getPathValue(dictionary, path);

    if (typeof translated !== "string") {
      return path;
    }

    return interpolate(translated, values);
  };
}

export function getDictionary(language: string | null | undefined) {
  return DICTIONARIES[normalizeLanguage(language)];
}
