import { useSyncExternalStore } from "react";

type Mode = "signin" | "signup" | null;

let mode: Mode = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function openAuthModal(next: "signin" | "signup" = "signin") {
  mode = next;
  emit();
}

export function closeAuthModal() {
  mode = null;
  emit();
}

export function useAuthModal() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => mode,
    () => null,
  );
}
