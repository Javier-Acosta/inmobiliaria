"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

const storageKey = "inmobiliaria:favorites:v1";
const changeEvent = "inmobiliaria:favorites-changed";

function getSnapshot() {
  try {
    return window.localStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}

function getServerSnapshot() {
  return "";
}

function parseFavorites(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0))]
      : [];
  } catch {
    return [];
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(changeEvent, onChange);
  };
}

export function useFavorites() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const favoriteIds = useMemo(() => parseFavorites(snapshot), [snapshot]);
  const [favoriteError, setFavoriteError] = useState("");

  function toggleFavorite(id: string) {
    // Read the latest value so changes from another tab are preserved.
    const current = parseFavorites(getSnapshot());
    const next = current.includes(id)
      ? current.filter((favoriteId) => favoriteId !== id)
      : [...current, id];
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      window.dispatchEvent(new Event(changeEvent));
      setFavoriteError("");
    } catch {
      setFavoriteError("No se pudo guardar el favorito. Habilita el almacenamiento de este sitio en el navegador.");
    }
  }

  return { favoriteIds, toggleFavorite, favoriteError };
}
