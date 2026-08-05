import { corsHeaders, jsonResponse } from "@/lib/cors";
import { readSessionIdentity, type RequestIdentity } from "@/lib/request-auth";

// Shared plumbing for the token-gated /api/ext/* routes (standalone caregiver
// app). These routes are NOT behind the nginx VPN gate, so they enforce the
// Bearer session themselves via requireRequestIdentity. On-VPN tablets reaching
// the same handlers (e.g. via X-User-Id) resolve identically.

// 400-class errors thrown by domain code carry user-facing messages we pass
// through; anything else is treated as an unexpected 500.
export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function withIdentity(
  req: Request,
  handler: (identity: RequestIdentity, req: Request) => Promise<unknown>,
): Promise<Response> {
  const headers = corsHeaders(req.headers.get("origin"));

  const identity: RequestIdentity | null = readSessionIdentity(req.headers);
  if (!identity) {
    return jsonResponse({ error: "unauthorized" }, 401, headers);
  }

  try {
    const data = await handler(identity, req);
    return jsonResponse(data, 200, headers);
  } catch (err) {
    if (err instanceof ApiError) {
      return jsonResponse({ error: err.message }, err.status, headers);
    }
    // Domain helpers throw Error with a user-facing (German) validation message.
    return jsonResponse({ error: err instanceof Error ? err.message : "internal_error" }, 400, headers);
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    throw new ApiError("invalid_body", 400);
  }
}

export function requireString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(`missing_${key}`, 400);
  }
  return value.trim();
}
