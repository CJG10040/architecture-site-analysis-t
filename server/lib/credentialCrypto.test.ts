import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, maskSecret } from "./credentialCrypto";
import { haversineMeters } from "../db";

describe("API credential encryption", () => {
  it("round-trips a secret without preserving the plaintext in ciphertext", () => {
    const plaintext = "sample-public-data-key-1234567890";
    const encrypted = encryptSecret(plaintext, "test-encryption-root");

    expect(encrypted.encryptedValue).not.toContain(plaintext);
    expect(encrypted.initializationVector).not.toBe("");
    expect(encrypted.authenticationTag).not.toBe("");
    expect(decryptSecret(encrypted, "test-encryption-root")).toBe(plaintext);
  });

  it("does not expose a full credential in the masked representation", () => {
    expect(maskSecret("abcdefghijklmno")).toBe("abc••••••mno");
    expect(maskSecret("short")).toBe("••••••");
  });
});

describe("spatial distance calculation", () => {
  it("calculates zero distance for identical site coordinates", () => {
    expect(haversineMeters({ latitude: 35.1467, longitude: 126.921 }, { latitude: 35.1467, longitude: 126.921 })).toBe(0);
  });

  it("returns an approximate walking-scale straight-line distance", () => {
    const distance = haversineMeters({ latitude: 35.1464409, longitude: 126.9198892 }, { latitude: 35.1463731, longitude: 126.9168317 });
    expect(distance).toBeGreaterThan(250);
    expect(distance).toBeLessThan(350);
  });
});
