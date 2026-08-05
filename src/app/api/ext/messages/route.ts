import { preflight, readJson, requireString, withIdentity } from "@/lib/api-route";
import { sendChatMessage } from "@/lib/chat-core";

// POST /api/ext/messages { to, text } -> the created message.
// Reuses sendChatMessage, which enforces the chat_relationships allow-list.
export const runtime = "nodejs";

export const OPTIONS = preflight;

export async function POST(req: Request): Promise<Response> {
  return withIdentity(req, async (identity, r) => {
    const body = await readJson(r);
    const to = requireString(body, "to");
    const text = requireString(body, "text");
    return sendChatMessage(identity, to, text);
  });
}
