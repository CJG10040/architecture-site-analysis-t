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
  return message.replace(/serviceKey=[^&\s]+/gi, "serviceKey=[REDACTED]").slice(0, 260);
}

async function getProviderKey(provider: Provider) {
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
      const payload = JSON.parse(rawValue) as { primary?: string };
      if (payload.primary?.trim()) return payload.primary.trim();
    } catch {
      // Legacy single-value credentials stay readable during the group-key migration.
      if (rawValue.trim()) return rawValue.trim();
    }
    throw new Error("credential primary value is empty");
  } catch {
    throw new ExternalDataError("UNAVAILABLE", "등록된 API 키를 안전하게 읽지 못했습니다. 관리자에게 키 재등록을 요청하세요.");
  }
}

async function publicDataRequest(provider: Provider, endpoint: string, params: Record<string, string | number | undefined>) {
  const key = await getProviderKey(provider);
  const url = new URL(endpoint);
  Object.entries(params).forEach(([name, value]) => {
    if (value !== undefined && value !== "") url.searchParams.set(name, String(value));
  });
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("returnType", "json");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json, application/xml;q=0.9" } });
    const body = await response.text();
    if (!response.ok) throw new ExternalDataError("UPSTREAM_ERROR", `외부 데이터 서비스가 ${response.status} 상태로 응답했습니다.`, response.status);
    try {
      return { data: JSON.parse(body), sourceUrl: url.origin + url.pathname, status: response.status };
    } catch {
      return { data: parser.parse(body), sourceUrl: url.origin + url.pathname, status: response.status };
    }
  } catch (error) {
    if (error instanceof ExternalDataError) throw error;
    throw new ExternalDataError("UNAVAILABLE", `외부 데이터 서비스 연결에 실패했습니다: ${compactError(error instanceof Error ? error.message : "알 수 없는 오류")}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchLandUse(pnu: string) {
  if (!pnu) throw new ExternalDataError("BAD_REQUEST", "토지이용규제 조회에는 PNU가 필요합니다. 대지의 지번을 확인한 뒤 다시 시도하세요.");
  return publicDataRequest("dataGoKr", "https://apis.data.go.kr/1613000/arLandUseInfoService/getLandUseInfo", { pnu, numOfRows: 100, pageNo: 1 });
}

export async function fetchAirQuality(stationName: string) {
  if (!stationName) throw new ExternalDataError("BAD_REQUEST", "대기질 조회에는 인근 측정소 선택이 필요합니다.");
  return publicDataRequest("dataGoKr", "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty", { stationName, dataTerm: "DAILY", numOfRows: 5, pageNo: 1, returnType: "json" });
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
