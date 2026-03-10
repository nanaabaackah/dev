import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSmsRecipient,
  parseSmsRecipients,
  resolveSmsDeliveryRecipients,
} from "./smsDelivery.js";

test("normalizeSmsRecipient converts supported formatting into E.164", () => {
  assert.equal(normalizeSmsRecipient("+1 (555) 010-2000"), "+15550102000");
  assert.equal(normalizeSmsRecipient("00233 24 123 4567"), "+233241234567");
});

test("normalizeSmsRecipient rejects invalid phone numbers", () => {
  assert.equal(normalizeSmsRecipient("0241234567"), "");
  assert.equal(normalizeSmsRecipient("not-a-number"), "");
});

test("parseSmsRecipients deduplicates and filters invalid values", () => {
  assert.deepEqual(parseSmsRecipients("+15550102000, +15550102000; invalid"), ["+15550102000"]);
});

test("resolveSmsDeliveryRecipients sends live in production", () => {
  const delivery = resolveSmsDeliveryRecipients({
    recipients: "+15550102000,+15550102001",
    isProduction: true,
  });

  assert.deepEqual(delivery, {
    intendedRecipients: ["+15550102000", "+15550102001"],
    deliveryRecipients: ["+15550102000", "+15550102001"],
    wasSimulated: false,
  });
});

test("resolveSmsDeliveryRecipients simulates in local by default", () => {
  const delivery = resolveSmsDeliveryRecipients({
    recipients: "+15550102000,+15550102001",
    isProduction: false,
  });

  assert.deepEqual(delivery, {
    intendedRecipients: ["+15550102000", "+15550102001"],
    deliveryRecipients: [],
    wasSimulated: true,
  });
});

test("resolveSmsDeliveryRecipients can send live in non-production when allowed", () => {
  const delivery = resolveSmsDeliveryRecipients({
    recipients: "+15550102000",
    isProduction: false,
    allowNonProduction: true,
  });

  assert.deepEqual(delivery, {
    intendedRecipients: ["+15550102000"],
    deliveryRecipients: ["+15550102000"],
    wasSimulated: false,
  });
});
