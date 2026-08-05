// CORS for API routes consumed by the standalone (off-VPN) caregiver app.
// Origins are allow-listed via SENIORNETT_APP_ALLOWED_ORIGINS (comma-separated).
// "*" (or unset) echoes the request origin — fine because auth rides the
// Authorization header (Bearer token), not cookies, so we never set
// Access-Control-Allow-Credentials.

function allowedOrigins(): string[] | "*" {
  const raw = process.env.SENIORNETT_APP_ALLOWED_ORIGINS?.trim();
  if (!raw || raw === "*") return "*";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function resolveAllowedOrigin(origin: string | null): string {
  const list = allowedOrigins();
  if (list === "*") return origin || "*";
  if (origin && list.includes(origin)) return origin;
  return list[0] ?? "*";
}

export function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": resolveAllowedOrigin(origin),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function jsonResponse(
  data: unknown,
  status: number,
  extraHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}
