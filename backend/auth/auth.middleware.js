export const createVerifyTokenPayload = ({ jwt, jwtSecret, expectedPurpose = null }) => (token) => {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, jwtSecret);
    if (expectedPurpose && payload?.purpose !== expectedPurpose) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

export const createAuthMiddleware =
  ({ authCookieName, getCookieValue, readBearerToken, verifyTokenPayload, loadSessionUser }) =>
  async (req, res, next) => {
    const resolveAuthenticatedUser = async (token) => {
      const payload = verifyTokenPayload(token);
      if (!payload) return null;
      if (typeof loadSessionUser !== "function") {
        return payload;
      }
      return loadSessionUser(payload);
    };

    try {
      const bearerToken = readBearerToken(req.headers.authorization);
      const bearerUser = await resolveAuthenticatedUser(bearerToken);
      if (bearerUser) {
        req.user = bearerUser;
        req.authMethod = "bearer";
        return next();
      }

      const cookieToken = getCookieValue(req, authCookieName);
      const cookieUser = await resolveAuthenticatedUser(cookieToken);
      if (cookieUser) {
        req.user = cookieUser;
        req.authMethod = "cookie";
        return next();
      }

      return res.status(401).json({ error: "Invalid or expired authentication session" });
    } catch (error) {
      return next(error);
    }
  };

export const createResolveAuthenticatedPayload =
  ({ authCookieName, getCookieValue, readBearerToken, verifyTokenPayload, loadSessionUser }) =>
  async (req) => {
    const resolveAuthenticatedUser = async (token) => {
      const payload = verifyTokenPayload(token);
      if (!payload) return null;
      if (typeof loadSessionUser !== "function") {
        return payload;
      }
      return loadSessionUser(payload);
    };

    const bearerToken = readBearerToken(req?.headers?.authorization);
    const bearerUser = await resolveAuthenticatedUser(bearerToken);
    if (bearerUser) {
      return bearerUser;
    }

    const cookieToken = getCookieValue(req, authCookieName);
    const cookieUser = await resolveAuthenticatedUser(cookieToken);
    if (cookieUser) {
      return cookieUser;
    }

    return null;
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
  async (req, res, next) => {
    try {
      const payload = await resolveAuthenticatedPayload(req);
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
    } catch (error) {
      return next(error);
    }
  };
