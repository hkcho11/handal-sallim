"use client";
import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { useBlockingLoading } from "./useBlockingLoading";
function Pending() {
  const { pending } = useLinkStatus();
  useBlockingLoading(pending);
  return null;
}
export default function AppLink({
  children,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <Pending />
    </Link>
  );
}
