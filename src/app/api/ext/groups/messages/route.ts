import { preflight, readJson, requireString, withIdentity } from "@/lib/api-route";
import { sendTableChatMessage } from "@/lib/table-chat";

// POST /api/ext/groups/messages { topicId, text } -> the created group message.
export const runtime = "nodejs";

export const OPTIONS = preflight;

export async function POST(req: Request): Promise<Response> {
  return withIdentity(req, async (identity, r) => {
    const body = await readJson(r);
    const topicId = requireString(body, "topicId");
    const text = requireString(body, "text");
    return sendTableChatMessage(identity, topicId, text);
  });
}
