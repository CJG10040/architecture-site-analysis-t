import { XMLParser } from "fast-xml-parser";
import { decryptSecret } from "./credentialCrypto";
import * as db from "../db";
import type { CredentialGroup } from "../../shared/integrations";

export type Provider = CredentialGroup;

export class ExternalDataError extends Error {
  constructor(public readonly code: "NOT_CONFIGURED" | "BAD_REQUEST" | "UPSTREAM_ERROR" | "UNAVAILABLE", message: string, public readonly status?: number) {
    super(message);
  }
}

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });

function compactError(message: string) {
  return message.replace(/(serviceKey|key|consumer_secret)=[^&\s]+/gi, "$1=[REDACTED]").slice(0, 260);
}

async function getProviderCredentials(provider: Provider) {
  const credential = await db.getApiCredential(provider);
  if (!credential || !credential.isEnabled) {
    throw new ExternalDataError("NOT_CONFIGURED", "관리자 설정에서 이 데이터 제공자의 API 키를 먼저 등록해야 합니다.");
  }
  try {
    const rawValue = decryptSecret({
      encryptedValue: credential.encryptedValue,
      initializationVector: credential.initializationVector,
      authenticationTag: credential.authenticationTag,
      keyVersion: credential.keyVersion,
    });
    try {
      const payload = JSON.parse(rawValue) as { primary?: string; secondary?: string };
      if (payload.primary?.trim()) return { primary: payload.primary.trim(), secondary: payload.secondary?.trim() || undefined };
    } catch {
      // Legacy single-value credentials stay readable during the group-key migration.
      if (rawValue.trim()) return { primary: rawValue.trim() };
    }
    throw new Error("credential primary value is empty");
  } catch {
    throw new ExternalDataError("UNAVAILABLE", "등록된 API 키를 안전하게 읽지 못했습니다. 관리자에게 키 재등록을 요청하세요.");
  }
}

async function getProviderKey(provider: Provider) {
  return (await getProviderCredentials(provider)).primary;
}

