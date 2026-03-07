import assert from "node:assert/strict";
import test from "node:test";
import {
  createAuthMiddleware,
  createRentOnlyModuleAccessMiddleware,
  createRequireAdmin,
  createVerifyTokenPayload,
  resolveMountedRequestPath,
} from "./auth.middleware.js";

const createMockResponse = () => {
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  return response;
};

test("createVerifyTokenPayload returns null when token verification fails", () => {
  const verifyTokenPayload = createVerifyTokenPayload({
    jwt: {
      verify() {
        throw new Error("invalid token");
      },
    },
    jwtSecret: "secret",
  });

  assert.equal(verifyTokenPayload("bad-token"), null);
});

test("createAuthMiddleware authenticates with a bearer token first", () => {
  const req = { headers: { authorization: "Bearer bearer-token" } };
  const res = createMockResponse();
  let nextCalled = false;

  const authMiddleware = createAuthMiddleware({
    authCookieName: "auth",
    getCookieValue() {
      return "cookie-token";
    },
    readBearerToken() {
      return "bearer-token";
    },
    verifyTokenPayload(token) {
      if (token === "cookie-token") return { userId: "1", roleName: "Admin" };
      if (token === "bearer-token") return { userId: "2", roleName: "User" };
      return null;
    },
  });

  authMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(req.user, { userId: "2", roleName: "User" });
  assert.equal(req.authMethod, "bearer");
  assert.equal(res.statusCode, null);
});

test("createAuthMiddleware falls back to cookie tokens", () => {
  const req = { headers: { authorization: "Bearer bad-token" } };
  const res = createMockResponse();
  let nextCalled = false;

  const authMiddleware = createAuthMiddleware({
    authCookieName: "auth",
    getCookieValue() {
      return "cookie-token";
    },
    readBearerToken(header) {
      return header === "Bearer bad-token" ? "bad-token" : null;
    },
    verifyTokenPayload(token) {
      return token === "cookie-token" ? { userId: "1", roleName: "Admin" } : null;
    },
  });

  authMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(req.user, { userId: "1", roleName: "Admin" });
  assert.equal(req.authMethod, "cookie");
});

test("createAuthMiddleware returns 401 when no valid auth is present", () => {
  const req = { headers: { authorization: "" } };
  const res = createMockResponse();
  let nextCalled = false;

  const authMiddleware = createAuthMiddleware({
    authCookieName: "auth",
    getCookieValue() {
      return null;
    },
    readBearerToken() {
      return null;
    },
    verifyTokenPayload() {
      return null;
    },
  });

  authMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Invalid or expired authentication session" });
});

test("createRequireAdmin blocks non-admin users", () => {
  const requireAdmin = createRequireAdmin();
  const req = { user: { roleName: "User" } };
  const res = createMockResponse();
  let nextCalled = false;

  requireAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { error: "Admin access required" });
});

test("createRequireAdmin allows admins through", () => {
  const requireAdmin = createRequireAdmin();
  const req = { user: { roleName: "Admin" } };
  const res = createMockResponse();
  let nextCalled = false;

  requireAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test("resolveMountedRequestPath preserves the mounted prefix for api middleware", () => {
  const requestPath = resolveMountedRequestPath({
    baseUrl: "/api",
    path: "/auth/login",
    originalUrl: "/api/auth/login?next=%2Fdashboard",
  });

  assert.equal(requestPath, "/api/auth/login");
});

test("createRentOnlyModuleAccessMiddleware allows mounted auth routes for rent-scoped users", () => {
  const req = {
    baseUrl: "/api",
    path: "/auth/login",
    originalUrl: "/api/auth/login",
  };
  const res = createMockResponse();
  let nextCalled = false;

  const middleware = createRentOnlyModuleAccessMiddleware({
    resolveAuthenticatedPayload() {
      return { modules: ["rent"] };
    },
    extractAllowedModules({ modules }) {
      return modules;
    },
    isRentOnlyModuleScope(modules) {
      return Array.isArray(modules) && modules.length === 1 && modules[0] === "rent";
    },
    allowedPathMatchers: [/^\/api\/rent(?:\/|$)/, /^\/api\/users\/me(?:\/|$)/, /^\/api\/auth(?:\/|$)/],
  });

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test("createRentOnlyModuleAccessMiddleware allows mounted users/me routes for rent-scoped users", () => {
  const req = {
    baseUrl: "/api",
    path: "/users/me",
    originalUrl: "/api/users/me",
  };
  const res = createMockResponse();
  let nextCalled = false;

  const middleware = createRentOnlyModuleAccessMiddleware({
    resolveAuthenticatedPayload() {
      return { modules: ["rent"] };
    },
    extractAllowedModules({ modules }) {
      return modules;
    },
    isRentOnlyModuleScope(modules) {
      return Array.isArray(modules) && modules.length === 1 && modules[0] === "rent";
    },
    allowedPathMatchers: [/^\/api\/rent(?:\/|$)/, /^\/api\/users\/me(?:\/|$)/, /^\/api\/auth(?:\/|$)/],
  });

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test("createRentOnlyModuleAccessMiddleware blocks non-rent endpoints for rent-scoped users", () => {
  const req = {
    baseUrl: "/api",
    path: "/organizations",
    originalUrl: "/api/organizations",
  };
  const res = createMockResponse();
  let nextCalled = false;

  const middleware = createRentOnlyModuleAccessMiddleware({
    resolveAuthenticatedPayload() {
      return { modules: ["rent"] };
    },
    extractAllowedModules({ modules }) {
      return modules;
    },
    isRentOnlyModuleScope(modules) {
      return Array.isArray(modules) && modules.length === 1 && modules[0] === "rent";
    },
    allowedPathMatchers: [/^\/api\/rent(?:\/|$)/, /^\/api\/users\/me(?:\/|$)/, /^\/api\/auth(?:\/|$)/],
  });

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { error: "Your account is restricted to the rent module." });
});
