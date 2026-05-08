import type { McpLanguage, McpPromptDefinition } from "./types";

export function buildPromptCatalog(prompts: ReadonlyArray<McpPromptDefinition>, language: McpLanguage): string {
  const lines = prompts.map((prompt) => {
    const instructions = prompt.instructions[language].map((line) => `- ${line}`).join("\n");
    return [`${prompt.title[language]} (${prompt.toolName})`, prompt.summary[language], instructions].join("\n");
  });

  return [language === "fr" ? "Capacités disponibles :" : "Verfügbare Fähigkeiten:", ...lines].join("\n");
}
