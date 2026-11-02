import { proxyBackend } from "@/shared/api/backendProxy";

async function handler(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyBackend(request, (await context.params).path);
}

export {
  handler as GET,
  handler as HEAD,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as OPTIONS,
};
