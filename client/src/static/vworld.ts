export type VworldParcelCandidate = { pnu?: string; parcelNumber?: string; landCategory?: string; areaSqm?: string };

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

export async function fetchVworldBrowserParcel(input: { key: string; latitude: number; longitude: number }) {
  if (!input.key.trim()) throw new Error("VWorld 인증키를 먼저 입력하세요.");
  const url = new URL("https://api.vworld.kr/req/data");
  url.search = new URLSearchParams({ service: "data", request: "GetFeature", data: "LP_PA_CBND_BUBUN", format: "json", crs: "EPSG:4326", geometry: "true", attribute: "true", key: input.key.trim(), geomFilter: `POINT(${input.longitude} ${input.latitude})`, size: "12" }).toString();
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const body = await response.json();
    if (!response.ok) throw new Error(`VWorld가 ${response.status} 상태로 응답했습니다.`);
    return normalizeVworldBrowserCandidates(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    if (/Failed to fetch|NetworkError/i.test(message)) throw new Error("브라우저에서 VWorld 응답을 읽지 못했습니다. GitHub Pages 도메인을 VWorld 인증키의 허용 도메인으로 등록한 뒤 다시 시도하세요.");
    throw new Error(message);
  }
}
