"use client";
import { useEffect, useState } from "react";
import { listOwners, type OwnerOptions } from "@/shared/api/owners";

export function useOwnerOptions(resource: "incomes" | "savings") {
  const [options, setOptions] = useState<OwnerOptions>();
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    listOwners(resource)
      .then((result) => {
        if (active) {
          setOptions(result);
          setError("");
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "소유자 목록을 불러오지 못했습니다.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [resource, attempt]);
  return {
    options,
    isLoading,
    error,
    retry: () => {
      setLoading(true);
      setAttempt((n) => n + 1);
    },
  };
}
