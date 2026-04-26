"use server";

import { loadAudioCatalog } from "../../lib/audio/catalog";

export async function loadAudioAction() {
  return loadAudioCatalog();
}
