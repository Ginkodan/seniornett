import { verifySession } from "@/lib/auth-token";

export type RequestIdentity = {
  userId: string;
  language: string;
};

function readHeaderValue(requestHeaders: Headers, name: string): string {
  return requestHeaders.get(name)?.trim() || "";
}

export function readIdentityHeaders(requestHeaders: Headers): RequestIdentity | null {
  const userId = readHeaderValue(requestHeaders, "x-user-id");

  if (!userId) {
    return null;
  }

  return {
    userId,
    language: readHeaderValue(requestHeaders, "x-user-language") || "de",
  };
}

export function requireIdentityHeaders(requestHeaders: Headers): RequestIdentity {
  const identity = readIdentityHeaders(requestHeaders);

  if (!identity) {
    throw new Error("Kein Benutzer erkannt. Die Anfrage enthält keinen X-User-Id-Header.");
  }

  return identity;
}

export function readBearerToken(requestHeaders: Headers): string {
  const header = requestHeaders.get("authorization")?.trim() || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : "";
}

// Identity for the ungated /api/ext/* routes (off-VPN standalone app). These
// routes bypass the nginx VPN gate, so they MUST NOT trust X-User-Id (a client
// could forge it). The Bearer session token is the only accepted credential.
// The on-VPN tablet path keeps using requireIdentityHeaders above, which is safe
// because nginx overwrites X-User-Id from the validated auth_request result.
export function readSessionIdentity(requestHeaders: Headers): RequestIdentity | null {
  const token = readBearerToken(requestHeaders);
  return token ? verifySession(token) : null;
}
