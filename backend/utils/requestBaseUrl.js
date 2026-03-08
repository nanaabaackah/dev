const normalizeBaseUrl = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
};

const DEFAULT_LOCAL_APP_BASE_URL = "http://localhost:5173";

export const resolveRequestBaseUrl = ({
  appBaseUrl,
  isProduction,
  devFallbackOrigins = [],
}) => {
  const configuredBase = normalizeBaseUrl(appBaseUrl);
  if (configuredBase) {
    return configuredBase;
  }

  const devFallbackBase = !isProduction
    ? devFallbackOrigins.map(normalizeBaseUrl).find(Boolean) || DEFAULT_LOCAL_APP_BASE_URL
    : "";
  return devFallbackBase || "";
};
