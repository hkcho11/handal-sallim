"use client";
import { useEffect } from "react";
import { beginLoading } from "../loadingState";
export function useBlockingLoading(pending: boolean) {
  useEffect(() => {
    if (pending) return beginLoading();
  }, [pending]);
}
