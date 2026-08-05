import { ApiError, preflight, readJson, requireString, withIdentity } from "@/lib/api-route";
import { isAllowedContact } from "@/lib/chat-core";
import { getPool } from "@/lib/db";
import { directCallRoom, mintLiveKitToken } from "@/lib/livekit";

// POST /api/ext/calls/token { with } -> { token, url, room }
// Mints a LiveKit token for a 1:1 call with an allowed contact, and pushes an
// incoming-call invite to the callee over the SSE channel (scope: "call").
export const runtime = "nodejs";

export const OPTIONS = preflight;

export async function POST(req: Request): Promise<Response> {
  return withIdentity(req, async (identity, r) => {
    const body = await readJson(r);
    const withUser = requireString(body, "with");

    if (!(await isAllowedContact(identity.userId, withUser))) {
      throw new ApiError("Diese Person ist nicht für Anrufe freigegeben.", 403);
    }

    const room = directCallRoom(identity.userId, withUser);
    const { token, url } = mintLiveKitToken({ identity: identity.userId, name: identity.userId, room });

    // Ring the callee on their live stream. They mint their own token to join.
    await getPool().query("SELECT pg_notify('chat_events', $1)", [
      JSON.stringify({ scope: "call", room, from: identity.userId, to: withUser, url }),
    ]);

    return { token, url, room };
  });
}
