import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  getApiCredential: vi.fn(async () => ({ isEnabled: true, encryptedValue: "encrypted", initializationVector: "iv", authenticationTag: "tag", keyVersion: "v1" })),
}));

vi.mock("./credentialCrypto", () => ({
  decryptSecret: vi.fn(() => JSON.stringify({ primary: "test-service-key", secondary: "test-consumer-secret" })),
}));

const { fetchCityParks, fetchCommerceInRadius, fetchLandUse, fetchSgisCensusSummary, fetchVworldParcelCandidates, normalizeVworldParcelCandidates } = await import("./dataAdapters");

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

describe("VWorld parcel candidates", () => {
  it("queries the continuous cadastral layer at the selected point", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ response: { result: { featureCollection: { features: [] } } } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await fetchVworldParcelCandidates({ latitude: 35.1467, longitude: 126.921 });
    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestUrl.hostname).toBe("api.vworld.kr");
    expect(requestUrl.searchParams.get("data")).toBe("LP_PA_CBND_BUBUN");
    expect(requestUrl.searchParams.get("geomFilter")).toBe("POINT(126.921 35.1467)");
    expect(requestUrl.searchParams.get("key")).toBe("test-service-key");
  });

  it("normalizes a feature into a safe parcel candidate", () => {
    const candidates = normalizeVworldParcelCandidates({ response: { result: { featureCollection: { features: [{ properties: { PNU: "2911010800100010000", JIBUN: "광산동 1-1", JIMOK: "대", AREA: 321.5 }, geometry: { type: "Polygon", coordinates: [[[126.9, 35.1], [126.91, 35.1], [126.9, 35.1]]] } }] } } } });
    expect(candidates[0]).toMatchObject({ pnu: "2911010800100010000", parcelNumber: "광산동 1-1", landCategory: "대", officialAreaSqm: "321.5" });
    expect(candidates[0]?.boundaryGeoJson).toContain("Polygon");
  });
});

describe("SGIS census summary", () => {
  it("authenticates with the encrypted key pair and queries the parcel's city-county-district context", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ errCd: "0", result: { accessToken: "temporary-token" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ errCd: "0", result: [{ tot_ppltn: "100" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ errCd: "0", result: [{ tot_house: "40" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ errCd: "0", result: [{ corp_cnt: "20" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSgisCensusSummary({ pnu: "2911010800100010000" });
    const authUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    const populationUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(authUrl.pathname).toBe("/OpenAPI3/auth/authentication.json");
    expect(authUrl.searchParams.get("consumer_key")).toBe("test-service-key");
    expect(authUrl.searchParams.get("consumer_secret")).toBe("test-consumer-secret");
    expect(populationUrl.pathname).toBe("/OpenAPI3/stats/population.json");
    expect(populationUrl.searchParams.get("adm_cd")).toBe("29110");
    expect(result.data.population).toEqual([{ tot_ppltn: "100" }]);
  });

  it("keeps available population and company data when one statistical section is unavailable", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ errCd: "0", result: { accessToken: "temporary-token" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ errCd: "0", result: [{ tot_ppltn: "100" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ errCd: "-100", errMsg: "검색결과가 존재하지 않습니다." }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ errCd: "0", result: [{ corp_cnt: "20" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSgisCensusSummary({ administrativeCode: "29110" });
    expect(result.data.population).toEqual([{ tot_ppltn: "100" }]);
    expect(result.data.company).toEqual([{ corp_cnt: "20" }]);
    expect(result.data.household).toEqual([]);
    expect(result.data.unavailableSections).toHaveLength(1);
  });
});
