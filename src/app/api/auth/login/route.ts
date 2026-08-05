import { signSession } from "@/lib/auth-token";
import { corsHeaders, jsonResponse } from "@/lib/cors";
import { getPool } from "@/lib/db";

// POST /api/auth/login  { username, code } -> { token, user }
// Authenticates an off-VPN client (e.g. the standalone caregiver app) using a
// username + pairing code. The code is verified in-DB via pgcrypto's crypt(),
// so nothing but the bcrypt hash is ever stored. On success we mint a Bearer
// session token that resolveRequestIdentity() accepts on every other route.

export const runtime = "nodejs";

type LoginBody = { username?: unknown; code?: unknown };

export async function OPTIONS(req: Request): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: Request): Promise<Response> {
  const headers = corsHeaders(req.headers.get("origin"));

  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return jsonResponse({ error: "invalid_body" }, 400, headers);
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!username || !code) {
    return jsonResponse({ error: "missing_credentials" }, 400, headers);
  }

  const { rows } = await getPool().query<{ user_id: string; language: string }>(
    `SELECT u.user_id, u.language
       FROM users u
       JOIN user_credentials c ON c.user_id = u.user_id
      WHERE u.username = $1
        AND c.secret_hash = crypt($2, c.secret_hash)
      LIMIT 1`,
    [username, code],
  );

  if (rows.length === 0) {
    return jsonResponse({ error: "invalid_credentials" }, 401, headers);
  }

  const identity = { userId: rows[0].user_id, language: rows[0].language || "de" };
  const token = signSession(identity);

  return jsonResponse({ token, user: { id: identity.userId, language: identity.language } }, 200, headers);
}
