import { preflight, withIdentity } from "@/lib/api-route";
import { buildChatBootstrap } from "@/lib/chat-core";

// GET /api/ext/conversations -> { user, contacts[] } where each contact carries
// its full message history. One call gives the standalone app every 1:1 thread.
export const runtime = "nodejs";

export const OPTIONS = preflight;

export async function GET(req: Request): Promise<Response> {
  return withIdentity(req, (identity) => buildChatBootstrap(identity));
}
