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
      <div className={styles.content} aria-live="polite">
        <span className={styles.spinner} aria-hidden="true" />
        <p>처리 중이에요</p>
        <small>잠시만 기다려 주세요.</small>
      </div>
    </dialog>
  );
}
