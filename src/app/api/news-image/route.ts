import { NextRequest } from "next/server";

const IMAGE_FETCH_TIMEOUT_MS = 12000;

function withTimeoutSignal(timeoutMs: number) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  return {
    signal: abortController.signal,
    clear: () => clearTimeout(timeout),
  };
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");

  if (!rawUrl) {
    return new Response("Missing url parameter.", { status: 400 });
  }

  let imageUrl: URL;
  try {
    imageUrl = new URL(rawUrl);
  } catch {
    return new Response("Invalid url parameter.", { status: 400 });
  }

  if (!["http:", "https:"].includes(imageUrl.protocol)) {
    return new Response("Unsupported protocol.", { status: 400 });
  }

  const { signal, clear } = withTimeoutSignal(IMAGE_FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(imageUrl.toString(), {
      signal,
      cache: "no-store",
      redirect: "follow",
      headers: {
        "User-Agent": "SeniorNett/0.1 (+https://seniornett.local)",
        "Accept-Language": "de-CH,de;q=0.9,en;q=0.7",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });

    if (!upstream.ok) {
      return new Response("Image unavailable.", { status: 404 });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const buffer = await upstream.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("Image unavailable.", { status: 404 });
  } finally {
    clear();
  }
}
