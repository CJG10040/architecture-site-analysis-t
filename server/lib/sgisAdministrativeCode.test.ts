import { describe, expect, it } from "vitest";
import { deriveSgisSggCodeFromPnu } from "./sgisAdministrativeCode";

describe("deriveSgisSggCodeFromPnu", () => {
  it("converts a legal PNU prefix to the separate SGIS census district code", () => {
    expect(deriveSgisSggCodeFromPnu("2911010800100010000")).toBe("24010");
    expect(deriveSgisSggCodeFromPnu("1111010100100010000")).toBe("11010");
    expect(deriveSgisSggCodeFromPnu("4111010100100010000")).toBe("31010");
  });

  it("does not guess when a complete legal PNU is unavailable", () => {
    expect(deriveSgisSggCodeFromPnu("29110")).toBeUndefined();
    expect(deriveSgisSggCodeFromPnu("not-a-pnu")).toBeUndefined();
  });
});
