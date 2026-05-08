import type { McpLanguage, McpPromptDefinition } from "./types";

export function buildPromptCatalog(prompts: ReadonlyArray<McpPromptDefinition>, language: McpLanguage): string {
  const lines = prompts.map((prompt) => {
    const instructions = prompt.instructions[language].map((line) => `- ${line}`).join("\n");
    const examples = prompt.examples?.[language]?.length
      ? ["Beispiele:", ...prompt.examples[language].map((line) => `- ${line}`)].join("\n")
      : "";

    return [`${prompt.title[language]} (${prompt.toolName})`, prompt.summary[language], instructions, examples].filter(Boolean).join("\n");
  });

  return [language === "fr" ? "Capacités disponibles :" : "Verfügbare Fähigkeiten:", ...lines].join("\n");
}

export function buildPlannerPromptCatalog(prompts: ReadonlyArray<McpPromptDefinition>, language: McpLanguage): string {
  const lines = prompts.map((prompt) => {
    const examples = prompt.examples?.[language]?.length
      ? prompt.examples[language].map((line) => `- ${line} -> ${prompt.toolName}`).join("\n")
      : "";

    return [
      `${prompt.title[language]} (${prompt.toolName})`,
      prompt.summary[language],
      examples ? ["Beispiele:", examples].join("\n") : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [
    language === "fr" ? "Guide de sélection des outils MCP :" : "Auswahlhilfe für MCP-Werkzeuge:",
    language === "fr"
      ? "Choisis exactement un outil ou 'none' selon l'intention, le contexte et les exemples."
      : "Wähle genau ein Werkzeug oder 'none' anhand von Absicht, Verlauf und Beispielen.",
    ...lines,
  ].join("\n\n");
}
