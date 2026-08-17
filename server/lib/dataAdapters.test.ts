import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  getApiCredential: vi.fn(async () => ({ isEnabled: true, encryptedValue: "encrypted", initializationVector: "iv", authenticationTag: "tag", keyVersion: "v1" })),
}));

vi.mock("./credentialCrypto", () => ({
  decryptSecret: vi.fn(() => JSON.stringify({ primary: "test-service-key" })),
}));

const { fetchLandUse } = await import("./dataAdapters");

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
