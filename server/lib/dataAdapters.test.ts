import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  getApiCredential: vi.fn(async () => ({ isEnabled: true, encryptedValue: "encrypted", initializationVector: "iv", authenticationTag: "tag", keyVersion: "v1" })),
}));

vi.mock("./credentialCrypto", () => ({
  decryptSecret: vi.fn(() => JSON.stringify({ primary: "test-service-key" })),
}));

const { fetchCityParks, fetchCommerceInRadius, fetchLandUse } = await import("./dataAdapters");

afterEach(() => vi.unstubAllGlobals());

describe("fetchLandUse", () => {
  it("uses the official action-restriction endpoint with area, zone, and land-use inputs", async () => {
    const fetchMock = vi.fn(async () => new Response("<response><header><resultCode>0</resultCode><resultMsg>OK</resultMsg></header><body><items /></body></response>", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchLandUse({ areaCd: "11110", ucodeList: "UQA430", landUseNm: "주택" });

    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestUrl.pathname).toBe("/1613000/arLandUseInfoService/DTarLandUseInfo");
    expect(requestUrl.searchParams.get("areaCd")).toBe("11110");
    expect(requestUrl.searchParams.get("ucodeList")).toBe("UQA430");
    expect(requestUrl.searchParams.get("landUseNm")).toBe("주택");
    expect(requestUrl.searchParams.has("returnType")).toBe(false);
  });
});

describe("site-context layers", () => {
  it("requests nearby commerce using the stored site center and bounded radius", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ response: { header: { resultCode: "00", resultMsg: "NORMAL SERVICE" }, body: { items: [] } } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await fetchCommerceInRadius(35.1467, 126.9210, 5000);
    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestUrl.pathname).toBe("/B553077/api/open/sdsc2/storeListInRadius");
    expect(requestUrl.searchParams.get("cx")).toBe("126.921");
    expect(requestUrl.searchParams.get("cy")).toBe("35.1467");
    expect(requestUrl.searchParams.get("radius")).toBe("2000");
  });

  it("requests the approved national city-park standard data endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ response: { header: { resultCode: "00", resultMsg: "NORMAL SERVICE" }, body: { items: [] } } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await fetchCityParks();
    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestUrl.hostname).toBe("api.data.go.kr");
    expect(requestUrl.pathname).toBe("/openapi/tn_pubr_public_cty_park_info_api");
  });
});
