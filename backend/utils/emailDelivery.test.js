import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveEmailDeliveryRecipients,
  resolveLocalEmailRecipient,
  resolveSingleEmailDeliveryTarget,
} from "./emailDelivery.js";

const parseRecipients = (value) =>
  String(value || "")
    .split(/[,\s;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

test("resolveLocalEmailRecipient prefers DEFAULT_ADMIN_EMAIL when valid", () => {
  assert.equal(resolveLocalEmailRecipient("admin@example.com"), "admin@example.com");
});

test("resolveLocalEmailRecipient falls back when DEFAULT_ADMIN_EMAIL is invalid", () => {
  assert.equal(resolveLocalEmailRecipient("not-an-email"), "dev@nanaabaackah.com");
});

test("resolveEmailDeliveryRecipients preserves recipients in production", () => {
  const delivery = resolveEmailDeliveryRecipients({
    recipients: ["tenant@example.com", "owner@example.com"],
    parseRecipients,
    isProduction: true,
    defaultAdminEmail: "admin@example.com",
  });

  assert.deepEqual(delivery, {
    intendedRecipients: ["tenant@example.com", "owner@example.com"],
    deliveryRecipients: ["tenant@example.com", "owner@example.com"],
    wasRerouted: false,
  });
});

test("resolveEmailDeliveryRecipients reroutes local delivery to DEFAULT_ADMIN_EMAIL", () => {
  const delivery = resolveEmailDeliveryRecipients({
    recipients: ["tenant@example.com", "owner@example.com"],
    parseRecipients,
    isProduction: false,
    defaultAdminEmail: "admin@example.com",
  });

  assert.deepEqual(delivery, {
    intendedRecipients: ["tenant@example.com", "owner@example.com"],
    deliveryRecipients: ["admin@example.com"],
    wasRerouted: true,
  });
});

test("resolveEmailDeliveryRecipients does not mark reroute when local recipient already matches", () => {
  const delivery = resolveEmailDeliveryRecipients({
    recipients: ["admin@example.com"],
    parseRecipients,
    isProduction: false,
    defaultAdminEmail: "admin@example.com",
  });

  assert.deepEqual(delivery, {
    intendedRecipients: ["admin@example.com"],
    deliveryRecipients: ["admin@example.com"],
    wasRerouted: false,
  });
});

test("resolveSingleEmailDeliveryTarget reroutes local single-recipient sends", () => {
  const delivery = resolveSingleEmailDeliveryTarget({
    recipient: "tenant@example.com",
    isProduction: false,
    defaultAdminEmail: "admin@example.com",
  });

  assert.deepEqual(delivery, {
    intendedRecipient: "tenant@example.com",
    deliveryRecipient: "admin@example.com",
    wasRerouted: true,
  });
});
