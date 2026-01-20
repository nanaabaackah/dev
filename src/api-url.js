const RAW_API_BASE = import.meta.env.VITE_API_BASE ?? '';
const API_BASE = RAW_API_BASE.replace(/\/$/, '');

const ensureLeadingSlash = (value) => (value.startsWith('/') ? value : `/${value}`);

export const buildApiUrl = (path) => {
  if (!path) {
    throw new Error('buildApiUrl requires a path');
  }
  const normalizedPath = ensureLeadingSlash(path);
  return API_BASE ? `${API_BASE}${normalizedPath}` : normalizedPath;
};
