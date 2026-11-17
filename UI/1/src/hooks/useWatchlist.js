import { useSyncExternalStore } from "react";
const KEY = "muvilite.watchlist.v1";
const listeners = new Set();
let memoryOnly = false;
const EMPTY = [];
let cachedRaw,
  cachedItems = EMPTY;
function snapshot() {
  if (memoryOnly) return cachedItems;
  try {
    const raw = localStorage.getItem(KEY) || "[]";
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      const parsed = JSON.parse(raw);
      cachedItems = Array.isArray(parsed)
        ? parsed.filter((m) => m && typeof m === "object" && (m._id || m.id))
        : EMPTY;
    }
  } catch {
    cachedItems = EMPTY;
  }
  return cachedItems;
}
function subscribe(fn) {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}
export default function useWatchlist() {
  const items = useSyncExternalStore(subscribe, snapshot, () => []);
  return {
    items,
    has: (id) => items.some((m) => String(m._id ?? m.id) === String(id)),
    toggle: (movie) => {
      const id = movie._id ?? movie.id;
      const current = snapshot();
      const next = current.some((m) => String(m._id ?? m.id) === String(id))
        ? current.filter((m) => String(m._id ?? m.id) !== String(id))
        : [...current, movie];
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        memoryOnly = true;
        cachedItems = next;
      }
      listeners.forEach((fn) => fn());
      return true;
    },
  };
}
