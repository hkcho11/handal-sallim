import { beginLoading } from "../loadingState";

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const finish = beginLoading();
  const controller = new AbortController();
  const abort = () => controller.abort();
  const signal = init?.signal;
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 15000);
  try {
    return await performFetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
    finish();
  }
}

async function performFetch(input: RequestInfo | URL, init?: RequestInit) {
  let headers = init?.headers;
  if (
    typeof document !== "undefined" &&
    !["GET", "HEAD", "OPTIONS"].includes(init?.method?.toUpperCase() ?? "GET")
  ) {
    const token = document.cookie
      .split("; ")
      .find((value) => value.startsWith("XSRF-TOKEN="))
      ?.slice("XSRF-TOKEN=".length);
    if (token) {
      const securedHeaders = new Headers(headers);
      securedHeaders.set("X-XSRF-TOKEN", decodeURIComponent(token));
      headers = securedHeaders;
    }
  }
  const response = await fetch(input, { ...init, headers });
  // Include the response body in the blocking period.
  if (response.body) await response.clone().arrayBuffer();
  if (response.status === 401 && !String(input).includes("/auth/")) {
    window.dispatchEvent(new Event("auth-expired"));
  }
  return response;
}
