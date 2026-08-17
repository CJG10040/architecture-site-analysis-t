import { describe, expect, it } from "vitest";
import { decodeFieldMaterialPayload, isAllowedFieldMaterialMimeType, MAX_FIELD_MATERIAL_BYTES, sanitizeFieldMaterialName } from "./fieldMaterials";

describe("field material validation", () => {
  it("decodes a valid data URL without changing its bytes", () => {
    const result = decodeFieldMaterialPayload("data:image/png;base64,aGVsbG8=");
    expect(result.mimeType).toBe("image/png");
    expect(result.buffer.toString()).toBe("hello");
  });

  it("allows supported survey image, drawing and audio formats only", () => {
    expect(isAllowedFieldMaterialMimeType("photo", "image/jpeg")).toBe(true);
    expect(isAllowedFieldMaterialMimeType("drawing", "application/pdf")).toBe(true);
    expect(isAllowedFieldMaterialMimeType("audio", "audio/webm")).toBe(true);
    expect(isAllowedFieldMaterialMimeType("audio", "image/png")).toBe(false);
    expect(isAllowedFieldMaterialMimeType("document", "application/zip")).toBe(false);
  });

  it("normalizes storage names and retains the configured maximum size", () => {
    expect(sanitizeFieldMaterialName("북측 골목/사진?.png")).toMatch(/\.png$/);
    expect(MAX_FIELD_MATERIAL_BYTES).toBe(16 * 1024 * 1024);
  });
});
