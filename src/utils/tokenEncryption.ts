import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;

export interface EncryptedToken {
    encryptedToken: string;
    encryptedKey: string;
}

function getMasterKey(masterKey: string): Buffer {
    if (!/^[0-9a-fA-F]{64}$/.test(masterKey)) {
        throw new Error("TOKEN_ENCRYPTION_KEY must be a 64-character hexadecimal key generated once and kept secret.");
    }

    return Buffer.from(masterKey, "hex");
}

function encryptWithKey(value: Buffer | string, key: Buffer): string {
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([
        cipher.update(value),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [iv, authTag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

function decryptWithKey(payload: string, key: Buffer): Buffer {
    const parts = payload.split(".");
    if (parts.length !== 3) throw new Error("Malformed encrypted value");

    const [ivEncoded, authTagEncoded, ciphertextEncoded] = parts;
    const iv = Buffer.from(ivEncoded, "base64url");
    const authTag = Buffer.from(authTagEncoded, "base64url");
    const ciphertext = Buffer.from(ciphertextEncoded, "base64url");

    if (iv.length !== IV_BYTES || authTag.length !== 16 || ciphertext.length === 0) {
        throw new Error("Malformed encrypted value");
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function encryptToken(token: string, masterKey: string): EncryptedToken {
    const masterKeyBytes = getMasterKey(masterKey);
    const perTokenKey = crypto.randomBytes(KEY_BYTES);

    // Each token has its own key. Rotating the master key only requires these
    // small wrapped keys to be re-encrypted, not every access token.
    return {
        encryptedToken: encryptWithKey(token, perTokenKey),
        encryptedKey: encryptWithKey(perTokenKey, masterKeyBytes),
    };
}

export function validateTokenEncryptionKey(masterKey: string): void {
    getMasterKey(masterKey);
}

export function decryptToken(encrypted: EncryptedToken, masterKey: string): string {
    try {
        const masterKeyBytes = getMasterKey(masterKey);
        const perTokenKey = decryptWithKey(encrypted.encryptedKey, masterKeyBytes);
        if (perTokenKey.length !== KEY_BYTES) throw new Error("Malformed encrypted key");

        return decryptWithKey(encrypted.encryptedToken, perTokenKey).toString("utf8");
    } catch {
        throw new Error("Token decryption failed: the encryption key is missing, incorrect, or the ciphertext was tampered with.");
    }
}
