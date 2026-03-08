const OFFLINE_CACHE_PREFIX = "dev-offline-cache:v1:";
const DEFAULT_MAX_CACHE_AGE_MS = 1000 * 60 * 30;

const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
};

const safeParse = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const readStoredUserId = () => {
  if (typeof window === "undefined") return "anon";
  const parsed = safeParse(localStorage.getItem("user"));
  const id = parsed?.id;
  if (Number.isFinite(Number(id))) {
    return String(id);
  }
  return "anon";
};

const withPrefix = (key) => `${OFFLINE_CACHE_PREFIX}${key}`;

export const buildUserScopedCacheKey = (key) => `${readStoredUserId()}:${key}`;

export const readOfflineCache = (key, { maxAgeMs = DEFAULT_MAX_CACHE_AGE_MS } = {}) => {
  const storage = getStorage();
  if (!storage) return null;
  const entry = safeParse(storage.getItem(withPrefix(key)));
  if (!entry || typeof entry !== "object") return null;
  const cachedAt = Number(entry.cachedAt);
  if (!Number.isFinite(cachedAt)) return null;
  if (Date.now() - cachedAt > maxAgeMs) return null;
  return entry;
};

export const writeOfflineCache = (key, payload) => {
  const storage = getStorage();
  if (!storage) return;
  const entry = {
    payload,
    cachedAt: Date.now(),
  };
  try {
    storage.setItem(withPrefix(key), JSON.stringify(entry));
  } catch {
    // Ignore cache writes when storage is unavailable or full.
  }
};