async function vworldDataRequest(params: Record<string, string | number | undefined>) {
  const key = await getProviderKey("vworld");
  const url = new URL("https://api.vworld.kr/req/data");
  url.searchParams.set("service", "data");
  url.searchParams.set("request", "GetFeature");
  url.searchParams.set("data", "LP_PA_CBND_BUBUN");
  url.searchParams.set("format", "json");
  url.searchParams.set("crs", "EPSG:4326");
  url.searchParams.set("geometry", "true");
  url.searchParams.set("attribute", "true");
  url.searchParams.set("key", key);
  Object.entries(params).forEach(([name, value]) => {
    if (value !== undefined && value !== "") url.searchParams.set(name, String(value));
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    const body = await response.text();
    if (!response.ok) throw new ExternalDataError("UPSTREAM_ERROR", `VWorld 공간정보 서비스가 ${response.status} 상태로 응답했습니다.`, response.status);
    const data = JSON.parse(body) as unknown;
    return { data, sourceUrl: url.origin + url.pathname, status: response.status };
  } catch (error) {
    if (error instanceof ExternalDataError) throw error;
    throw new ExternalDataError("UNAVAILABLE", `VWorld 연속지적도 연결에 실패했습니다: ${compactError(error instanceof Error ? error.message : "알 수 없는 오류")}`);
  } finally {
    clearTimeout(timer);
  }
}

export type ParcelCandidate = { pnu?: string; parcelNumber?: string; landCategory?: string; officialAreaSqm?: string; boundaryGeoJson?: string; rawProperties: Record<string, unknown> };

export function normalizeVworldParcelCandidates(data: unknown): ParcelCandidate[] {
  const root = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const response = root.response && typeof root.response === "object" ? root.response as Record<string, unknown> : root;
  const result = response.result && typeof response.result === "object" ? response.result as Record<string, unknown> : response;
  const collection = result.featureCollection && typeof result.featureCollection === "object" ? result.featureCollection as Record<string, unknown> : result;
  const features = Array.isArray(collection.features) ? collection.features : [];
  return features.map(feature => {
    const item = feature && typeof feature === "object" ? feature as Record<string, unknown> : {};
    const properties = item.properties && typeof item.properties === "object" ? item.properties as Record<string, unknown> : {};
    const geometry = item.geometry && typeof item.geometry === "object" ? item.geometry : undefined;
    const value = (...keys: string[]) => keys.map(key => properties[key]).find(candidate => candidate !== undefined && candidate !== null && String(candidate).trim() !== "");
    return {
      pnu: value("pnu", "PNU", "pnu_cd", "PNU_CD") ? String(value("pnu", "PNU", "pnu_cd", "PNU_CD")) : undefined,
      parcelNumber: value("jibun", "JIBUN", "jibun_nm", "JIBUN_NM", "bonbun", "BONBUN") ? String(value("jibun", "JIBUN", "jibun_nm", "JIBUN_NM", "bonbun", "BONBUN")) : undefined,
      landCategory: value("jimok", "JIMOK", "lndcgr", "LNDCGR") ? String(value("jimok", "JIMOK", "lndcgr", "LNDCGR")) : undefined,
      officialAreaSqm: value("area", "AREA", "pcl_area", "PCL_AREA") ? String(value("area", "AREA", "pcl_area", "PCL_AREA")) : undefined,
      boundaryGeoJson: geometry ? JSON.stringify({ type: "Feature", properties, geometry }) : undefined,
      rawProperties: properties,
    };
  });
}

export async function fetchVworldParcelCandidates(input: { latitude: number; longitude: number }) {
  if (input.latitude < -90 || input.latitude > 90 || input.longitude < -180 || input.longitude > 180) throw new ExternalDataError("BAD_REQUEST", "필지 후보 조회 좌표가 유효하지 않습니다.");
  const upstream = await vworldDataRequest({ geomFilter: `POINT(${input.longitude} ${input.latitude})`, size: 12 });
  return { ...upstream, candidates: normalizeVworldParcelCandidates(upstream.data) };
}

async function sgisRequest(url: URL) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    const body = await response.text();
    if (!response.ok) throw new ExternalDataError("UPSTREAM_ERROR", `SGIS 서비스가 ${response.status} 상태로 응답했습니다.`, response.status);
    const data = JSON.parse(body) as Record<string, unknown>;
    if (Number(data.errCd ?? 0) !== 0) throw new ExternalDataError("UPSTREAM_ERROR", `SGIS 서비스가 요청을 거부했습니다: ${String(data.errMsg ?? data.errCd)}`, response.status);
    return { data, status: response.status };
  } catch (error) {
    if (error instanceof ExternalDataError) throw error;
    throw new ExternalDataError("UNAVAILABLE", `SGIS 통계 서비스 연결에 실패했습니다: ${compactError(error instanceof Error ? error.message : "알 수 없는 오류")}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSgisCensusSummary(input: { administrativeCode?: string; pnu?: string }) {
  const credentials = await getProviderCredentials("sgis");
  if (!credentials.secondary) throw new ExternalDataError("NOT_CONFIGURED", "SGIS 인구·가구·사업체 조회에는 Consumer Key와 Consumer Secret을 모두 등록해야 합니다.");
  const administrativeCode = input.administrativeCode?.trim() || input.pnu?.slice(0, 5);
  if (!administrativeCode || !/^\d{5}$/.test(administrativeCode)) throw new ExternalDataError("BAD_REQUEST", "SGIS 통계 조회에는 확정 필지의 PNU 또는 5자리 시·군·구 코드가 필요합니다.");
  const authUrl = new URL("https://sgisapi.kostat.go.kr/OpenAPI3/auth/authentication.json");
  authUrl.searchParams.set("consumer_key", credentials.primary);
  authUrl.searchParams.set("consumer_secret", credentials.secondary);
  const auth = await sgisRequest(authUrl);
  const token = auth.data.result && typeof auth.data.result === "object" ? String((auth.data.result as Record<string, unknown>).accessToken ?? "") : "";
  if (!token) throw new ExternalDataError("UPSTREAM_ERROR", "SGIS 인증 응답에 accessToken이 없습니다.", auth.status);
  const query = async (path: string) => {
    const url = new URL(`https://sgisapi.kostat.go.kr/OpenAPI3/stats/${path}.json`);
    url.searchParams.set("accessToken", token);
    url.searchParams.set("year", "2020");
    url.searchParams.set("adm_cd", administrativeCode);
    url.searchParams.set("low_search", "0");
    return sgisRequest(url);
  };
  const [population, household, company] = await Promise.allSettled([query("population"), query("household"), query("company")]);
  const extract = (label: string, result: PromiseSettledResult<{ data: Record<string, unknown>; status: number }>) => result.status === "fulfilled" ? { rows: result.value.data.result ?? [], warning: undefined } : { rows: [], warning: `${label}: ${result.reason instanceof Error ? result.reason.message : "응답을 확인하지 못했습니다."}` };
  const populationResult = extract("인구", population);
  const householdResult = extract("가구", household);
  const companyResult = extract("사업체", company);
  const unavailableSections = [populationResult.warning, householdResult.warning, companyResult.warning].filter((message): message is string => Boolean(message));
  if (unavailableSections.length === 3) throw new ExternalDataError("UPSTREAM_ERROR", `SGIS 통계 결과를 가져오지 못했습니다. ${unavailableSections.join(" / ")}`);
  return { data: { administrativeCode, baseYear: 2020, population: populationResult.rows, household: householdResult.rows, company: companyResult.rows, unavailableSections }, sourceUrl: "https://sgis.mods.go.kr/developer/html/openApi/api/data.html", status: 200 };
}

