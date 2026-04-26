export const BOOK_FILTER_ALL = "all";

export const AUDIOBOOK_GENRES = [
  { id: BOOK_FILTER_ALL, label: "Alle" },
  { id: "romane", label: "Romane" },
  { id: "hoerspiele", label: "Hörspiele" },
  { id: "kurztexte", label: "Kurztexte" },
  { id: "spannung", label: "Spannung" },
  { id: "kinder", label: "Kinder" },
] as const;

export const AUDIOBOOK_GENRE_DESCRIPTIONS: Record<string, string> = {
  [BOOK_FILTER_ALL]: "Gemischte Auswahl zum direkten Abspielen.",
  romane: "Längere Erzählungen und klassische Stoffe aus verschiedenen Katalogen.",
  hoerspiele: "Inszenierte Geschichten mit Rollen, Stimmen und Atmosphäre.",
  kurztexte: "Kürzere Texte, Gedichte und kompakte Lesungen.",
  spannung: "Krimis, dramatische Geschichten und dichte Handlung.",
  kinder: "Ruhige und zugängliche Titel für Familien und jüngere Zuhörende.",
};
