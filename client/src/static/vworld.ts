import type { SpatialGeometry } from "./model";

export type VworldParcelCandidate = { pnu?: string; parcelNumber?: string; landCategory?: string; areaSqm?: string };
export type VworldWfsFeature = { id?: string; geometry?: SpatialGeometry; properties: Record<string, unknown> };

export function currentVworldDomain() {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  return url.toString();
}

function requestDomain(domain?: string) { return domain?.trim() || currentVworldDomain(); }

function apiErrorMessage(payload: unknown) {
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const response = root.response && typeof root.response === "object" ? root.response as Record<string, unknown> : root;
  const error = response.error;
  if (response.status === "ERROR" || error) {
    if (typeof error === "string") return `VWorld_ERROR: ${error}`;
    const details = error && typeof error === "object" ? error as Record<string, unknown> : {};
    const code = typeof details.code === "string" ? details.code : "VWorld_ERROR";
    const text = typeof details.text === "string" ? details.text : "VWorld API가 오류를 반환했습니다.";
    return `${code}: ${text}`;
  }
  return undefined;
}

type JsonpPayload = (payload: unknown) => void;

function jsonp(url: string, parameter = "callback") {
  return new Promise<unknown>((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") return reject(new Error("브라우저 환경에서만 VWorld 직접 조회를 사용할 수 있습니다."));
    const callbackName = `__vworld_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");
    const callbackWindow = window as unknown as Window & Record<string, JsonpPayload>;
    let timer: number | undefined;
    const cleanup = () => { if (timer) window.clearTimeout(timer); delete callbackWindow[callbackName]; script.remove(); };
    callbackWindow[callbackName] = payload => { cleanup(); resolve(payload); };
    script.onerror = () => { cleanup(); reject(new Error("VWorld 브라우저 직접 조회 스크립트를 불러오지 못했습니다.")); };
    script.src = `${url}${url.includes("?") ? "&" : "?"}${parameter}=${encodeURIComponent(callbackName)}`;
    document.head.appendChild(script);
    timer = window.setTimeout(() => { cleanup(); reject(new Error("VWorld 브라우저 직접 조회 응답 시간이 초과되었습니다.")); }, 20000);
  });
}

function wfsJsonp(url: string) {
  return new Promise<unknown>((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") return reject(new Error("브라우저 환경에서만 VWorld WFS를 사용할 수 있습니다."));
    const callbackName = `__vworld_wfs_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");
    const callbackWindow = window as unknown as Window & Record<string, JsonpPayload>;
    let timer: number | undefined;
    const cleanup = () => { if (timer) window.clearTimeout(timer); delete callbackWindow[callbackName]; script.remove(); };
    callbackWindow[callbackName] = payload => { cleanup(); resolve(payload); };
    script.onerror = () => { cleanup(); reject(new Error("VWorld WFS 브라우저 직접 조회 스크립트를 불러오지 못했습니다.")); };
    script.src = `${url}${url.includes("?") ? "&" : "?"}format_options=callback:${callbackName}`;
    document.head.appendChild(script);
    timer = window.setTimeout(() => { cleanup(); reject(new Error("VWorld WFS 응답 시간이 초과되었습니다.")); }, 20000);
  });
}

function unwrapFeatureCollection(payload: unknown): Record<string, unknown> {
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const response = root.response && typeof root.response === "object" ? root.response as Record<string, unknown> : root;
  const result = response.result && typeof response.result === "object" ? response.result as Record<string, unknown> : response;
  return result.featureCollection && typeof result.featureCollection === "object" ? result.featureCollection as Record<string, unknown> : result;
}

export function normalizeVworldWfsFeatures(payload: unknown): VworldWfsFeature[] {
  const collection = unwrapFeatureCollection(payload);
  const features = Array.isArray(collection.features) ? collection.features : [];
  return features.filter(feature => feature && typeof feature === "object").map(feature => {
    const item = feature as Record<string, unknown>;
    const geometry = item.geometry && typeof item.geometry === "object" && typeof (item.geometry as Record<string, unknown>).type === "string" ? item.geometry as SpatialGeometry : undefined;
    return { id: typeof item.id === "string" ? item.id : undefined, geometry, properties: item.properties && typeof item.properties === "object" ? item.properties as Record<string, unknown> : {} };
  });
}

