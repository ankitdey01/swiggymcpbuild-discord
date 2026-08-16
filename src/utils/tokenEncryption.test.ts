import assert from "node:assert/strict";
import test from "node:test";
import { decryptToken, encryptToken } from "./tokenEncryption.js";

const MASTER_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

test("encryptToken returns ciphertext that decrypts with the master key", () => {
  const token = "swiggy-live-bearer-token";
  const encrypted = encryptToken(token, MASTER_KEY);

  assert.notEqual(encrypted.encryptedToken, token);
  assert.notEqual(encrypted.encryptedKey, MASTER_KEY);
  assert.equal(decryptToken(encrypted, MASTER_KEY), token);
});

test("decryptToken rejects a wrong master key", () => {
  const encrypted = encryptToken("swiggy-live-bearer-token", MASTER_KEY);

  assert.throws(
    () => decryptToken(encrypted, "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"),
    /Token decryption failed/
  );
});

test("encryptToken rejects malformed master keys", () => {
  assert.throws(() => encryptToken("token", ""), /TOKEN_ENCRYPTION_KEY/);
  assert.throws(() => encryptToken("token", "not-a-key"), /TOKEN_ENCRYPTION_KEY/);
});
