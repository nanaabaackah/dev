const inferLocalApiBase = () => {
  if (typeof window === "undefined") return "";
  const { hostname, port, protocol } = window.location;
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
  if (!isLocalHost || !port || port === "8080") return "";
  return `${protocol}//${hostname}:8080`;
};

const ENV_API_BASE = import.meta.env.VITE_API_BASE;
const RAW_API_BASE =
  typeof ENV_API_BASE === "string" && ENV_API_BASE.trim() ? ENV_API_BASE : inferLocalApiBase();
const API_BASE = RAW_API_BASE.replace(/\/$/, "");

const ensureLeadingSlash = (value) => (value.startsWith('/') ? value : `/${value}`);

export const buildApiUrl = (path) => {
  if (!path) {
    throw new Error('buildApiUrl requires a path');
  }
  const normalizedPath = ensureLeadingSlash(path);
  return API_BASE ? `${API_BASE}${normalizedPath}` : normalizedPath;
};
