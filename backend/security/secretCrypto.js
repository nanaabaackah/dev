import { Buffer } from "node:buffer";
import crypto from "crypto";

const SECRET_PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const KEY_LENGTH_BYTES = 32;

const parseKeyMaterial = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  if (/^[0-9a-f]{64}$/i.test(normalized)) {
    return Buffer.from(normalized, "hex");
  }

  const base64Value = normalized.startsWith("base64:") ? normalized.slice(7) : normalized;
  return Buffer.from(base64Value, "base64");
};

export const createSecretCrypto = (value) => {
  const key = parseKeyMaterial(value);
  if (!key) {
    return null;
  }
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error("OAUTH_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }

  const encrypt = (plaintext) => {
    if (plaintext === undefined || plaintext === null || plaintext === "") {
      return plaintext ?? null;
    }

    const normalized = String(plaintext);
    if (normalized.startsWith(SECRET_PREFIX)) {
      return normalized;
    }

    const iv = crypto.randomBytes(IV_LENGTH_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    });
    const encrypted = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${SECRET_PREFIX}${iv.toString("base64url")}.${encrypted.toString(
      "base64url"
    )}.${tag.toString("base64url")}`;
  };

  const decrypt = (ciphertext) => {
    if (ciphertext === undefined || ciphertext === null || ciphertext === "") {
      return ciphertext ?? null;
    }

    const normalized = String(ciphertext);
    if (!normalized.startsWith(SECRET_PREFIX)) {
      return normalized;
    }

    const encoded = normalized.slice(SECRET_PREFIX.length);
    const [ivPart, payloadPart, tagPart] = encoded.split(".");
    if (!ivPart || !payloadPart || !tagPart) {
      throw new Error("Encrypted secret payload is malformed.");
    }

    const iv = Buffer.from(ivPart, "base64url");
    const payload = Buffer.from(payloadPart, "base64url");
    const tag = Buffer.from(tagPart, "base64url");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    });
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(payload), decipher.final()]).toString("utf8");
  };

  return {
    encrypt,
    decrypt,
    isEncrypted(value) {
      return typeof value === "string" && value.startsWith(SECRET_PREFIX);
    },
  };
};
