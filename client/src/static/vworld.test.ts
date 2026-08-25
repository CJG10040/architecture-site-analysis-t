import { describe, expect, it, vi } from "vitest";
import { candidateBoundary, fetchVworldBrowserParcel, fetchVworldWfs, normalizeVworldBrowserCandidates, normalizeVworldKey, normalizeVworldWfsFeatures, parcelCandidateKey, parcelIntersectsBoundary } from "./vworld";

describe("normalizeVworldKey", () => {
  it("removes copied wrapping quotes and whitespace without exposing the key", () => {
    expect(normalizeVworldKey("  \"abc-123\" \n")).toBe("abc-123");
  });
});

describe("normalizeVworldBrowserCandidates", () => {
  it("reads parcel metadata without preserving a browser key", () => {
    const candidates = normalizeVworldBrowserCandidates({ response: { result: { featureCollection: { features: [{ id: "parcel.1", geometry: { type: "Polygon", coordinates: [[[126.9, 35.1], [126.901, 35.1], [126.901, 35.101], [126.9, 35.1]]] }, properties: { pnu: "2911010100100010000", jibun: "1-1", jimok: "대", area: 121.5 } }] } } } });
    expect(candidates[0]).toMatchObject({ featureId: "parcel.1", pnu: "2911010100100010000", parcelNumber: "1-1", landCategory: "대", areaSqm: "121.5" });
    expect(parcelCandidateKey(candidates[0])).toBe("2911010100100010000");
    expect(candidateBoundary(candidates[0])).toHaveLength(3);
    expect(parcelIntersectsBoundary(candidates[0], [{ lat: 35.1005, lng: 126.9005 }, { lat: 35.1005, lng: 126.9015 }, { lat: 35.1015, lng: 126.9015 }, { lat: 35.1015, lng: 126.9005 }])).toBe(true);
    expect(parcelIntersectsBoundary(candidates[0], [{ lat: 35.102, lng: 126.902 }, { lat: 35.102, lng: 126.903 }, { lat: 35.103, lng: 126.903 }, { lat: 35.103, lng: 126.902 }])).toBe(false);
  });
});

describe("VWorld browser request", () => {
  it("uses JSONP, sends the registered domain, and exposes the API error body", async () => {
    const fakeWindow: Record<string, unknown> = { setTimeout, clearTimeout };
    let requestUrl = "";
    const fakeDocument = { createElement: () => { const script: { src: string; onerror?: () => void; remove: () => void } = { src: "", remove: () => undefined }; return script; }, head: { appendChild: (script: { src: string }) => { requestUrl = script.src; const callback = decodeURIComponent(new URL(script.src).searchParams.get("callback") ?? ""); setTimeout(() => (fakeWindow[callback] as (payload: unknown) => void)({ response: { status: "ERROR", error: { code: "INCORRECT_KEY", text: "인증키와 URL이 일치하지 않습니다." } } }), 0); } } };
    vi.stubGlobal("window", fakeWindow);
    vi.stubGlobal("document", fakeDocument);
    await expect(fetchVworldBrowserParcel({ key: "test-key", domain: "https://example.com/site/", latitude: 35.1, longitude: 126.9 })).rejects.toThrow("INCORRECT_KEY");
    expect(requestUrl).toContain("domain=https%3A%2F%2Fexample.com%2Fsite%2F");
    vi.unstubAllGlobals();
  });

  it("uses the HTML prototype's WFS format_options callback", async () => {
    const fakeWindow: Record<string, unknown> = { setTimeout, clearTimeout };
    let requestUrl = "";
    const fakeDocument = { createElement: () => { const script: { src: string; onerror?: () => void; remove: () => void } = { src: "", remove: () => undefined }; return script; }, head: { appendChild: (script: { src: string }) => { requestUrl = script.src; const formatOptions = new URL(script.src).searchParams.get("format_options") ?? ""; const callback = formatOptions.replace(/^callback:/, ""); setTimeout(() => (fakeWindow[callback] as (payload: unknown) => void)({ type: "FeatureCollection", features: [] }), 0); } } };
    vi.stubGlobal("window", fakeWindow);
    vi.stubGlobal("document", fakeDocument);
    const result = await fetchVworldWfs({ key: "test-key", domain: "https://example.com/site/", typename: "lt_l_moctlink", latitude: 35.1, longitude: 126.9, radiusMeters: 300 });
    expect(result.features).toEqual([]);
    expect(requestUrl).toContain("format_options=callback:");
    expect(requestUrl).toContain("domain=https%3A%2F%2Fexample.com%2Fsite%2F");
    expect(requestUrl).toContain("output=text%2Fjavascript");
    vi.unstubAllGlobals();
  });
});

describe("normalizeVworldWfsFeatures", () => {
  it("normalizes a GeoJSON feature collection for source evidence", () => {
    const features = normalizeVworldWfsFeatures({ type: "FeatureCollection", features: [{ id: "road.1", geometry: { type: "LineString", coordinates: [[126.9, 35.1], [126.901, 35.101]] }, properties: { ROAD_RANK: "104", LANES: "4" } }] });
    expect(features).toHaveLength(1);
    expect(features[0]).toMatchObject({ id: "road.1", properties: { ROAD_RANK: "104", LANES: "4" } });
  });

  it("converts Web Mercator geometry to longitude and latitude", () => {
    const features = normalizeVworldWfsFeatures({ type: "FeatureCollection", features: [{ geometry: { type: "Point", coordinates: [14137575.3, 4177479.1] }, properties: {} }] });
    expect(Number((features[0].geometry?.coordinates as number[])[0])).toBeCloseTo(127, 1);
    expect(Number((features[0].geometry?.coordinates as number[])[1])).toBeCloseTo(35.1, 1);
  });
});
