import assert from "node:assert/strict";
import test from "node:test";
import {
  getDeleteUserBlocker,
  getResendInvitationBlocker,
  resolveUserStatusForPasswordState,
} from "./accessUsers.js";

test("getDeleteUserBlocker blocks removing the current account", () => {
  const blocker = getDeleteUserBlocker({
    requesterUserId: 12,
    targetUserId: 12,
    targetRoleName: "Admin",
    remainingAdminCount: 3,
  });

  assert.equal(blocker, "You cannot remove your own account.");
});

test("getDeleteUserBlocker blocks removing the last admin user", () => {
  const blocker = getDeleteUserBlocker({
    requesterUserId: 3,
    targetUserId: 8,
    targetRoleName: "Admin",
    remainingAdminCount: 0,
  });

  assert.equal(blocker, "You cannot remove the last admin user.");
});

test("getDeleteUserBlocker allows removing non-admin or non-last-admin users", () => {
  const blocker = getDeleteUserBlocker({
    requesterUserId: 3,
    targetUserId: 8,
    targetRoleName: "Tenant",
    remainingAdminCount: 0,
  });

  assert.equal(blocker, null);
});

test("getResendInvitationBlocker blocks suspended users", () => {
  const blocker = getResendInvitationBlocker({
    targetStatus: "SUSPENDED",
  });

  assert.equal(blocker, "Activate the user before resending the setup link.");
});

test("getResendInvitationBlocker allows active and pending users", () => {
  assert.equal(getResendInvitationBlocker({ targetStatus: "ACTIVE" }), null);
  assert.equal(getResendInvitationBlocker({ targetStatus: "PENDING" }), null);
});

test("resolveUserStatusForPasswordState returns pending until a password exists", () => {
  const status = resolveUserStatusForPasswordState({
    currentStatus: "ACTIVE",
    requestedStatus: "SUSPENDED",
    hasPassword: false,
  });

  assert.equal(status, "PENDING");
});

test("resolveUserStatusForPasswordState activates when a password is set", () => {
  assert.equal(
    resolveUserStatusForPasswordState({
      currentStatus: "PENDING",
      requestedStatus: "ACTIVE",
      hasPassword: true,
    }),
    "ACTIVE"
  );
  assert.equal(
    resolveUserStatusForPasswordState({
      currentStatus: "PENDING",
      requestedStatus: "PENDING",
      hasPassword: true,
    }),
    "ACTIVE"
  );
});

test("resolveUserStatusForPasswordState preserves suspended when a password is set", () => {
  const status = resolveUserStatusForPasswordState({
    currentStatus: "PENDING",
    requestedStatus: "SUSPENDED",
    hasPassword: true,
  });

  assert.equal(status, "SUSPENDED");
});
