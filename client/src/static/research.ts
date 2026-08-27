import type { PublicServiceSettings, ResearchNote, SiteRecord } from "./model";
import { enrichVworldParcelCandidates, fetchVworldBrowserParcel, fetchVworldBuildingUseWfs, fetchVworldDataFeatures, fetchVworldWfs, mergeBuildingUseFeatures } from "./vworld";
import { fetchOsmHydrology, osmHydrologyQuery } from "./osm";

export type SourceId = "terrain" | "air" | "vworldParcel" | "cityParks" | "vworldBuildings" | "vworldRoads" | "vworldZoning" | "landRegulation" | "vworldWelfare" | "vworldTransit" | "vworldBusiness" | "vworldCulture" | "sgisPopulation" | "sgisBusiness" | "osmHydrology";
export type SourceDefinition = { id: SourceId; catalogId: string; title: string; source: string; lenses: string[]; needs: "none" | "vworldKey" | "dataGoKrKey" | "sgisKey"; limitation: string };
export const sourceCatalog: SourceDefinition[] = [
  { id: "terrain", catalogId: "elevation", title: "고도·지형 표본", source: "Open-Meteo Elevation API", lenses: ["지형·레벨"], needs: "none", limitation: "격자 고도는 옹벽·계단·정확한 설계 레벨을 대체하지 않습니다." },
  { id: "air", catalogId: "air-quality", title: "대기질·기상 표본", source: "Open-Meteo Air Quality API", lenses: ["지역 생활", "녹지·생태"], needs: "none", limitation: "예보·격자 표본이며 현장 체감·공식 측정소 확정값과 다를 수 있습니다." },
  { id: "vworldZoning", catalogId: "land-use-zoning", title: "용도지역·지구·구역 공간 표본", source: "VWorld 2D Data · LT_C_LHBLPN", lenses: ["필지·법규·경계"], needs: "vworldKey", limitation: "토지이용계획도 공간 표본이며 법규·인허가 결론을 대체하지 않습니다. 최신 고시·토지이음·관할기관 원문을 함께 확인해야 합니다." },
  { id: "landRegulation", catalogId: "land-regulation", title: "PNU 행위제한 원문 확인 패키지", source: "토지이음 · 국토교통부 토지이용규제정보", lenses: ["필지·법규·경계"], needs: "none", limitation: "자동 법규 판정이 아닙니다. PNU로 연결된 토지이음 원문·최신 고시·관할기관 확인을 사용자가 완료해야 합니다." },
  { id: "sgisPopulation", catalogId: "population-households", title: "SGIS 인구·가구·주택 통계", source: "SGIS 센서스 통계 API", lenses: ["사람·주거·생활"], needs: "sgisKey", limitation: "행정구역 또는 집계구 통계이며 필지 직접값이 아닙니다. 기준연도와 공간단위를 함께 확인해야 합니다." },
  { id: "sgisBusiness", catalogId: "businesses", title: "SGIS 사업체 통계", source: "SGIS 전국사업체조사 API", lenses: ["상업·생산·지역경제", "지역 생활"], needs: "sgisKey", limitation: "통계상 사업체와 현재 영업·시간대 활동은 다를 수 있습니다. 행정구역 통계의 공간단위를 표시합니다." },
  { id: "vworldWelfare", catalogId: "public-welfare", title: "복지·공공시설 공간 표본", source: "VWorld WFS · 복지시설 레이어", lenses: ["사람·주거·생활", "지역 생활"], needs: "vworldKey", limitation: "VWorld에 등록된 시설 레이어의 공간·속성 표본입니다. 운영 여부·이용 가능성·전체 시설 부재를 단정하지 않습니다." },
  { id: "vworldTransit", catalogId: "transit", title: "대중교통 노드 공간 표본", source: "VWorld WFS · lt_p_moctnode", lenses: ["이동·접근·시간"], needs: "vworldKey", limitation: "교통노드 위치·속성만 확인하며 노선 빈도·도보시간·실제 이용량은 별도 자료가 필요합니다." },
  { id: "vworldBusiness", catalogId: "businesses", title: "주요상권 공간 표본", source: "VWorld WFS · lt_c_dgmainbiz", lenses: ["상업·생산·지역경제", "지역 생활"], needs: "vworldKey", limitation: "주요상권 레이어는 전체 사업체·실제 영업·시간대 활동을 대체하지 않습니다." },
  { id: "vworldCulture", catalogId: "culture-heritage", title: "문화시설·도서관 공간 표본", source: "VWorld WFS · 박물관미술관·작은도서관", lenses: ["문화·기억·유휴"], needs: "vworldKey", limitation: "등록된 문화시설·도서관 표본이며 비공식 지역 기억과 실제 사용 흔적은 현장조사가 필요합니다." },
  { id: "vworldParcel", catalogId: "site-boundary", title: "연속지적도 필지 후보", source: "VWorld", lenses: ["지형·레벨", "프로그램·상권"], needs: "vworldKey", limitation: "브라우저 키 도메인 등록과 필지 후보의 사용자 확인이 필요합니다." },
  { id: "osmHydrology", catalogId: "hydrology", title: "하천·수계 공간 표본", source: "OpenStreetMap Overpass API · VWorld 수자원 보완", lenses: ["녹지·생태", "지형·레벨"], needs: "none", limitation: "OSM에 매핑된 수로·수면 표본입니다. 침수위험·배수능력·법정 하천경계는 판단하지 않으며 원자료와 OSM 기여자 출처를 함께 보존합니다." },
  { id: "vworldBuildings", catalogId: "buildings", title: "건축물 footprint 공간 표본", source: "VWorld WFS · lt_c_spbd", lenses: ["지형·레벨", "일조·차폐"], needs: "vworldKey", limitation: "현재는 조사 반경 내 공간객체 수와 속성 표본을 근거로 저장하며, 용도·층수의 완전한 결합은 추가 구현이 필요합니다." },
  { id: "vworldRoads", catalogId: "roads", title: "도로·교통링크 공간 표본", source: "VWorld WFS · lt_l_moctlink", lenses: ["보행·접근", "프로그램·상권"], needs: "vworldKey", limitation: "교통링크가 응답하지 않으면 도로중심선 fallback과 원본 응답 확인이 필요하며, 교통량은 별도 연결 전까지 미확인입니다." },
  { id: "cityParks", catalogId: "urban-parks", title: "도시공원·녹지 목록", source: "공공데이터포털 전국도시공원", lenses: ["녹지·생태", "보행·접근"], needs: "dataGoKrKey", limitation: "브라우저 CORS·서비스 활용 승인에 따라 원본 파일 불러오기로 대체될 수 있습니다." },
];

