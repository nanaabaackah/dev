const OFFLINE_CACHE_PREFIX = "dev-offline-cache:v1:";

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

export const readOfflineCache = (key, { maxAgeMs = 1000 * 60 * 60 * 24 * 3 } = {}) => {
  if (typeof window === "undefined") return null;
  const entry = safeParse(localStorage.getItem(withPrefix(key)));
  if (!entry || typeof entry !== "object") return null;
  const cachedAt = Number(entry.cachedAt);
  if (!Number.isFinite(cachedAt)) return null;
  if (Date.now() - cachedAt > maxAgeMs) return null;
  return entry;
};

export const writeOfflineCache = (key, payload) => {
  if (typeof window === "undefined") return;
  const entry = {
    payload,
    cachedAt: Date.now(),
  };
  try {
    localStorage.setItem(withPrefix(key), JSON.stringify(entry));
  } catch {
    // Ignore cache writes when storage is unavailable or full.
  }
};
