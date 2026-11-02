"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { loadingState } from "../loadingState";
import styles from "./blocking-loading.module.css";

export default function BlockingLoading() {
  const busy = useSyncExternalStore(
    loadingState.subscribe,
    loadingState.snapshot,
    loadingState.serverSnapshot,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!busy || !element) return;
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.documentElement.style.overflow = overflow;
    };
  }, [busy]);
  return (
    <dialog
      data-blocking-loading
      ref={dialog}
      className={styles.overlay}
      aria-label="처리 중"
      aria-busy="true"
      onCancel={(event) => event.preventDefault()}
    >
      <div className={styles.content} aria-hidden="true">
        {/* The dialog keeps its accessible label without visible reading text. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/app-192.png" width="64" height="64" alt="" />
        <span className={styles.spinner} aria-hidden="true" />
      </div>
    </dialog>
  );
}