const id = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const siteRadius = (radiusMeters: number) => Math.min(3000, Math.max(50, radiusMeters));
const numericField = (item: Record<string, unknown>, keys: string[]) => { const value = keys.map(key => Object.entries(item).find(([name]) => name.toLowerCase() === key.toLowerCase())?.[1]).find(value => value !== undefined && value !== null && String(value).trim() !== ""); const number = Number(String(value ?? "").replace(/,/g, "")); return Number.isFinite(number) ? number : null; };
const serializeDetail = (value: unknown, limit = 450000) => { const raw = typeof value === "string" ? value : JSON.stringify(value, null, 2); return { rawData: raw.slice(0, limit), rawDataTruncated: raw.length > limit }; };
const note = (source: string, title: string, summary: string, url: string, location?: { latitude: number; longitude: number }, extras: Partial<ResearchNote> = {}): ResearchNote => ({ id: id(), source, title, summary, url, ...location, ...extras, createdAt: new Date().toISOString() });

export function suggestedSources(lenses: string[], selectedCatalogIds?: string[]) { return sourceCatalog.filter(source => (!selectedCatalogIds || selectedCatalogIds.includes(source.catalogId)) && (!lenses.length || source.lenses.some(lens => lenses.includes(lens)))); }
export function sourceAvailability(source: SourceDefinition, settings: PublicServiceSettings) { return source.needs === "none" || source.needs === "sgisKey" ? source.needs === "none" || Boolean(settings.sgisClientId && settings.sgisClientSecret) : Boolean(settings[source.needs]); }