function contextBbox(latitude: number, longitude: number, radiusMeters: number) {
  const safeRadius = Math.min(3000, Math.max(50, radiusMeters));
  const latDelta = safeRadius / 111320;
  const lngDelta = safeRadius / (111320 * Math.max(0.25, Math.cos(latitude * Math.PI / 180)));
  return { west: longitude - lngDelta, south: latitude - latDelta, east: longitude + lngDelta, north: latitude + latDelta };
}

export function normalizeVworldBrowserCandidates(payload: unknown): VworldParcelCandidate[] {
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const response = root.response && typeof root.response === "object" ? root.response as Record<string, unknown> : root;
  const result = response.result && typeof response.result === "object" ? response.result as Record<string, unknown> : response;
  const collection = result.featureCollection && typeof result.featureCollection === "object" ? result.featureCollection as Record<string, unknown> : result;
  const features = Array.isArray(collection.features) ? collection.features : [];
  return features.map(feature => {
    const properties = feature && typeof feature === "object" && (feature as Record<string, unknown>).properties && typeof (feature as Record<string, unknown>).properties === "object" ? (feature as Record<string, unknown>).properties as Record<string, unknown> : {};
    const get = (...keys: string[]) => keys.map(key => properties[key]).find(value => value !== undefined && value !== null && String(value).trim() !== "");
    return { pnu: get("pnu", "PNU", "pnu_cd") ? String(get("pnu", "PNU", "pnu_cd")) : undefined, parcelNumber: get("jibun", "JIBUN", "jibun_nm") ? String(get("jibun", "JIBUN", "jibun_nm")) : undefined, landCategory: get("jimok", "JIMOK", "lndcgr") ? String(get("jimok", "JIMOK", "lndcgr")) : undefined, areaSqm: get("area", "AREA", "pcl_area") ? String(get("area", "AREA", "pcl_area")) : undefined };
  });
}

export async function fetchVworldBrowserParcel(input: { key: string; latitude: number; longitude: number; domain?: string }) {
  if (!input.key.trim()) throw new Error("VWorld 인증키를 먼저 입력하세요.");
  const url = new URL("https://api.vworld.kr/req/data");
  url.search = new URLSearchParams({ service: "data", version: "2.0", request: "GetFeature", data: "LP_PA_CBND_BUBUN", format: "json", errorformat: "json", crs: "EPSG:4326", geometry: "true", attribute: "true", key: input.key.trim(), domain: requestDomain(input.domain), geomFilter: `POINT(${input.longitude} ${input.latitude})`, size: "12" }).toString();
  try {
    const body = await jsonp(url.toString());
    const apiError = apiErrorMessage(body);
    if (apiError) throw new Error(apiError);
    return normalizeVworldBrowserCandidates(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    if (/Failed to fetch|NetworkError/i.test(message)) throw new Error("브라우저에서 VWorld 응답을 읽지 못했습니다. GitHub Pages 도메인을 VWorld 인증키의 허용 도메인으로 등록한 뒤 다시 시도하세요.");
    throw new Error(message);
  }
}

export async function fetchVworldWfs(input: { key: string; typename: string; latitude: number; longitude: number; radiusMeters: number; maxFeatures?: number; domain?: string }) {
  if (!input.key.trim()) throw new Error("VWorld 인증키를 먼저 입력하세요.");
  const bbox = contextBbox(input.latitude, input.longitude, input.radiusMeters);
  const url = new URL("https://api.vworld.kr/req/wfs");
  // VWorld WFS 1.1.0의 BBOX는 위도·경도 순서로 전달한다.
  url.search = new URLSearchParams({ service: "WFS", version: "1.1.0", request: "GetFeature", key: input.key.trim(), domain: requestDomain(input.domain), typename: input.typename, output: "text/javascript", srsname: "EPSG:4326", bbox: `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`, maxfeatures: String(Math.min(1000, Math.max(1, input.maxFeatures ?? 1000))) }).toString();
  try {
    const payload = await wfsJsonp(url.toString());
    const apiError = apiErrorMessage(payload);
    if (apiError) throw new Error(apiError);
    const features = normalizeVworldWfsFeatures(payload);
    if (!features.length && typeof payload === "object" && payload !== null && JSON.stringify(payload).match(/error|exception|fail/i)) throw new Error("VWorld WFS가 오류 응답을 반환했습니다.");
    return { features, bbox, typename: input.typename };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    if (/Failed to fetch|NetworkError/i.test(message)) throw new Error("브라우저에서 VWorld WFS 응답을 읽지 못했습니다. GitHub Pages 도메인과 VWorld 인증키 허용 설정을 확인하세요.");
    throw new Error(message);
  }
}
