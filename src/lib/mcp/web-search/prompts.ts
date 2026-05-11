import type { McpPromptDefinition } from "../types";

export const webSearchPrompt: McpPromptDefinition = {
  id: "web-search",
  toolName: "web_search",
  title: {
    de: "Websuche",
    fr: "Recherche web",
  },
  summary: {
    de: "Sucht aktuelle Informationen im Web, crawlt Treffer mit Playwright und fasst nützliche Quellen zusammen.",
    fr: "Cherche des informations actuelles sur le web, explore les résultats avec Playwright et résume les sources utiles.",
  },
  instructions: {
    de: [
      "Nutze diese Fähigkeit für aktuelle, lokale oder schwer vorhersagbare Informationen.",
      "Geeignet für Öffnungszeiten, nahegelegene Geschäfte, Notfallapotheken, Museen, Theater, Konzerte, Entsorgungs- und Abfuhrdaten, Produkte und allgemeine Web-Informationen.",
      "Bei lokalen Suchen mit Browser-Koordinaten soll vorher coordinate_to_address genutzt werden.",
      "Bei 'nächste' oder 'in der Nähe'-Suchen nach einem konkreten Ort zuerst nearby_place nutzen, damit die genaue Filiale oder der genaue Ort bestimmt wird.",
      "Erfinde keine Öffnungszeiten, Adressen, Preise oder Telefonnummern.",
      "Bei unsicheren Ergebnissen klar sagen, dass die Information geprüft werden sollte.",
    ],
    fr: [
      "Utilise cette capacité pour des informations actuelles, locales ou difficiles à prévoir.",
      "Convient aux horaires, commerces proches, pharmacies de garde, musées, théâtres, concerts, calendriers de collecte/déchets, produits et informations générales.",
      "Pour les recherches locales avec coordonnées navigateur, utilise d'abord coordinate_to_address.",
      "Pour les recherches de type 'le plus proche' ou 'près de moi', utilise d'abord nearby_place afin d'identifier le lieu exact.",
      "N'invente pas d'horaires, d'adresses, de prix ou de numéros de téléphone.",
      "Si les résultats sont incertains, dis clairement que l'information doit être vérifiée.",
    ],
  },
  examples: {
    de: [
      "Wann hat die Migros in der Nähe offen?",
      "Wo ist die nächste Notfallapotheke?",
      "Wo findet das Konzert heute Abend statt?",
      "Wo bekomme ich Batterien für ein Hörgerät?",
      "Was bedeutet Phishing einfach erklärt?",
    ],
    fr: [
      "Quand la Migros près d'ici est-elle ouverte ?",
      "Où est la pharmacie de garde la plus proche ?",
      "Où a lieu le concert ce soir ?",
      "Où acheter des piles pour appareil auditif ?",
      "Explique simplement le phishing.",
    ],
  },
  responseInstructions: {
    de: [
      "Antworte ruhig, kurz und praktisch.",
      "Nenne Quellen als Namen oder Domains in Textform, aber keine klickbaren Links.",
      "Bei lokalen Treffern: Name, Adresse, Öffnungszeiten und Telefonnummer nennen, wenn gefunden.",
      "Bei Notfallapotheken immer empfehlen, vor dem Losgehen kurz anzurufen, wenn eine Telefonnummer gefunden wurde.",
      "Unterscheide klar zwischen gefundenen Fakten und Vermutung.",
    ],
    fr: [
      "Réponds calmement, brièvement et de manière pratique.",
      "Mentionne les sources comme noms ou domaines en texte, mais pas de liens cliquables.",
      "Pour les résultats locaux : nom, adresse, horaires et téléphone si trouvés.",
      "Pour les pharmacies de garde, recommande toujours d'appeler avant de partir si un numéro est trouvé.",
      "Sépare clairement les faits trouvés des suppositions.",
    ],
  },
  replyMode: "synthesized",
};

export function isLocalWebSearchMessage(message: string): boolean {
  return [
    /\b(in\s+der\s+nähe|in\s+der\s+naehe|nahe|nächste|naechste|nächstgelegene|naechstgelegene|bei\s+mir|hier|nearby|closest|near\s+me)\b/i,
    /\b(près|proche|autour\s+de\s+moi|la\s+plus\s+proche|près\s+d'ici)\b/i,
    /\b(apotheke|notfallapotheke|bäckerei|baeckerei|museum|theater|oper|konzert|laden|geschäft|geschaeft|supermarkt|markt|restaurant|shop|toilette|wc)\b/i,
    /\b(pharmacie|pharmacie\s+de\s+garde|boulangerie|musée|théâtre|opéra|concert|magasin)\b/i,
  ].some((pattern) => pattern.test(message));
}

export function shouldUseWebSearchTool(message: string): boolean {
  return [
    /\b(öffnungszeit|oeffnungszeit|offen|geöffnet|geoeffnet|laden|geschäft|geschaeft|supermarkt|markt|shop|apotheke|notfallapotheke|bäckerei|baeckerei|museum|theater|oper|opernhaus|konzert|konzerte|veranstaltung|veranstaltungen|event|events|programm|spielplan|agenda|termine|\w*abfuhr(?:daten)?|entsorgung|entsorge|entsorgen|kehricht|abfall|sammlung|papiersammlung|papier|karton|toilette|wc|wo bekomme ich|wo finde ich|wo kann ich|kaufen|in der nähe|in der naehe|nahe|nächste|naechste)\b/i,
    /\b(horaire|ouvert|ouverte|magasin|pharmacie|pharmacie de garde|boulangerie|musée|théâtre|opéra|concert|événement|collecte|déchets|dechets|ordures|près|proche|où trouver)\b/i,
    /\b(preis|kostet|kosten|produkt|vergleich|vergleiche|empfehlenswert|empfehlung|test|informationen|infos|suche|web|internet|quelle|aktuell|aktueller stand|erkläre|erklaere|was ist|unterschied|rechte|warnzeichen|telefonbetrug|e-id|grippeimpfung|flugverspätung|flugverspaetung|twint|stromausfall|notfallplan|patientenverfügung|patientenverfuegung|ahv-rente|ahv rente)\b/i,
  ].some((pattern) => pattern.test(message));
}