async function fetchSgisStats(kind: "population" | "company", site: SiteRecord, settings: PublicServiceSettings) {
  if (!settings.sgisClientId || !settings.sgisClientSecret) throw new Error("SGIS Client ID와 Secret을 먼저 입력하세요.");
  const authUrl = new URL("https://sgisapi.mods.go.kr/OpenAPI3/auth/authentication.json");
  authUrl.search = new URLSearchParams({ consumer_key: settings.sgisClientId, consumer_secret: settings.sgisClientSecret }).toString();
  const authResponse = await fetch(authUrl); if (!authResponse.ok) throw new Error(`SGIS 인증 ${authResponse.status} 응답`); const authPayload = await authResponse.json(); const accessToken = authPayload?.result?.accessToken;
  if (authPayload?.errCd !== undefined && String(authPayload.errCd) !== "0") throw new Error(`SGIS 인증 오류 ${authPayload.errCd}: ${authPayload.errMsg || "원인 미상"}`);
  if (!accessToken) throw new Error(authPayload?.errMsg || "SGIS accessToken을 받지 못했습니다.");
  const addressUrl = new URL("https://sgisapi.mods.go.kr/OpenAPI3/addr/rgeocodewgs84.json");
  addressUrl.search = new URLSearchParams({ accessToken, x_coor: String(site.longitude), y_coor: String(site.latitude), addr_type: "21" }).toString();
  const addressResponse = await fetch(addressUrl); if (!addressResponse.ok) throw new Error(`SGIS 역지오코딩 ${addressResponse.status} 응답`); const addressPayload = await addressResponse.json(); if (addressPayload?.errCd !== undefined && String(addressPayload.errCd) !== "0") throw new Error(`SGIS 역지오코딩 오류 ${addressPayload.errCd}: ${addressPayload.errMsg || "원인 미상"}`); const addressRows = Array.isArray(addressPayload?.result) ? addressPayload.result : [];
  const address = addressRows[0] ?? {};
  const administrativeCodes = [address.adm_cd, address.emdong_cd, address.emd_cd, address.sgg_cd, address.sido_cd, address.cd].map(value => String(value ?? "").trim()).filter(value => /^(?:\d{2}|\d{5}|\d{7})$/.test(value));
  const admCode = administrativeCodes.sort((left, right) => right.length - left.length)[0];
  if (!admCode) throw new Error("SGIS 역지오코딩에서 유효한 2·5·7자리 행정구역 코드를 찾지 못했습니다.");
  const statsUrl = new URL(`https://sgisapi.mods.go.kr/OpenAPI3/stats/${kind}.json`);
  statsUrl.search = new URLSearchParams({ accessToken, year: "2020", adm_cd: admCode, low_search: "1" }).toString();
  const statsResponse = await fetch(statsUrl); if (!statsResponse.ok) throw new Error(`SGIS ${kind} ${statsResponse.status} 응답`); const payload = await statsResponse.json(); if (payload?.errCd !== undefined && String(payload.errCd) !== "0") throw new Error(`SGIS ${kind} 오류 ${payload.errCd}: ${payload.errMsg || "원인 미상"}`);
  return { payload, address: { ...address, adm_cd: admCode }, year: "2020" };
}

