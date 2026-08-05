import { Client } from "pg";

import { preflight } from "@/lib/api-route";
import { corsHeaders } from "@/lib/cors";
import { getPool } from "@/lib/db";
import { readSessionIdentity } from "@/lib/request-auth";

// GET /api/ext/stream (SSE, token-gated). Holds a connection open and pushes
// chat events as they happen, replacing the 2.5-3s client polling. Each stream
// owns a dedicated pg Client running LISTEN chat_events — the shared pool cannot
// be used for LISTEN, which pins a single long-lived connection.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = preflight;

type ChatEvent =
  | { scope: "private"; id: string; senderId: string; recipientId: string; text: string; timestamp: string }
  | { scope: "table"; id: string; topicId: string; senderId: string; text: string; timestamp: string }
  | { scope: "call"; room: string; from: string; to: string; url: string };

export async function GET(req: Request): Promise<Response> {
  const cors = corsHeaders(req.headers.get("origin"));

  const identity = readSessionIdentity(req.headers);
  if (!identity) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }
  const uid = identity.userId;

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  async function shouldDeliver(event: ChatEvent): Promise<boolean> {
    if (event.scope === "private") {
      return event.senderId === uid || event.recipientId === uid;
    }
    if (event.scope === "call") {
      return event.to === uid;
    }
    // table: deliver only to members of the topic
    const { rows } = await getPool().query(
      `SELECT 1 FROM table_chat_presence WHERE user_id = $1 AND topic_id = $2 LIMIT 1`,
      [uid, event.topicId],
    );
    return rows.length > 0;
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* controller already closed */
        }
      };
      const send = (event: string, data: unknown) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        client.removeAllListeners();
        client.end().catch(() => {});
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      client.on("notification", (msg) => {
        if (!msg.payload) return;
        let event: ChatEvent;
        try {
          event = JSON.parse(msg.payload) as ChatEvent;
        } catch {
          return;
        }
        void shouldDeliver(event)
          .then((ok) => {
            if (ok) send("message", event);
          })
          .catch(() => {});
      });
      client.on("error", cleanup);
      req.signal.addEventListener("abort", cleanup);

      try {
        await client.connect();
        await client.query("LISTEN chat_events");
      } catch {
        cleanup();
        return;
      }

      send("ready", { userId: uid });
      heartbeat = setInterval(() => write(`: ping\n\n`), 25000);
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      client.removeAllListeners();
      client.end().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      ...cors,
    },
  });
}
