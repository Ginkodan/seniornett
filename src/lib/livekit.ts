import { createHmac } from "node:crypto";

// LiveKit access tokens are HS256 JWTs signed with the project API secret and
// carrying a "video" grant. We mint them with node crypto (same approach as
// auth-token.ts) to avoid pulling in livekit-server-sdk for one small function.
// Token format reference: https://docs.livekit.io/home/get-started/authentication/

function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

export function liveKitConfig(): { apiKey: string; apiSecret: string; url: string } {
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  // Public ws URL the browser connects to (e.g. ws://localhost:7880 in dev).
  const url = (process.env.LIVEKIT_WS_URL || process.env.LIVEKIT_URL)?.trim();
  if (!apiKey || !apiSecret || !url) {
    throw new Error("LiveKit is not configured (LIVEKIT_API_KEY / LIVEKIT_API_SECRET / LIVEKIT_WS_URL)");
  }
  return { apiKey, apiSecret, url };
}

export function mintLiveKitToken(grant: {
  identity: string;
  room: string;
  name?: string;
  ttlSeconds?: number;
  now?: number;
}): { token: string; url: string } {
  const { apiKey, apiSecret, url } = liveKitConfig();
  const now = grant.now ?? Math.floor(Date.now() / 1000);
  const exp = now + (grant.ttlSeconds ?? 60 * 60);

  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: apiKey,
      sub: grant.identity,
      ...(grant.name ? { name: grant.name } : {}),
      nbf: now,
      exp,
      video: {
        room: grant.room,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
    }),
  );

  const signingInput = `${header}.${payload}`;
  const signature = createHmac("sha256", apiSecret).update(signingInput).digest("base64url");
  return { token: `${signingInput}.${signature}`, url };
}

// Stable 1:1 room name, independent of who initiates the call.
export function directCallRoom(a: string, b: string): string {
  return `dm-${[a, b].sort().join("__")}`;
}
