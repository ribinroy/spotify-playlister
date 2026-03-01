import type { CacheEntry } from "@/types";

const CACHE_KEY = "spotifolder_match_cache";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function normalizeKey(artist: string, title: string): string {
  return `${artist.toLowerCase().trim()}|${title.toLowerCase().trim()}`;
}

function loadCache(): Record<string, CacheEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, CacheEntry>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export function getCachedMatch(
  artist: string,
  title: string
): CacheEntry | null {
  const cache = loadCache();
  const key = normalizeKey(artist, title);
  const entry = cache[key];

  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    delete cache[key];
    saveCache(cache);
    return null;
  }

  return entry;
}

export function setCachedMatch(
  artist: string,
  title: string,
  entry: Omit<CacheEntry, "timestamp">
): void {
  const cache = loadCache();
  const key = normalizeKey(artist, title);
  cache[key] = { ...entry, timestamp: Date.now() };
  saveCache(cache);
}

export function clearCache(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CACHE_KEY);
}
