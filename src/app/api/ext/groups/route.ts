import { preflight, withIdentity } from "@/lib/api-route";
import { buildTableChatBootstrap } from "@/lib/table-chat";

// GET /api/ext/groups[?topic=<id>] -> table-chat bootstrap (topics, people,
// messages for the selected/current topic).
export const runtime = "nodejs";

export const OPTIONS = preflight;

export async function GET(req: Request): Promise<Response> {
  return withIdentity(req, (identity, r) => {
    const topicId = new URL(r.url).searchParams.get("topic");
    return buildTableChatBootstrap(identity, topicId);
  });
}
