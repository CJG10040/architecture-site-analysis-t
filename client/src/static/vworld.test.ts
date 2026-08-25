import { describe, expect, it, vi } from "vitest";
import { fetchVworldBrowserParcel, normalizeVworldBrowserCandidates, normalizeVworldWfsFeatures } from "./vworld";

describe("normalizeVworldBrowserCandidates", () => {
  it("reads parcel metadata without preserving a browser key", () => {
    const candidates = normalizeVworldBrowserCandidates({ response: { result: { featureCollection: { features: [{ properties: { pnu: "2911010100100010000", jibun: "1-1", jimok: "대", area: 121.5 } }] } } } });
    expect(candidates).toEqual([{ pnu: "2911010100100010000", parcelNumber: "1-1", landCategory: "대", areaSqm: "121.5" }]);
  });
});

describe("VWorld browser request", () => {
  it("sends the registered domain and exposes the API error body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ response: { status: "ERROR", error: { code: "INCORRECT_KEY", text: "인증키와 URL이 일치하지 않습니다." } } }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchVworldBrowserParcel({ key: "test-key", domain: "https://example.com/site/", latitude: 35.1, longitude: 126.9 })).rejects.toThrow("INCORRECT_KEY");
    const requestUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestUrl).toContain("domain=https%3A%2F%2Fexample.com%2Fsite%2F");
    vi.unstubAllGlobals();
  });
});

describe("normalizeVworldWfsFeatures", () => {
  it("normalizes a GeoJSON feature collection for source evidence", () => {
    const features = normalizeVworldWfsFeatures({ type: "FeatureCollection", features: [{ id: "road.1", geometry: { type: "LineString", coordinates: [] }, properties: { ROAD_RANK: "104", LANES: "4" } }] });
    expect(features).toHaveLength(1);
    expect(features[0]).toMatchObject({ id: "road.1", properties: { ROAD_RANK: "104", LANES: "4" } });
  });
});
