import { describe, expect, it } from "vitest";
import { emptyKeyFileTemplate, parseKeyFile } from "./keyFile";

describe("key file parsing", () => {
  it("keeps only recognised key fields", () => expect(parseKeyFile({ naverMapsClientId: "maps", ignored: "do-not-keep" })).toEqual({ naverMapsClientId: "maps" }));
  it("rejects files without recognised values", () => expect(() => parseKeyFile({ note: "keys are private" })).toThrow("인식"));
  it("ships an empty template without actual credentials", () => expect(emptyKeyFileTemplate()).not.toContain("sk-"));
});
