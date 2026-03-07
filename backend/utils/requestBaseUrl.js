const normalizeBaseUrl = (value) => {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed.replace(/\/$/, "") : "";
};

const DEFAULT_LOCAL_APP_BASE_URL = "http://localhost:5173";

export const resolveRequestBaseUrl = ({
  appBaseUrl,
  isProduction,
  requestOrigin,
  forwardedProto,
  protocol,
  host,
  devFallbackOrigins = [],
}) => {
  const configuredBase = normalizeBaseUrl(appBaseUrl);
  if (configuredBase) {
    return configuredBase;
  }

  const originBase = normalizeBaseUrl(requestOrigin);
  if (originBase) {
    return originBase;
  }

  const devFallbackBase = !isProduction
    ? devFallbackOrigins.map(normalizeBaseUrl).find(Boolean) || DEFAULT_LOCAL_APP_BASE_URL
    : "";

  const normalizedHost = String(host || "").trim();
  if (normalizedHost) {
    const normalizedForwardedProto = String(forwardedProto || "")
      .split(",")[0]
      .trim();
    const scheme = normalizedForwardedProto || String(protocol || "").trim() || "https";
    const hostBase = `${scheme}://${normalizedHost}`;

    if (isProduction) {
      return hostBase;
    }

    return devFallbackBase || hostBase;
  }

  return devFallbackBase || DEFAULT_LOCAL_APP_BASE_URL;
};
