import assert from "node:assert/strict";
import test from "node:test";
import { createSecretCrypto } from "./secretCrypto.js";

test("createSecretCrypto encrypts and decrypts secrets", () => {
  const cryptoBox = createSecretCrypto("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");

  const encrypted = cryptoBox.encrypt("refresh-token");

  assert.notEqual(encrypted, "refresh-token");
  assert.equal(cryptoBox.isEncrypted(encrypted), true);
  assert.equal(cryptoBox.decrypt(encrypted), "refresh-token");
});

test("createSecretCrypto returns plaintext for legacy unencrypted values", () => {
  const cryptoBox = createSecretCrypto("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");

  assert.equal(cryptoBox.decrypt("legacy-token"), "legacy-token");
  assert.equal(cryptoBox.isEncrypted("legacy-token"), false);
});

test("createSecretCrypto rejects invalid key lengths", () => {
  assert.throws(() => createSecretCrypto("short"), {
    message: "OAUTH_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.",
  });
});
