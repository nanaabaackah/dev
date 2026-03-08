import assert from "node:assert/strict";
import test from "node:test";
import { createForgotPasswordHandler } from "./auth.controller.js";

const createMockResponse = () => {
  const response = {
    statusCode: 200,
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

test("createForgotPasswordHandler requires an email address", async () => {
  let lookupCalled = false;
  const handler = createForgotPasswordHandler({
    defaultAdminEmail: "admin@example.com",
    prisma: {
      user: {
        async findUnique() {
          lookupCalled = true;
          return null;
        },
      },
    },
    async sendForgotPasswordEmail() {},
  });
  const res = createMockResponse();

  await handler({ body: {} }, res);

  assert.equal(lookupCalled, false);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    error: "Email is required to recover your login.",
  });
});

test("createForgotPasswordHandler sends a reset email for an existing active user", async () => {
  const user = {
    id: 42,
    email: "person@example.com",
    firstName: "Ada",
    status: "ACTIVE",
  };
  const calls = [];
  const req = {
    body: {
      email: "PERSON@example.com",
    },
  };
  const handler = createForgotPasswordHandler({
    defaultAdminEmail: "admin@example.com",
    prisma: {
      user: {
        async findUnique(options) {
          calls.push({ type: "lookup", options });
          return user;
        },
      },
    },
    async sendForgotPasswordEmail(payload) {
      calls.push({ type: "send", payload });
    },
  });
  const res = createMockResponse();

  await handler(req, res);

  assert.deepEqual(calls[0], {
    type: "lookup",
    options: {
      where: { email: "person@example.com" },
    },
  });
  assert.deepEqual(calls[1], {
    type: "send",
    payload: { req, user },
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    message: "If that address exists in our system, we will email you instructions shortly.",
    supportEmail: "admin@example.com",
  });
});

test("createForgotPasswordHandler returns the generic success response when the user is missing", async () => {
  let sendCalled = false;
  const handler = createForgotPasswordHandler({
    defaultAdminEmail: "admin@example.com",
    prisma: {
      user: {
        async findUnique() {
          return null;
        },
      },
    },
    async sendForgotPasswordEmail() {
      sendCalled = true;
    },
  });
  const res = createMockResponse();

  await handler({ body: { email: "missing@example.com" } }, res);

  assert.equal(sendCalled, false);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    message: "If that address exists in our system, we will email you instructions shortly.",
    supportEmail: "admin@example.com",
  });
});

test("createForgotPasswordHandler does not send reset emails for suspended users", async () => {
  let sendCalled = false;
  const handler = createForgotPasswordHandler({
    defaultAdminEmail: "admin@example.com",
    prisma: {
      user: {
        async findUnique() {
          return {
            id: 7,
            email: "suspended@example.com",
            status: "SUSPENDED",
          };
        },
      },
    },
    async sendForgotPasswordEmail() {
      sendCalled = true;
    },
  });
  const res = createMockResponse();

  await handler({ body: { email: "suspended@example.com" } }, res);

  assert.equal(sendCalled, false);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    message: "If that address exists in our system, we will email you instructions shortly.",
    supportEmail: "admin@example.com",
  });
});

test("createForgotPasswordHandler keeps the response generic when delivery is rerouted", async () => {
  const handler = createForgotPasswordHandler({
    defaultAdminEmail: "admin@example.com",
    prisma: {
      user: {
        async findUnique() {
          return {
            id: 8,
            email: "user@example.com",
            status: "ACTIVE",
          };
        },
      },
    },
    async sendForgotPasswordEmail() {
      return {
        resetRecipient: "admin@example.com",
        resetIntendedRecipient: "user@example.com",
        resetRerouted: true,
      };
    },
  });
  const res = createMockResponse();

  await handler({ body: { email: "user@example.com" } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    message: "If that address exists in our system, we will email you instructions shortly.",
    supportEmail: "admin@example.com",
  });
});

test("createForgotPasswordHandler keeps the response generic when delivery fails", async () => {
  const handler = createForgotPasswordHandler({
    defaultAdminEmail: "admin@example.com",
    prisma: {
      user: {
        async findUnique() {
          return {
            id: 9,
            email: "user@example.com",
            status: "ACTIVE",
          };
        },
      },
    },
    async sendForgotPasswordEmail() {
      const error = new Error("RESEND request failed");
      error.statusCode = 502;
      throw error;
    },
  });
  const res = createMockResponse();

  await handler({ body: { email: "user@example.com" } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    message: "If that address exists in our system, we will email you instructions shortly.",
    supportEmail: "admin@example.com",
  });
});
