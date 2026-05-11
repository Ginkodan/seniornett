import type { McpPromptDefinition } from "../types";

export const nearbyPlacePrompt: McpPromptDefinition = {
  id: "nearby-place",
  toolName: "nearby_place",
  title: {
    de: "Ortsuche in der Nähe",
    fr: "Recherche de lieux à proximité",
  },
  summary: {
    de: "Findet anhand der Browser-Position den passendsten Ort in der Nähe, bevor eine Websuche die Details prüft.",
    fr: "Trouve le lieu le plus pertinent à proximité à partir de la position du navigateur, avant qu'une recherche web vérifie les détails.",
  },
  instructions: {
    de: [
      "Nutze diese Fähigkeit, wenn jemand nach dem nächsten oder nächstgelegenen Geschäft, der nächstgelegenen Apotheke, Bäckerei, Migros oder einem ähnlichen Ort fragt.",
      "Wähle den passendsten Ort anhand der aktuellen Browser-Position.",
      "Erfinde keine Öffnungszeiten, Adressen oder Distanzen.",
      "Gib nur einen klaren Ortsnamen und eine kurze Begründung zurück.",
    ],
    fr: [
      "Utilise cette capacité quand quelqu'un demande le magasin, la pharmacie, la boulangerie, la Migros ou un lieu similaire le plus proche.",
      "Choisis le lieu le plus pertinent à partir de la position actuelle du navigateur.",
      "N'invente pas d'horaires, d'adresses ou de distances.",
      "Retourne seulement un nom de lieu clair et une courte justification.",
    ],
  },
  examples: {
    de: [
      "Welche Migros ist gerade am nächsten zu mir?",
      "Wo ist die nächste Apotheke in meiner Nähe?",
      "Welche Bäckerei ist in Spiez am nächsten offen?",
    ],
    fr: [
      "Quelle Migros est la plus proche de moi ?",
      "Où est la pharmacie la plus proche ?",
      "Quelle boulangerie ouverte est la plus proche à Spiez ?",
    ],
  },
  responseInstructions: {
    de: [
      "Antworte kurz und konkret.",
      "Nenne den Ortsnamen, die Adresse wenn vorhanden, und die grobe Distanz wenn berechnet.",
      "Wenn kein guter Treffer gefunden wurde, bitte um eine präzisere Suche.",
    ],
    fr: [
      "Réponds brièvement et concrètement.",
      "Indique le nom du lieu, l'adresse si disponible, et la distance approximative si calculée.",
      "Si aucun bon résultat n'est trouvé, demande une recherche plus précise.",
    ],
  },
  replyMode: "synthesized",
};

export function isNearbyPlaceLookupMessage(message: string): boolean {
  return /\b(in\s+der\s+nähe|in\s+der\s+naehe|nahe|nächst(?:e|en|er|em|es)?|naechst(?:e|en|er|em|es)?|nächstgeleg(?:ene|enen|ener|enem|enes)?|naechstgeleg(?:ene|enen|ener|enem|enes)?|bei\s+mir|hier|nearby|closest|near\s+me|proche|près\s+d'ici|autour\s+de\s+moi)\b/i.test(message);
}

export function shouldUseNearbyPlaceTool(message: string): boolean {
  if (!isNearbyPlaceLookupMessage(message)) return false;
  return /\b(migros|coop|aldi|landi|spar|apotheke|pharmacie|bäckerei|baeckerei|museum|theater|oper|restaurant|supermarkt|laden|geschäft|geschaeft|shop)\b/i.test(message);
}
