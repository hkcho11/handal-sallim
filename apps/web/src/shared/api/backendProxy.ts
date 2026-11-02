import { SERVICE_UNAVAILABLE_MESSAGE } from "./serviceAvailability";

const hopHeaders = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
];

function cleanHeaders(source: Headers) {
  const headers = new Headers(source);
  for (const name of source.get("connection")?.split(",") ?? []) {
    headers.delete(name.trim());
  }
  for (const name of hopHeaders) headers.delete(name);
  return headers;
}

export async function proxyBackend(request: Request, path: string[]) {
  if (path.some((part) => part === "." || part === "..")) {
    return Response.json(
      { message: "올바르지 않은 요청입니다." },
      { status: 400 },
    );
  }
  const target = new URL(
    `/api/${path.map(encodeURIComponent).join("/")}`,
    process.env.API_ORIGIN ?? "http://127.0.0.1:8081",
  );
  target.search = new URL(request.url).search;
  const headers = cleanHeaders(request.headers);
  headers.set("accept-encoding", "identity");
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method)
        ? undefined
        : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
    });
    const responseHeaders = cleanHeaders(upstream.headers);
    responseHeaders.delete("set-cookie");
    for (const cookie of upstream.headers.getSetCookie()) {
      responseHeaders.append("set-cookie", cookie);
    }
    // fetch has already decompressed any encoded upstream response.
    responseHeaders.delete("content-encoding");
    responseHeaders.set("cache-control", "no-store");
    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    // Never expose connection exceptions or retry writes automatically.
    return Response.json(
      { message: SERVICE_UNAVAILABLE_MESSAGE },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "3" },
      },
    );
  }
}
