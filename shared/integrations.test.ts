import { describe, expect, it } from "vitest";
import { credentialGroups, getCredentialGroup } from "./integrations";

describe("credential groups", () => {
  it("maps every currently connected public-data service to the shared data.go.kr credential", () => {
    const dataGoKr = getCredentialGroup("dataGoKr");
    expect(dataGoKr.activeServices).toEqual(expect.arrayContaining([
      "토지이용규제 행위제한정보 · DTarLandUseInfo",
      "에어코리아 측정소정보·대기오염정보",
      "전남광주통합특별시 광주버스정보",
      "사회복지시설정보서비스 현황",
    ]));
    expect(dataGoKr.fields).toHaveLength(1);
  });

  it("keeps spatial and statistical credentials separated from the public-data service key", () => {
    expect(getCredentialGroup("sgis").fields).toHaveLength(2);
    expect(getCredentialGroup("vworld").activeServices).toHaveLength(0);
    expect(new Set(credentialGroups.map(group => group.id)).size).toBe(credentialGroups.length);
  });
});
