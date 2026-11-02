const pending = new Set<symbol>();
const listeners = new Set<() => void>();
const publish = () => listeners.forEach((listener) => listener());

export const loadingState = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  snapshot: () => pending.size > 0,
  serverSnapshot: () => false,
};

export function beginLoading() {
  if (typeof window === "undefined") return () => {};
  const key = Symbol();
  pending.add(key);
  publish();
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    pending.delete(key);
    publish();
  };
}

export function replaceDocument(url: string) {
  const finish = beginLoading();
  window.addEventListener("pageshow", finish, { once: true });
  try {
    window.location.replace(url);
  } catch (error) {
    finish();
    throw error;
  }
}

export function focusWhenReady(
  element: HTMLElement | null,
  options?: FocusOptions,
) {
  if (!element) return;
  const focus = () =>
    requestAnimationFrame(() => {
      const overlay = document.querySelector<HTMLDialogElement>(
        "[data-blocking-loading][open]",
      );
      if (overlay) {
        overlay.addEventListener("close", focus, { once: true });
        return;
      }
      if (element.isConnected && !element.hasAttribute("disabled"))
        element.focus(options);
    });
  if (!loadingState.snapshot()) {
    focus();
    return;
  }
  const unsubscribe = loadingState.subscribe(() => {
    if (!loadingState.snapshot()) {
      unsubscribe();
      focus();
    }
  });
}
