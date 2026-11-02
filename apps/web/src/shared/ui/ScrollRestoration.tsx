"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function ScrollRestoration() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const route = `${pathname}?${searchParams.toString()}`;
  const positions = useRef(new Map<string, number>());

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useLayoutEffect(() => {
    const target = positions.current.get(route) ?? 0;
    let restoring = true;
    let frame = 0;
    let confirmation = 0;

    const save = () => {
      if (!restoring) positions.current.set(route, window.scrollY);
    };
    const stop = () => {
      restoring = false;
      observer.disconnect();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(confirmation);
      clearTimeout(timeout);
      save();
    };
    const restore = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!restoring) return;
        const available =
          document.documentElement.scrollHeight - window.innerHeight;
        // Wait for asynchronously loaded lists before restoring a deep position.
        if (available < target) return;
        window.scrollTo({ top: target, behavior: "instant" });
        confirmation = requestAnimationFrame(() => {
          if (Math.abs(window.scrollY - target) <= 1) stop();
          else restore();
        });
      });
    };
    const observer = new ResizeObserver(restore);
    const timeout = window.setTimeout(() => {
      window.scrollTo({ top: target, behavior: "instant" });
      stop();
    }, 8000);

    observer.observe(document.querySelector(".app-content") ?? document.body);
    window.addEventListener("scroll", save, { passive: true });
    // User input takes precedence over a pending restoration.
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("pointerdown", stop, { passive: true });
    window.addEventListener("keydown", stop);
    restore();

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(confirmation);
      window.removeEventListener("scroll", save);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("pointerdown", stop);
      window.removeEventListener("keydown", stop);
    };
  }, [route]);

  return null;
}
