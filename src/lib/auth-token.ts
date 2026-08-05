import { createHmac, timingSafeEqual } from "node:crypto";

import type { RequestIdentity } from "@/lib/request-auth";

// Minimal HS256 JWT for off-VPN session tokens (standalone caregiver app).
// We sign and verify with the same shared secret, so only HS256 is ever
// accepted — there is no "alg" negotiation an attacker could downgrade.
const ALG = "HS256";
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SessionClaims = {
  sub: string; // userId
  lang: string; // language
  iat: number;
  exp: number;
};

function getSecret(): string {
  const secret = process.env.SENIORNETT_AUTH_JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("SENIORNETT_AUTH_JWT_SECRET is not set");
  }
  return secret;
}

function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function hmac(signingInput: string, secret: string): string {
  return createHmac("sha256", secret).update(signingInput).digest("base64url");
}

function nowSeconds(now?: number): number {
  return now ?? Math.floor(Date.now() / 1000);
}

export function signSession(
  identity: RequestIdentity,
  opts?: { now?: number; ttlSeconds?: number },
): string {
  const secret = getSecret();
  const iat = nowSeconds(opts?.now);
  const exp = iat + (opts?.ttlSeconds ?? DEFAULT_TTL_SECONDS);

  const header = b64url(JSON.stringify({ alg: ALG, typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ sub: identity.userId, lang: identity.language, iat, exp } satisfies SessionClaims),
  );
  const signingInput = `${header}.${payload}`;
  return `${signingInput}.${hmac(signingInput, secret)}`;
}

export function verifySession(token: string, opts?: { now?: number }): RequestIdentity | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;

  const expected = hmac(`${header}.${payload}`, getSecret());
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    return null;
  }

  let parsedHeader: { alg?: string };
  let claims: SessionClaims;
  try {
    parsedHeader = JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (parsedHeader.alg !== ALG) return null;
  if (typeof claims.sub !== "string" || !claims.sub) return null;
  if (typeof claims.exp !== "number" || claims.exp < nowSeconds(opts?.now)) return null;

  return {
    userId: claims.sub,
    language: typeof claims.lang === "string" && claims.lang ? claims.lang : "de",
  };
}
