"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useBlockingLoading } from "./useBlockingLoading";
export function useAppRouter() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useBlockingLoading(pending);
  return {
    ...router,
    push: (...args: Parameters<typeof router.push>) =>
      startTransition(() => router.push(...args)),
    replace: (...args: Parameters<typeof router.replace>) =>
      startTransition(() => router.replace(...args)),
  };
}
