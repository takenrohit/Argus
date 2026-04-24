// Tiny shared store for "alert sound muted" state.
// Persists in localStorage and broadcasts changes via a window event
// so any component (TopBar toggle, AlertToaster beeper) stays in sync.

const STORAGE_KEY = "argus.alerts.muted";
const EVENT_NAME  = "argus:sound-toggle";

export function isSoundMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: muted }));
  } catch {
    /* ignore */
  }
}

export function toggleSoundMuted(): boolean {
  const next = !isSoundMuted();
  setSoundMuted(next);
  return next;
}

export function subscribeSoundMuted(handler: (muted: boolean) => void): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<boolean>).detail;
    handler(typeof detail === "boolean" ? detail : isSoundMuted());
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}