export async function collectSource(source: SourceDefinition, site: SiteRecord, settings: PublicServiceSettings, radiusMeters = 300): Promise<ResearchNote> {
  if (source.id === "terrain") {
    const url = new URL("https://api.open-meteo.com/v1/elevation"); url.search = new URLSearchParams({ latitude: String(site.latitude), longitude: String(site.longitude) }).toString();
    const response = await fetch(url); if (!response.ok) throw new Error(`Open-Meteo ${response.status} 응답`); const payload = await response.json(); const elevation = Array.isArray(payload.elevation) ? payload.elevation[0] : payload.elevation;
    return note(source.source, source.title, `대지 중심점(${site.latitude.toFixed(5)}, ${site.longitude.toFixed(5)})의 DEM 고도 표본은 ${elevation ?? "미확인"}m입니다. ${source.limitation}`, "https://open-meteo.com/", site, { catalogId: source.catalogId, detail: `Open-Meteo 원본 응답과 계산 대상 좌표입니다.\n${JSON.stringify(payload, null, 2)}`, ...serializeDetail(payload) });
  }
  if (source.id === "air") {
    const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality"); url.search = new URLSearchParams({ latitude: String(site.latitude), longitude: String(site.longitude), current: "pm10,pm2_5,carbon_monoxide,nitrogen_dioxide", timezone: "Asia/Seoul" }).toString();
    const response = await fetch(url); if (!response.ok) throw new Error(`Open-Meteo 대기질 ${response.status} 응답`); const payload = await response.json(); const current = payload.current ?? {};
    return note(source.source, source.title, `대지 중심 격자 표본: PM10 ${current.pm10 ?? "미확인"} μg/m³, PM2.5 ${current.pm2_5 ?? "미확인"} μg/m³, NO₂ ${current.nitrogen_dioxide ?? "미확인"} μg/m³. ${source.limitation}`, "https://open-meteo.com/en/docs/air-quality-api", site, { catalogId: source.catalogId, detail: `Open-Meteo 원본 응답입니다.\n${JSON.stringify(payload, null, 2)}`, ...serializeDetail(payload) });
  }
  if (source.id === "osmHydrology") {
    const result = await fetchOsmHydrology(site.latitude, site.longitude, radiusMeters);
    const names = result.features.map(feature => feature.properties.name || feature.properties.waterway || feature.properties.natural).filter(Boolean).slice(0, 8).join(", ");
    return note(source.source, source.title, `대지 중심점 ${siteRadius(radiusMeters)}m BBOX에서 OSM 수로·수면 공간객체 ${result.features.length.toLocaleString("ko-KR")}개를 추출했습니다.${names ? ` 표본 명칭: ${names}.` : ""} 침수·배수·법정 하천경계는 별도 확인이 필요합니다.`, "https://www.openstreetmap.org/", { latitude: site.latitude, longitude: site.longitude }, { catalogId: source.catalogId, detail: `OpenStreetMap Overpass 원본 응답과 요청 범위입니다.\nendpoint: ${result.endpoint}\nquery:\n${JSON.stringify(result.raw, null, 2)}`, ...serializeDetail({ endpoint: result.endpoint, query: osmHydrologyQuery(site.latitude, site.longitude, radiusMeters), response: result.raw }), spatialLayer: { id: source.id, title: source.title, source: source.source, fetchedAt: new Date().toISOString(), features: result.features.slice(0, 300), totalFeatureCount: result.features.length, truncated: result.features.length > 300 } });
  }
  if (source.id === "sgisPopulation" || source.id === "sgisBusiness") {
    const kind = source.id === "sgisPopulation" ? "population" : "company";
    const result = await fetchSgisStats(kind, site, settings);
    const payloadRecord = result.payload && typeof result.payload === "object" ? result.payload as Record<string, unknown> : {};
    const dataRoot = payloadRecord.result ?? result.payload;
    const resultKeys = Array.isArray(dataRoot) ? Object.keys(dataRoot[0] && typeof dataRoot[0] === "object" ? dataRoot[0] as Record<string, unknown> : {}).join(", ") : dataRoot && typeof dataRoot === "object" ? Object.keys(dataRoot as Record<string, unknown>).join(", ") : "응답 구조 미확인";
    const resultCount = Array.isArray(dataRoot) ? dataRoot.length : "집계 결과";
    return note(source.source, source.title, `대지 중심점의 SGIS 역지오코딩 행정구역 ${result.address.adm_cd} 기준 ${result.year}년 ${kind === "population" ? "인구·가구·주택" : "사업체"} 통계를 조회했습니다. 행정구역·집계구 통계이며 필지 직접값이 아닙니다. 통계 결과 ${resultCount}건 · 주요 필드: ${resultKeys || "응답 구조 미확인"}. ${source.limitation}`,  "https://sgis.mods.go.kr/developer/html/newOpenApi/api/dataApi/census.html", { latitude: site.latitude, longitude: site.longitude }, { catalogId: source.catalogId, detail: `SGIS 역지오코딩 결과의 행정구역 코드와 통계 원본 응답입니다.\n${JSON.stringify({ address: result.address, year: result.year, statistics: result.payload }, null, 2)}`, ...serializeDetail({ address: result.address, year: result.year, statistics: result.payload }) });
  }
  if (source.id === "landRegulation") {
    const pnus = Array.from(new Set([site.pnu, ...(site.parcels ?? []).map(parcel => parcel.pnu)].filter((value): value is string => Boolean(value))));
    if (!pnus.length) throw new Error("행위제한 원문 확인에는 먼저 확정 필지의 PNU가 필요합니다.");
    const officialUrl = `https://www.eum.go.kr/web/ar/lu/luLandDet.jsp?isNoScr=script&mode=search&pnu=${encodeURIComponent(pnus[0])}`;
    const checklist = { pnu: pnus, officialUrl, checkedItems: ["지역·지구 등 지정 내용", "행위제한 내용과 행위가능 여부", "건폐율·용적률", "층수·높이 제한", "건축선·도로조건", "최신 고시·조례·관할기관 확인"], warning: "이 패키지는 확인할 원문과 체크 항목을 생성할 뿐 법규 적합성이나 인허가를 판정하지 않습니다." };
    const raw = JSON.stringify(checklist, null, 2);
    return note(source.source, source.title, `확정 PNU ${pnus.join(", ")}에 대한 토지이음 원문 확인 링크와 검토 항목을 만들었습니다. 법규 판단은 아직 미완료입니다.`, officialUrl, { latitude: site.latitude, longitude: site.longitude }, { catalogId: source.catalogId, detail: `PNU 기반 행위제한 원문 확인 패키지입니다. 사용자가 토지이음 원문을 열어 각 항목을 확인하고 결과를 추가 기록해야 합니다.\n${raw}`, rawData: raw });
  }
  if (["vworldWelfare", "vworldTransit", "vworldBusiness", "vworldCulture"].includes(source.id)) {
    const layerSets: Record<string, string[]> = { vworldWelfare: ["lt_p_mgprtfa", "lt_p_mgprtfb", "lt_p_mgprtfc", "lt_p_mgprtfd"], vworldTransit: ["lt_p_moctnode"], vworldBusiness: ["lt_c_dgmainbiz"], vworldCulture: ["lt_p_dgmuseumart", "lt_p_smalllibrary"] };
    const typenames = layerSets[source.id];
    const results = await Promise.all(typenames.map(async typename => { try { const fetched = await fetchVworldWfs({ key: settings.vworldKey, domain: settings.vworldDomain, typename, latitude: site.latitude, longitude: site.longitude, radiusMeters: siteRadius(radiusMeters) }); return { typename, features: fetched.features, bbox: fetched.bbox }; } catch (error) { return { typename, features: [], error: error instanceof Error ? error.message : "원인 미상", bbox: undefined }; } }));
    const features = results.flatMap(result => result.features.map(feature => ({ ...feature, properties: { ...feature.properties, _vworldLayer: result.typename } })));
    const errors = results.filter(result => "error" in result && result.error).map(result => `${result.typename}: ${result.error}`);
    if (!features.length && errors.length === results.length) throw new Error(`선택한 VWorld 생활권 레이어를 모두 읽지 못했습니다. ${errors.join(" / ")}`);
    const propertyNames = Array.from(new Set(features.flatMap(feature => Object.keys(feature.properties).filter(name => name !== "_vworldLayer")))).slice(0, 16).join(", ");
    const spatialFeatures = features.filter(feature => feature.geometry).slice(0, 300).map((feature, index) => ({ id: feature.id ?? `${source.id}-${index + 1}`, geometry: feature.geometry!, properties: feature.properties }));
    const noteRecord = note(source.source, source.title, `조사 반경 ${siteRadius(radiusMeters)}m 내 ${typenames.join(", ")} 레이어에서 공간객체 ${features.length.toLocaleString("ko-KR")}개를 확인했습니다. ${errors.length ? `실패 레이어 ${errors.length}개. ` : ""}속성 표본: ${propertyNames || "응답 속성 없음"}. ${source.limitation}`, "https://vworld.kr/dev/v4dv_wmsguide2_s001.do", { latitude: site.latitude, longitude: site.longitude }, { catalogId: source.catalogId, detail: `VWorld 생활권 레이어 원본 feature입니다.\n${JSON.stringify({ results, features }, null, 2)}`, ...serializeDetail({ results, features }), spatialLayer: { id: source.id, title: source.title, source: source.source, fetchedAt: new Date().toISOString(), features: spatialFeatures, totalFeatureCount: features.length, truncated: features.length > spatialFeatures.length } });
    return noteRecord;
  }
  if (source.id === "vworldZoning") {
    const result = await fetchVworldDataFeatures({ key: settings.vworldKey, domain: settings.vworldDomain, data: "LT_C_LHBLPN", latitude: site.latitude, longitude: site.longitude, radiusMeters: siteRadius(radiusMeters), boundary: site.boundary, size: 200 });
    const propertyNames = Array.from(new Set(result.features.flatMap(feature => Object.keys(feature.properties)))).slice(0, 16).join(", ");
    const spatialFeatures = result.features.filter(feature => feature.geometry).slice(0, 300).map((feature, index) => ({ id: feature.id ?? `zoning-${index + 1}`, geometry: feature.geometry!, properties: feature.properties }));
    return note(source.source, source.title, `대지 ${site.boundary.length >= 3 ? "경계 BBOX" : `${siteRadius(radiusMeters)}m 반경`} 내 토지이용계획 객체 ${result.features.length.toLocaleString("ko-KR")}개. 속성 표본: ${propertyNames || "응답 속성 없음"}. ${source.limitation}`, "https://www.data.go.kr/data/15058773/openapi.do", { latitude: site.latitude, longitude: site.longitude }, { catalogId: source.catalogId, detail: `VWorld LT_C_LHBLPN 원본 feature의 속성·geometry 상세입니다.\n${JSON.stringify(result.features, null, 2)}`, ...serializeDetail(result.features), spatialLayer: { id: source.id, title: source.title, source: source.source, fetchedAt: new Date().toISOString(), features: spatialFeatures, totalFeatureCount: result.features.length, truncated: result.features.length > spatialFeatures.length } });
  }
  if (source.id === "vworldParcel") {
    const candidates = await fetchVworldBrowserParcel({ key: settings.vworldKey, domain: settings.vworldDomain, latitude: site.latitude, longitude: site.longitude, radiusMeters, boundary: site.boundary });
    const enriched = await enrichVworldParcelCandidates(candidates, { key: settings.vworldKey, domain: settings.vworldDomain });
    const first = enriched[0]; if (!first) throw new Error("현재 중심점의 VWorld 필지 후보를 찾지 못했습니다.");
    return note(source.source, source.title, `PNU ${first.pnu ?? "미확인"}, 지번 ${first.parcelNumber ?? "미확인"}, 지목 ${first.landCategory ?? "속성 조회 필요"}, 면적 ${first.areaSqm ? `${first.areaSqm}㎡` : "geometry 면적 미확인"}, 소재지 ${first.parcelAddress ?? "미확인"}${first.publicPriceWonPerSqm ? `, 개별공시지가 ${first.publicPriceWonPerSqm}원/㎡` : ""}. ${source.limitation}`, "https://www.data.go.kr/data/15123884/openapi.do", { latitude: site.latitude, longitude: site.longitude }, { catalogId: source.catalogId, detail: `연속지적도 후보와 PNU 기반 토지임야정보 속성입니다.\n${JSON.stringify(enriched, null, 2)}`, ...serializeDetail(enriched) });
  }
  if (source.id === "vworldBuildings" || source.id === "vworldRoads") {
    const typename = source.id === "vworldBuildings" ? "lt_c_spbd" : "lt_l_moctlink";
    const result = await fetchVworldWfs({ key: settings.vworldKey, domain: settings.vworldDomain, typename, latitude: site.latitude, longitude: site.longitude, radiusMeters: siteRadius(radiusMeters) });
    let features = result.features;
    let useFeatures = [] as typeof result.features;
    let useStatus = "";
    if (source.id === "vworldBuildings") {
      try { const useResult = await fetchVworldBuildingUseWfs({ key: settings.vworldKey, domain: settings.vworldDomain, latitude: site.latitude, longitude: site.longitude, radiusMeters: siteRadius(radiusMeters) }); useFeatures = useResult.features; features = mergeBuildingUseFeatures(result.features, useFeatures); useStatus = `용도별건물정보 ${useFeatures.length.toLocaleString("ko-KR")}개를 식별자 후보로 결합 시도`; }
      catch (error) { useStatus = `용도별건물정보 보강 실패 · footprint 자료만 사용 · ${error instanceof Error ? error.message : "원인 미상"}`; }
    }
    const propertyNames = Array.from(new Set(features.flatMap(feature => Object.keys(feature.properties)))).slice(0, 16).join(", ");
    const spatialFeatures = features.filter(feature => feature.geometry).slice(0, 300).map((feature, index) => ({ id: feature.id ?? `${source.id}-${index + 1}`, geometry: feature.geometry!, properties: feature.properties }));
    const record = note(source.source, source.title, `조사 반경 ${siteRadius(radiusMeters)}m 내 WFS 객체 ${features.length.toLocaleString("ko-KR")}개. 지도에는 공간자료 ${spatialFeatures.length.toLocaleString("ko-KR")}개를 표시합니다. 속성 표본: ${propertyNames || "응답 속성 없음"}. ${useStatus ? `${useStatus}. ` : ""}${source.limitation}`, source.id === "vworldBuildings" ? "https://www.data.go.kr/data/15123458/openapi.do" : "https://www.its.go.kr/nodelink/", { latitude: site.latitude, longitude: site.longitude }, { catalogId: source.catalogId, detail: `footprint WFS 원본 feature의 속성·geometry 상세입니다.\n${JSON.stringify(features, null, 2)}${useFeatures.length ? `\n\n용도별건물정보 WFS 원본 feature입니다.\n${JSON.stringify(useFeatures, null, 2)}` : ""}`, ...serializeDetail({ footprint: features, buildingUse: useFeatures, useStatus }) });
    record.spatialLayer = { id: source.id, title: source.title, source: source.source, fetchedAt: record.createdAt, features: spatialFeatures, totalFeatureCount: result.features.length, truncated: result.features.length > spatialFeatures.length };
    return record;
  }
  const url = new URL("https://api.data.go.kr/openapi/tn_pubr_public_cty_park_info_api");
  url.search = new URLSearchParams({ serviceKey: settings.dataGoKrKey, pageNo: "1", numOfRows: "1000", type: "json" }).toString();
  const response = await fetch(url); if (!response.ok) throw new Error(`공공데이터포털 ${response.status} 응답`); const payload = await response.json(); const items = payload?.response?.body?.items ?? [];
  const allItems = (Array.isArray(items) ? items : []) as Record<string, unknown>[];
  const distance = (item: Record<string, unknown>) => { const latitude = numericField(item, ["latitude", "lat", "위도", "wgs84위도", "wgs84lat"]); const longitude = numericField(item, ["longitude", "lon", "lng", "경도", "wgs84경도", "wgs84lon"]); if (latitude === null || longitude === null) return null; const dLat = (latitude - site.latitude) * Math.PI / 180; const dLng = (longitude - site.longitude) * Math.PI / 180; const a = Math.sin(dLat / 2) ** 2 + Math.cos(site.latitude * Math.PI / 180) * Math.cos(latitude * Math.PI / 180) * Math.sin(dLng / 2) ** 2; return 6371008.8 * 2 * Math.asin(Math.min(1, Math.sqrt(a))); };
  const nearbyItems = allItems.filter(item => { const d = distance(item); return d !== null && d <= siteRadius(radiusMeters); });
  const features = nearbyItems.map((item, index) => { const latitude = numericField(item, ["latitude", "lat", "위도", "wgs84위도", "wgs84lat"]); const longitude = numericField(item, ["longitude", "lon", "lng", "경도", "wgs84경도", "wgs84lon"]); return latitude === null || longitude === null ? null : { id: `park-${index + 1}`, geometry: { type: "Point", coordinates: [longitude, latitude] }, properties: item }; }).filter((feature): feature is { id: string; geometry: { type: string; coordinates: number[] }; properties: Record<string, unknown> } => feature !== null);
  const names = nearbyItems.slice(0, 8).map(item => item.parkNm ?? item.공원명).filter(Boolean);
  const record = note(source.source, source.title, `공공데이터포털 ${allItems.length.toLocaleString("ko-KR")}개 응답 중 좌표가 있고 조사반경 ${siteRadius(radiusMeters)}m 이내인 공원 ${nearbyItems.length.toLocaleString("ko-KR")}개를 분리했습니다. ${names.length ? `표본: ${names.join(", ")}. ` : ""}${source.limitation}`, "https://www.data.go.kr/", { latitude: site.latitude, longitude: site.longitude }, { catalogId: source.catalogId, detail: `공공데이터포털 공원 원본 응답입니다. 좌표 필터 결과는 geometry로 별도 저장했습니다.\n${JSON.stringify(payload, null, 2)}`, ...serializeDetail(payload), spatialLayer: { id: source.id, title: source.title, source: source.source, fetchedAt: new Date().toISOString(), features, totalFeatureCount: nearbyItems.length, truncated: allItems.length > nearbyItems.length } });
  return record;
}

export function detailedResearchNote(catalogId: string, title: string, detail: string, site: SiteRecord) {
  const preview = detail.replace(/\s+/g, " ").trim().slice(0, 900);
  return note("사용자 상세 조사", title, preview || "상세 조사 내용 없음", "", { latitude: site.latitude, longitude: site.longitude }, { catalogId, detail, ...serializeDetail(detail) });
}

export async function researchNoteFromFile(file: File, context?: { catalogId?: string; title?: string; site?: SiteRecord }): Promise<ResearchNote> {
  const text = await file.text(); const preview = text.replace(/\s+/g, " ").trim().slice(0, 900);
  return note(`사용자 원본 파일 · ${file.name}`, context?.title ?? "외부 데이터 응답 가져오기", `${file.size.toLocaleString("ko-KR")} bytes · ${file.type || "알 수 없는 형식"}. 원문 앞부분: ${preview || "내용 없음"}`, "", context?.site ? { latitude: context.site.latitude, longitude: context.site.longitude } : undefined, { catalogId: context?.catalogId, detail: text, ...serializeDetail(text) });
}
