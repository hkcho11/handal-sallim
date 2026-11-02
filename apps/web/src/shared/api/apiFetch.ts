export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
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
  if (response.status === 401 && !String(input).includes("/auth/")) {
    window.dispatchEvent(new Event("auth-expired"));
  }
  return response;
}
