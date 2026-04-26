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
