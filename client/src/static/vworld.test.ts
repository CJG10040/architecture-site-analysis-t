import { describe, expect, it } from "vitest";
import { normalizeVworldBrowserCandidates } from "./vworld";

describe("normalizeVworldBrowserCandidates", () => {
  it("reads parcel metadata without preserving a browser key", () => {
    const candidates = normalizeVworldBrowserCandidates({ response: { result: { featureCollection: { features: [{ properties: { pnu: "2911010100100010000", jibun: "1-1", jimok: "대", area: 121.5 } }] } } } });
    expect(candidates).toEqual([{ pnu: "2911010100100010000", parcelNumber: "1-1", landCategory: "대", areaSqm: "121.5" }]);
  });
});
