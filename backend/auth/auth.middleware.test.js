import assert from "node:assert/strict";
import test from "node:test";
import {
  createAuthMiddleware,
  createRequireAdmin,
  createVerifyTokenPayload,
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

test("createAuthMiddleware authenticates with a cookie token first", () => {
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
  assert.deepEqual(req.user, { userId: "1", roleName: "Admin" });
  assert.equal(req.authMethod, "cookie");
  assert.equal(res.statusCode, null);
});

test("createAuthMiddleware falls back to bearer tokens", () => {
  const req = { headers: { authorization: "Bearer bearer-token" } };
  const res = createMockResponse();
  let nextCalled = false;

  const authMiddleware = createAuthMiddleware({
    authCookieName: "auth",
    getCookieValue() {
      return null;
    },
    readBearerToken(header) {
      return header === "Bearer bearer-token" ? "bearer-token" : null;
    },
    verifyTokenPayload(token) {
      return token === "bearer-token" ? { userId: "2", roleName: "User" } : null;
    },
  });

  authMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(req.user, { userId: "2", roleName: "User" });
  assert.equal(req.authMethod, "bearer");
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
