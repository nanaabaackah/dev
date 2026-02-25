const normalizeApiBase = (value) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed ? trimmed.replace(/\/$/, "") : "";
};

const ENV_API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE);

const resolveApiBase = () => {
  if (!ENV_API_BASE) return "";
  if (typeof window === "undefined") return ENV_API_BASE;
  try {
    const parsed = new URL(ENV_API_BASE, window.location.origin);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "");
  } catch {
    return ENV_API_BASE;
  }
};

const API_BASE = resolveApiBase();

const ensureLeadingSlash = (value) => (value.startsWith('/') ? value : `/${value}`);

export const buildApiUrl = (path) => {
  if (!path) {
    throw new Error('buildApiUrl requires a path');
  }
  const normalizedPath = ensureLeadingSlash(path);
  return API_BASE ? `${API_BASE}${normalizedPath}` : normalizedPath;
};
