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
    const cookieToken = getCookieValue(req, authCookieName);
    const cookiePayload = verifyTokenPayload(cookieToken);
    if (cookiePayload) {
      req.user = cookiePayload;
      req.authMethod = "cookie";
      return next();
    }

    const bearerToken = readBearerToken(req.headers.authorization);
    const bearerPayload = verifyTokenPayload(bearerToken);
    if (bearerPayload) {
      req.user = bearerPayload;
      req.authMethod = "bearer";
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
