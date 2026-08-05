import { beforeAll, describe, expect, it } from "vitest";

import { signSession, verifySession } from "@/lib/auth-token";

const identity = { userId: "user-caregiver-001", language: "de" };

beforeAll(() => {
  process.env.SENIORNETT_AUTH_JWT_SECRET = "test-secret-for-auth-token";
});

describe("auth-token", () => {
  it("round-trips a valid session", () => {
    const token = signSession(identity, { now: 1000, ttlSeconds: 100 });
    expect(verifySession(token, { now: 1050 })).toEqual(identity);
  });

  it("defaults language to de when missing", () => {
    const token = signSession({ userId: "u1", language: "" }, { now: 1000, ttlSeconds: 100 });
    expect(verifySession(token, { now: 1050 })).toEqual({ userId: "u1", language: "de" });
  });

  it("rejects an expired token", () => {
    const token = signSession(identity, { now: 1000, ttlSeconds: 100 });
    expect(verifySession(token, { now: 2000 })).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = signSession(identity, { now: 1000, ttlSeconds: 100 });
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect(verifySession(tampered, { now: 1050 })).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const [header, , signature] = signSession(identity, { now: 1000, ttlSeconds: 100 }).split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "admin", lang: "de", iat: 1000, exp: 9999999999 }), "utf8").toString(
      "base64url",
    );
    expect(verifySession(`${header}.${forged}.${signature}`, { now: 1050 })).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(verifySession("", { now: 1050 })).toBeNull();
    expect(verifySession("not.a.jwt", { now: 1050 })).toBeNull();
    expect(verifySession("only-one-part", { now: 1050 })).toBeNull();
  });
});
