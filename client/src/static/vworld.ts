import type { BoundaryPoint, SpatialGeometry } from "./model";

export type VworldParcelCandidate = { featureId?: string; pnu?: string; parcelNumber?: string; landCategory?: string; areaSqm?: string; geometry?: SpatialGeometry; properties?: Record<string, unknown> };

export function parcelCandidateKey(candidate: VworldParcelCandidate) { return candidate.pnu || candidate.featureId || `${candidate.parcelNumber ?? "parcel"}-${candidate.landCategory ?? "unknown"}`; }

export function parcelGroupGeoJson(candidates: VworldParcelCandidate[]) {
  const polygons = candidates.flatMap(candidate => {
    const geometry = candidate.geometry;
    if (!geometry || !Array.isArray(geometry.coordinates)) return [];
    if (geometry.type === "Polygon") return [geometry.coordinates as number[][][]];
    if (geometry.type === "MultiPolygon") return geometry.coordinates as number[][][][];
    return [];
  });
  return polygons.length ? { type: "MultiPolygon" as const, coordinates: polygons } : undefined;
}

function normalizeCoordinates(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  if (value.length >= 2 && !Array.isArray(value[0]) && !Array.isArray(value[1])) {
    const x = Number(value[0]); const y = Number(value[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return value;
    if (Math.abs(x) > 180 || Math.abs(y) > 90) {
      const longitude = x / 20037508.34 * 180;
      const latitude = (Math.atan(Math.exp(y / 20037508.34 * Math.PI)) * 360 / Math.PI) - 90;
      return [longitude, latitude, ...value.slice(2)];
    }
    return value;
  }
  return value.map(normalizeCoordinates);
}

function normalizeGeometry(value: unknown): SpatialGeometry | undefined {
  if (!value || typeof value !== "object") return undefined;
  const geometry = value as Record<string, unknown>;
  if (typeof geometry.type !== "string") return undefined;
  return { ...geometry, coordinates: geometry.coordinates === undefined ? undefined : normalizeCoordinates(geometry.coordinates) } as SpatialGeometry;
}

type LngLat = [number, number];

function geometryRings(geometry?: SpatialGeometry): LngLat[][] {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  return polygons.flatMap(polygon => Array.isArray(polygon) ? polygon.slice(0, 1).map(ring => Array.isArray(ring) ? ring.map(pair => Array.isArray(pair) && pair.length >= 2 ? [Number(pair[0]), Number(pair[1])] as LngLat : null).filter((pair): pair is LngLat => pair !== null && Number.isFinite(pair[0]) && Number.isFinite(pair[1])) : []) : []);
}

export function candidateBoundary(candidate: VworldParcelCandidate): BoundaryPoint[] {
  const ring = geometryRings(candidate.geometry)[0] ?? [];
  const points = ring.map(pair => ({ lat: pair[1], lng: pair[0] }));
  const first = points[0]; const last = points[points.length - 1];
  return first && last && first.lat === last.lat && first.lng === last.lng ? points.slice(0, -1) : points;
}

function pointInRing(point: LngLat, ring: LngLat[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    const crosses = (yi > point[1]) !== (yj > point[1]) && point[0] < (xj - xi) * (point[1] - yi) / ((yj - yi) || Number.EPSILON) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function segmentsIntersect(a: LngLat, b: LngLat, c: LngLat, d: LngLat) {
  const cross = (p: LngLat, q: LngLat, r: LngLat) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const ab = cross(a, b, c); const ab2 = cross(a, b, d); const cd = cross(c, d, a); const cd2 = cross(c, d, b);
  const onSegment = (p: LngLat, q: LngLat, r: LngLat) => Math.min(p[0], r[0]) <= q[0] && q[0] <= Math.max(p[0], r[0]) && Math.min(p[1], r[1]) <= q[1] && q[1] <= Math.max(p[1], r[1]);
  const epsilon = 1e-12;
  return (ab * ab2 < -epsilon && cd * cd2 < -epsilon) || (Math.abs(ab) <= epsilon && onSegment(a, c, b)) || (Math.abs(ab2) <= epsilon && onSegment(a, d, b)) || (Math.abs(cd) <= epsilon && onSegment(c, a, d)) || (Math.abs(cd2) <= epsilon && onSegment(c, b, d));
}

export function parcelIntersectsBoundary(candidate: VworldParcelCandidate, boundary: BoundaryPoint[]) {
  if (boundary.length < 3) return true;
  const target = boundary.map(point => [point.lng, point.lat] as LngLat);
  return geometryRings(candidate.geometry).some(ring => {
    if (ring.length < 3) return false;
    if (ring.some(point => pointInRing(point, target)) || target.some(point => pointInRing(point, ring))) return true;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]; const b = ring[(i + 1) % ring.length];
      for (let j = 0; j < target.length; j++) if (segmentsIntersect(a, b, target[j], target[(j + 1) % target.length])) return true;
    }
    return false;
  });
}
export type VworldWfsFeature = { id?: string; geometry?: SpatialGeometry; properties: Record<string, unknown> };

export function normalizeVworldKey(value: string) {
  return value.replace(/^\uFEFF/, "").trim().replace(/^["'`]|["'`]$/g, "").replace(/\s+/g, "");
}

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
    const geometry = normalizeGeometry(item.geometry);
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
    const item = feature && typeof feature === "object" ? feature as Record<string, unknown> : {};
    const properties = item.properties && typeof item.properties === "object" ? item.properties as Record<string, unknown> : {};
    const get = (...keys: string[]) => keys.map(key => properties[key]).find(value => value !== undefined && value !== null && String(value).trim() !== "");
    const geometry = normalizeGeometry(item.geometry);
    return { featureId: typeof item.id === "string" ? item.id : undefined, pnu: get("pnu", "PNU", "pnu_cd") ? String(get("pnu", "PNU", "pnu_cd")) : undefined, parcelNumber: get("jibun", "JIBUN", "jibun_nm") ? String(get("jibun", "JIBUN", "jibun_nm")) : undefined, landCategory: get("jimok", "JIMOK", "lndcgr") ? String(get("jimok", "JIMOK", "lndcgr")) : undefined, areaSqm: get("area", "AREA", "pcl_area") ? String(get("area", "AREA", "pcl_area")) : undefined, geometry, properties };
  });
}

export async function fetchVworldDataFeatures(input: { key: string; data: string; latitude: number; longitude: number; radiusMeters?: number; boundary?: BoundaryPoint[]; domain?: string; size?: number }) {
  const key = normalizeVworldKey(input.key);
  if (!key) throw new Error("VWorld 인증키를 먼저 입력하세요.");
  const boundary = input.boundary && input.boundary.length >= 3 ? input.boundary : undefined;
  const bbox = boundary ? { west: Math.min(...boundary.map(point => point.lng)), south: Math.min(...boundary.map(point => point.lat)), east: Math.max(...boundary.map(point => point.lng)), north: Math.max(...boundary.map(point => point.lat)) } : input.radiusMeters ? contextBbox(input.latitude, input.longitude, input.radiusMeters) : undefined;
  const geomFilter = bbox ? `BOX(${bbox.west},${bbox.south},${bbox.east},${bbox.north})` : `POINT(${input.longitude} ${input.latitude})`;
  const url = new URL("https://api.vworld.kr/req/data");
  url.search = new URLSearchParams({ service: "data", version: "2.0", request: "GetFeature", data: input.data, format: "json", errorformat: "json", crs: "EPSG:4326", geometry: "true", attribute: "true", key, domain: requestDomain(input.domain), geomFilter, size: String(Math.min(200, Math.max(1, input.size ?? 200))) }).toString();
  try {
    const body = await jsonp(url.toString());
    const apiError = apiErrorMessage(body);
    if (apiError) throw new Error(apiError);
    return { features: normalizeVworldWfsFeatures(body), bbox, data: input.data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    if (/Failed to fetch|NetworkError/i.test(message)) throw new Error("브라우저에서 VWorld 공간정보 응답을 읽지 못했습니다. GitHub Pages 도메인과 VWorld 인증키 허용 설정을 확인하세요.");
    throw new Error(message);
  }
}

export async function fetchVworldBrowserParcel(input: { key: string; latitude: number; longitude: number; radiusMeters?: number; boundary?: BoundaryPoint[]; domain?: string }) {
  const key = normalizeVworldKey(input.key);
  if (!key) throw new Error("VWorld 인증키를 먼저 입력하세요.");
  const boundary = input.boundary && input.boundary.length >= 3 ? input.boundary : undefined;
  const bbox = boundary ? { west: Math.min(...boundary.map(point => point.lng)), south: Math.min(...boundary.map(point => point.lat)), east: Math.max(...boundary.map(point => point.lng)), north: Math.max(...boundary.map(point => point.lat)) } : input.radiusMeters ? contextBbox(input.latitude, input.longitude, input.radiusMeters) : undefined;
  const geomFilter = bbox ? `BOX(${bbox.west},${bbox.south},${bbox.east},${bbox.north})` : `POINT(${input.longitude} ${input.latitude})`;
  const url = new URL("https://api.vworld.kr/req/data");
  url.search = new URLSearchParams({ service: "data", version: "2.0", request: "GetFeature", data: "LP_PA_CBND_BUBUN", format: "json", errorformat: "json", crs: "EPSG:4326", geometry: "true", attribute: "true", key, domain: requestDomain(input.domain), geomFilter, size: bbox ? "200" : "12" }).toString();
  try {
    const body = await jsonp(url.toString());
    const apiError = apiErrorMessage(body);
    if (apiError) throw new Error(apiError);
    const candidates = normalizeVworldBrowserCandidates(body);
    return boundary ? candidates.filter(candidate => parcelIntersectsBoundary(candidate, boundary)) : candidates;
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    if (/Failed to fetch|NetworkError/i.test(message)) throw new Error("브라우저에서 VWorld 응답을 읽지 못했습니다. GitHub Pages 도메인을 VWorld 인증키의 허용 도메인으로 등록한 뒤 다시 시도하세요.");
    throw new Error(message);
  }
}

export async function fetchVworldBuildingUseWfs(input: { key: string; latitude: number; longitude: number; radiusMeters: number; maxFeatures?: number; domain?: string }) {
  const key = normalizeVworldKey(input.key);
  if (!key) throw new Error("VWorld 인증키를 먼저 입력하세요.");
  const bbox = contextBbox(input.latitude, input.longitude, input.radiusMeters);
  const url = new URL("https://api.vworld.kr/ned/wfs/getBuildingUseWFS");
  url.search = new URLSearchParams({ typename: "dt_d198", bbox: `${bbox.south},${bbox.west},${bbox.north},${bbox.east},EPSG:4326`, maxFeatures: String(Math.min(1000, Math.max(1, input.maxFeatures ?? 1000))), srsName: "EPSG:4326", output: "application/json", key, domain: requestDomain(input.domain) }).toString();
  try {
    const payload = await jsonp(url.toString());
    const apiError = apiErrorMessage(payload);
    if (apiError) throw new Error(apiError);
    const features = normalizeVworldWfsFeatures(payload);
    if (!features.length && typeof payload === "object" && payload !== null && JSON.stringify(payload).match(/exception|error|fail/i)) throw new Error("용도별건물정보 WFS가 오류 응답을 반환했습니다.");
    return { features, bbox, typename: "dt_d198" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    if (/Failed to fetch|NetworkError/i.test(message)) throw new Error("브라우저에서 용도별건물정보 WFS 응답을 읽지 못했습니다. VWorld 인증키와 허용 설정을 확인하세요.");
    throw new Error(message);
  }
}

export function mergeBuildingUseFeatures(base: VworldWfsFeature[], useFeatures: VworldWfsFeature[]) {
  const value = (feature: VworldWfsFeature, keys: string[]) => keys.map(key => Object.entries(feature.properties).find(([name]) => name.toLowerCase() === key.toLowerCase())?.[1]).find(item => item !== undefined && item !== null && String(item).trim() !== "");
  const useByKey = new Map<string, VworldWfsFeature>();
  useFeatures.forEach(feature => { const key = value(feature, ["bldrgst_pk", "bld_mng_no", "bldg_mng_no", "building_management_no", "건축물대장관리번호", "pnu", "gid"]) ?? feature.id; if (key) useByKey.set(String(key), feature); });
  return base.map(feature => { const key = value(feature, ["bldrgst_pk", "bld_mng_no", "bldg_mng_no", "building_management_no", "건축물대장관리번호", "pnu", "gid"]) ?? feature.id; const matched = key ? useByKey.get(String(key)) : undefined; return matched ? { ...feature, properties: { ...feature.properties, ...matched.properties } } : feature; });
}

export async function fetchVworldWfs(input: { key: string; typename: string; latitude: number; longitude: number; radiusMeters: number; maxFeatures?: number; domain?: string }) {
  const key = normalizeVworldKey(input.key);
  if (!key) throw new Error("VWorld 인증키를 먼저 입력하세요.");
  const bbox = contextBbox(input.latitude, input.longitude, input.radiusMeters);
  const url = new URL("https://api.vworld.kr/req/wfs");
  // VWorld WFS 1.1.0의 BBOX는 위도·경도 순서로 전달한다.
  url.search = new URLSearchParams({ service: "WFS", version: "1.1.0", request: "GetFeature", key, domain: requestDomain(input.domain), typename: input.typename, output: "text/javascript", srsname: "EPSG:4326", bbox: `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`, maxfeatures: String(Math.min(1000, Math.max(1, input.maxFeatures ?? 1000))) }).toString();
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
