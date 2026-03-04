import assert from "node:assert/strict";
import test from "node:test";
import { asyncHandler } from "./asyncHandler.js";

test("asyncHandler forwards rejected async errors to next", async () => {
  const failure = new Error("boom");
  let forwardedError = null;

  const handler = asyncHandler(async () => {
    throw failure;
  });

  await handler({}, {}, (error) => {
    forwardedError = error;
  });

  assert.equal(forwardedError, failure);
});

test("asyncHandler preserves successful handlers", async () => {
  let invoked = false;
  let nextCalled = false;

  const handler = asyncHandler(async () => {
    invoked = true;
  });

  await handler({}, {}, () => {
    nextCalled = true;
  });

  assert.equal(invoked, true);
  assert.equal(nextCalled, false);
});
