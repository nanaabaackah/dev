export const createVerifyTokenPayload = ({ jwt, jwtSecret }) => (token) => {
  if (!token) return null;
  try {
    return jwt.verify(token, jwtSecret);
  } catch {
    return null;
  }
};

export const createAuthMiddleware =
  ({ authCookieName, getCookieValue, readBearerToken, verifyTokenPayload }) =>
  (req, res, next) => {
    const bearerToken = readBearerToken(req.headers.authorization);
    const bearerPayload = verifyTokenPayload(bearerToken);
    if (bearerPayload) {
      req.user = bearerPayload;
      req.authMethod = "bearer";
      return next();
    }

    const cookieToken = getCookieValue(req, authCookieName);
    const cookiePayload = verifyTokenPayload(cookieToken);
    if (cookiePayload) {
      req.user = cookiePayload;
      req.authMethod = "cookie";
      return next();
    }

    return res.status(401).json({ error: "Invalid or expired authentication session" });
  };

export const createRequireAdmin = () => (req, res, next) => {
  if (!req.user || req.user.roleName !== "Admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

export const resolveMountedRequestPath = (req) => {
  const baseUrl = typeof req?.baseUrl === "string" ? req.baseUrl : "";
  const path = typeof req?.path === "string" ? req.path : "";
  const mountedPath = `${baseUrl}${path}`;
  if (mountedPath) {
    return mountedPath;
  }

  const originalUrl = typeof req?.originalUrl === "string" ? req.originalUrl : "";
  if (!originalUrl) {
    return "";
  }

  try {
    return new URL(originalUrl, "http://localhost").pathname;
  } catch {
    const [pathname = ""] = originalUrl.split("?");
    return pathname;
  }
};

export const createRentOnlyModuleAccessMiddleware =
  ({
    resolveAuthenticatedPayload,
    extractAllowedModules,
    isRentOnlyModuleScope,
    allowedPathMatchers,
    errorMessage = "Your account is restricted to the rent module.",
  }) =>
  (req, res, next) => {
    const payload = resolveAuthenticatedPayload(req);
    if (!payload) return next();

    const scopedModules = extractAllowedModules({ modules: payload.modules });
    if (!isRentOnlyModuleScope(scopedModules)) {
      return next();
    }

    const requestPath = resolveMountedRequestPath(req);
    if (allowedPathMatchers.some((matcher) => matcher.test(requestPath))) {
      return next();
    }

    return res.status(403).json({
      error: errorMessage,
    });
  };
