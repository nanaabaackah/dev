const applyFallbackSecurityHeaders = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Origin-Agent-Cluster", "?1");

  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").toLowerCase();
  if (req.secure || forwardedProto === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
};

export const createSecurityHeadersMiddleware = () => {
  let activeMiddleware = applyFallbackSecurityHeaders;

  void import("helmet")
    .then((helmetModule) => {
      const helmet = helmetModule?.default || helmetModule;
      if (typeof helmet !== "function") return;

      activeMiddleware = helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
        referrerPolicy: { policy: "no-referrer" },
      });
    })
    .catch((error) => {
      const reason = error?.code || error?.message || "module unavailable";
      console.warn(`Helmet not available, using fallback security headers (${reason}).`);
    });

  return (req, res, next) => activeMiddleware(req, res, next);
};