function getPublicDataError(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const response = "response" in data && data.response && typeof data.response === "object" ? data.response as Record<string, unknown> : data as Record<string, unknown>;
  const header = response.header && typeof response.header === "object" ? response.header as Record<string, unknown> : response.cmmMsgHeader && typeof response.cmmMsgHeader === "object" ? response.cmmMsgHeader as Record<string, unknown> : null;
  const code = String(header?.resultCode ?? header?.returnReasonCode ?? response.ERROR_CODE ?? "");
  const message = String(header?.resultMsg ?? header?.errMsg ?? header?.returnAuthMsg ?? response.ERROR_MSG ?? "");
  return code && !["0", "00", "NORMAL_CODE"].includes(code) ? { code, message } : null;
}

async function publicDataRequest(provider: Provider, endpoint: string, params: Record<string, string | number | undefined>, responseFormat: "json" | "xml" = "json") {
  const key = await getProviderKey(provider);
  const url = new URL(endpoint);
  Object.entries(params).forEach(([name, value]) => {
    if (value !== undefined && value !== "") url.searchParams.set(name, String(value));
  });
  url.searchParams.set("serviceKey", key);
  if (responseFormat === "json") url.searchParams.set("returnType", "json");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json, application/xml;q=0.9" } });
    const body = await response.text();
    if (!response.ok) throw new ExternalDataError("UPSTREAM_ERROR", `외부 데이터 서비스가 ${response.status} 상태로 응답했습니다.`, response.status);
    let data: unknown;
    try { data = JSON.parse(body); } catch { data = parser.parse(body); }
    const upstreamError = getPublicDataError(data);
    if (upstreamError) throw new ExternalDataError("UPSTREAM_ERROR", `외부 데이터 서비스가 요청을 거부했습니다: ${upstreamError.message || upstreamError.code}`, response.status);
    return { data, sourceUrl: url.origin + url.pathname, status: response.status };
  } catch (error) {
    if (error instanceof ExternalDataError) throw error;
    throw new ExternalDataError("UNAVAILABLE", `외부 데이터 서비스 연결에 실패했습니다: ${compactError(error instanceof Error ? error.message : "알 수 없는 오류")}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchLandUse(input: { areaCd: string; ucodeList: string; landUseNm: string }) {
  if (!input.areaCd.trim() || !input.ucodeList.trim() || !input.landUseNm.trim()) {
    throw new ExternalDataError("BAD_REQUEST", "토지이용규제 행위제한정보 조회에는 시군구 코드, 지역지구 코드, 토지이용행위명이 모두 필요합니다.");
  }
  return publicDataRequest("dataGoKr", "https://apis.data.go.kr/1613000/arLandUseInfoService/DTarLandUseInfo", { areaCd: input.areaCd.trim(), ucodeList: input.ucodeList.trim(), landUseNm: input.landUseNm.trim() }, "xml");
}

export async function fetchAirQuality(stationName: string) {
  if (!stationName.trim()) throw new ExternalDataError("BAD_REQUEST", "대기질 조회에는 인근 측정소명이 필요합니다. 예: 서석동, 운암동");
  return publicDataRequest("dataGoKr", "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty", { stationName, dataTerm: "DAILY", numOfRows: 5, pageNo: 1, returnType: "json" });
}

export async function fetchAirStations(address: string) {
  if (!address.trim()) throw new ExternalDataError("BAD_REQUEST", "측정소 검색에는 시·도 또는 시·군·구 주소가 필요합니다.");
  return publicDataRequest("dataGoKr", "https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getMsrstnList", { addr: address.trim(), numOfRows: 100, pageNo: 1, returnType: "json" });
}

export async function fetchGwangjuStations() {
  return publicDataRequest("dataGoKr", "https://apis.data.go.kr/6290000/gj_bis/stationInfo", { resultType: "json" });
}

export async function fetchGwangjuArrivals(busStopId: string) {
  if (!busStopId) throw new ExternalDataError("BAD_REQUEST", "도착정보 조회에는 정류장 ID가 필요합니다.");
  return publicDataRequest("dataGoKr", "https://apis.data.go.kr/6290000/gj_bis/arriveInfo", { BUSSTOP_ID: busStopId, resultType: "json" });
}

export async function fetchWelfareFacilities(districtName: string) {
  if (!districtName) throw new ExternalDataError("BAD_REQUEST", "복지시설 조회에는 시·군·구 명칭이 필요합니다.");
  return publicDataRequest("dataGoKr", "https://apis.data.go.kr/B554287/sclWlfrFcltInfoInqirService1/getFcltListInfoInqire", { jrsdSggNm: districtName, pageNo: 1, numOfRows: 100 });
}

export async function fetchCommerceInRadius(latitude: number, longitude: number, radiusMeters: number) {
  return publicDataRequest("dataGoKr", "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius", { radius: Math.min(radiusMeters, 2000), cx: longitude, cy: latitude, pageNo: 1, numOfRows: 100, type: "json" });
}

export async function fetchCityParks() {
  return publicDataRequest("dataGoKr", "https://api.data.go.kr/openapi/tn_pubr_public_cty_park_info_api", { pageNo: 1, numOfRows: 100, type: "json" });
}
