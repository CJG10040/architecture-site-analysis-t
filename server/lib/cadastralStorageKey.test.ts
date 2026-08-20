import { describe, expect, it } from "vitest";
import { buildCadastralStorageKey } from "./cadastralStorageKey";

describe("buildCadastralStorageKey", () => {
  it("uses an ASCII-only storage key regardless of the Korean original filename", () => {
    const key = buildCadastralStorageKey({ districtCode: "12330", datasetReference: "202608", timestamp: 1_787_237_000_000 });
    expect(key).toBe("admin/cadastral/12330/202608/1787237000000-cadastral-12330-202608.zip");
    expect(/^[\x00-\x7F]+$/.test(key)).toBe(true);
  });
});
