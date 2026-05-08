import { dateTimeCapability } from "./date-time";
import { weatherCapability, type LottiCapability, type LottiCapabilityLanguage } from "./weather";

export const LOTTI_CAPABILITIES: LottiCapability[] = [weatherCapability, dateTimeCapability];

export function buildLottiCapabilityPrompt(language: LottiCapabilityLanguage): string {
  const lines = LOTTI_CAPABILITIES.map((capability) => {
    const instructions = capability.instructions[language].map((line) => `- ${line}`).join("\n");
    return [
      `${capability.title[language]} (${capability.toolName})`,
      capability.summary[language],
      instructions,
    ].join("\n");
  });

  return [
    language === "fr" ? "Capacités disponibles :" : "Verfügbare Fähigkeiten:",
    ...lines,
  ].join("\n");
}

export { buildDateTimeAnswer, extractRelativeDayOffset, shouldUseDateTimeCapability } from "./date-time";
export { buildWeatherAnswer, extractWeatherDayIndex, extractWeatherLocation, shouldUseWeatherCapability } from "./weather";
export type { LottiCapability, LottiCapabilityLanguage };
