import type { McpPromptDefinition } from "../types";

export const coordinateToAddressPrompt: McpPromptDefinition = {
  id: "coordinate-to-address",
  toolName: "coordinate_to_address",
  title: {
    de: "Standort auflösen",
    fr: "Résoudre la position",
  },
  summary: {
    de: "Wandelt Browser-Koordinaten in einen verständlichen Ort oder eine Adresse um.",
    fr: "Transforme les coordonnées du navigateur en lieu ou adresse compréhensible.",
  },
  instructions: {
    de: [
      "Nutze diese Fähigkeit, wenn eine lokale Suche mit Browser-Standort besser mit Ortsname oder Adresse funktioniert.",
      "Nutze sie vor Websuchen nach nahegelegenen Geschäften, Öffnungszeiten, Notfallapotheken, Museen oder Veranstaltungen.",
      "Wenn keine Koordinaten vorhanden sind, frage nach dem Ort.",
    ],
    fr: [
      "Utilise cette capacité quand une recherche locale avec position navigateur fonctionne mieux avec un nom de lieu ou une adresse.",
      "Utilise-la avant les recherches web de magasins proches, horaires, pharmacies de garde, musées ou événements.",
      "S'il n'y a pas de coordonnées, demande le lieu.",
    ],
  },
  examples: {
    de: [
      "Welche Migros hat in der Nähe offen? -> erst Standort auflösen",
      "Wo ist die nächste Notfallapotheke? -> erst Standort auflösen",
    ],
    fr: [
      "Quelle Migros est ouverte près d'ici ? -> résoudre d'abord la position",
      "Où est la pharmacie de garde la plus proche ? -> résoudre d'abord la position",
    ],
  },
  responseInstructions: {
    de: [
      "Nutze den aufgelösten Ort nur als Hilfe für die nächste Suche.",
      "Antworte nicht ausführlich nur mit der Adresse, wenn danach noch eine Websuche nötig ist.",
    ],
    fr: [
      "Utilise le lieu résolu seulement comme aide pour la recherche suivante.",
      "Ne réponds pas longuement seulement avec l'adresse si une recherche web est encore nécessaire.",
    ],
  },
  replyMode: "synthesized",
};
