import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type EncryptedSecret = {
  encryptedValue: string;
  initializationVector: string;
  authenticationTag: string;
  keyVersion: string;
};

function encryptionKey(secretOverride?: string) {
  const source = secretOverride ?? process.env.JWT_SECRET;
  if (!source) throw new Error("암호화 키가 구성되지 않았습니다.");
  return createHash("sha256").update(source).digest();
}

export function encryptSecret(value: string, secretOverride?: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secretOverride), iv);
  const encryptedValue = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]).toString("base64");
  return {
    encryptedValue,
    initializationVector: iv.toString("base64"),
    authenticationTag: cipher.getAuthTag().toString("base64"),
    keyVersion: "v1",
  };
}

export function decryptSecret(value: EncryptedSecret, secretOverride?: string) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secretOverride), Buffer.from(value.initializationVector, "base64"));
  decipher.setAuthTag(Buffer.from(value.authenticationTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(value.encryptedValue, "base64")), decipher.final()]).toString("utf8");
}

export function maskSecret(value: string) {
  const normalized = value.trim();
  if (normalized.length <= 6) return "••••••";
  return `${normalized.slice(0, 3)}••••••${normalized.slice(-3)}`;
}
