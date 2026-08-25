import type { LocalProject } from "./model";

export type ResearchCatalogStatus = "implemented" | "partial" | "planned" | "field";
export type ResearchCatalogPriority = "P0" | "P1" | "P2";
export type ResearchScale = "macro" | "meso" | "site" | "micro";

export type ResearchCatalogItem = {
  id: string;
  category: string;
  title: string;
  source: string;
  role: string;
  unit: string;
  status: ResearchCatalogStatus;
  priority: ResearchCatalogPriority;
  lenses: string[];
  limitation: string;
  officialUrl?: string;
};

export type ResearchTheme = { id: string; scale: ResearchScale; title: string; description: string; catalogIds: string[] };

export const researchThemes: ResearchTheme[] = [
  { id: "macro-region", scale: "macro", title: "거시 · 지역·도시 맥락", description: "행정·인구·산업·교통·문화·환경의 큰 흐름에서 대지가 어떤 지역 구조에 놓이는지 읽습니다.", catalogIds: ["population-households", "businesses", "transit", "culture-heritage", "hydrology", "imagery-change"] },
  { id: "meso-life", scale: "meso", title: "중간 · 생활권·접근 구조", description: "도보권·생활시설·공원·도로·상권의 관계를 대지 주변 생활권으로 좁혀 읽습니다.", catalogIds: ["urban-parks", "transit", "businesses", "public-welfare", "roads", "air-quality", "noise"] },
  { id: "site-form", scale: "site", title: "대지 · 필지·법규·형태", description: "선택한 필지와 주변 건축물·도로·용도지역·행위제한을 설계 가능한 대지 조건으로 좁혀 읽습니다.", catalogIds: ["site-boundary", "land-use-zoning", "land-regulation", "buildings", "roads", "hydrology"] },
  { id: "micro-field", scale: "micro", title: "미시 · 현장·감각·접촉면", description: "출입구·경계·소리·빛·냄새·체류·회피처럼 데이터가 놓치기 쉬운 실제 경험을 기록합니다.", catalogIds: ["field-observation", "noise", "culture-heritage", "buildings", "site-boundary"] },
];

export function defaultResearchPlan() {
  return { selectedThemeIds: researchThemes.map(theme => theme.id), selectedCatalogIds: Array.from(new Set(researchThemes.flatMap(theme => theme.catalogIds))).filter(id => researchCatalog.some(item => item.id === id && item.priority !== "P2")) };
}

export function catalogScale(itemId: string): ResearchScale {
  if (researchThemes.find(theme => theme.scale === "macro")?.catalogIds.includes(itemId)) return "macro";
  if (researchThemes.find(theme => theme.scale === "meso")?.catalogIds.includes(itemId)) return "meso";
  if (researchThemes.find(theme => theme.scale === "site")?.catalogIds.includes(itemId)) return "site";
  return "micro";
}

/**
 * 조사자료 카탈로그는 실제 API 연결 상태와 아직 조사·연결해야 할 자료를
 * 같은 기준으로 보여주기 위한 목록이다. planned 항목을 수집 완료로 표시하지
 * 않으며, 출처와 한계를 함께 노출해 AI 입력에도 과장이 생기지 않도록 한다.
 */
export const researchCatalog: ResearchCatalogItem[] = [
  { id: "site-boundary", category: "필지·법규·경계", title: "대지 경계·필지 후보", source: "VWorld 연속지적도 · 사용자 지도 경계", role: "조사 대상의 공식 필지 후보와 사용자가 그린 설계 경계를 구분", unit: "필지·폴리곤", status: "implemented", priority: "P0", lenses: ["필지·법규·경계"], limitation: "지적 경계·면적은 측량·소유권·인허가의 최종 판단이 아니며, 현재는 중심점 기반 후보 조회입니다.", officialUrl: "https://www.vworld.kr/" },
  { id: "elevation", category: "생태·기후·물", title: "고도·지형 표본", source: "Open-Meteo Elevation API · Copernicus DEM", role: "대지의 큰 레벨 차이와 경사 방향을 초기 단계에서 파악", unit: "격자 고도(m)", status: "implemented", priority: "P0", lenses: ["지형·레벨", "생태·기후·물"], limitation: "격자 DEM은 옹벽·계단·정확한 설계 레벨을 대체하지 않습니다.", officialUrl: "https://open-meteo.com/en/docs/elevation-api" },
  { id: "air-quality", category: "생태·기후·물", title: "대기질·기상 표본", source: "Open-Meteo Air Quality API", role: "대지 주변의 환경 조건을 격자 예보 표본으로 확인", unit: "격자 시점값", status: "implemented", priority: "P1", lenses: ["지역 생활", "생태·기후·물"], limitation: "대지 직접 측정값이 아니며 현장 체감·공식 측정소 관측값과 다를 수 있습니다.", officialUrl: "https://open-meteo.com/en/docs/air-quality-api" },
  { id: "urban-parks", category: "생태·기후·물", title: "공원·녹지", source: "공공데이터포털 전국도시공원", role: "주변 오픈스페이스와 녹지 접근 맥락을 파악", unit: "공원 POI", status: "partial", priority: "P1", lenses: ["녹지·생태", "보행·접근"], limitation: "현재 연결은 샘플 목록 중심이며 좌표·거리 필터와 주변성 검증이 더 필요합니다.", officialUrl: "https://www.data.go.kr/" },
  { id: "buildings", category: "형태·단면·밀도", title: "건축물 footprint·용도·층수", source: "VWorld 건축물정보 · 국토부 용도별건물정보 · 건축HUB", role: "주변 건물의 용도·높이·밀도·혼합성을 대지와 공간적으로 비교", unit: "건축물 폴리곤·건물대장", status: "partial", priority: "P0", lenses: ["형태·단면·밀도", "필지·법규·경계"], limitation: "현재 WFS 공간객체 수·속성 표본 수집까지 구현했습니다. footprint만으로 용도를 단정하지 않으며, 용도별건물정보 또는 건축HUB 식별자·공간 결합이 남아 있습니다.", officialUrl: "https://www.data.go.kr/data/15123458/openapi.do" },
  { id: "roads", category: "이동·접근·시간", title: "도로 등급·유형·차로·폭", source: "VWorld 교통링크 · ITS 표준노드링크", role: "접근 방향과 도로 위계를 구분하고 보행·차량 진입 가설의 근거 제공", unit: "도로 링크", status: "partial", priority: "P0", lenses: ["이동·접근·시간", "형태·단면·밀도"], limitation: "현재 WFS 공간객체 수·속성 표본 수집까지 구현했습니다. 실제 폭 속성이 없으면 차로수 기반 추정폭으로만 표시하며, 폭으로 교통량을 추정하지 않습니다.", officialUrl: "https://www.its.go.kr/nodelink/" },
  { id: "land-use-zoning", category: "필지·법규·경계", title: "용도지역·지구·구역", source: "VWorld 용도지역지구도", role: "토지 이용과 건축물 용도·건폐율·용적률·높이 제한의 공간적 맥락 확인", unit: "폴리곤·법정 분류", status: "planned", priority: "P0", lenses: ["필지·법규·경계"], limitation: "도시계획 레이어는 법규 전체를 대체하지 않으며 토지이음·관할 원문과 함께 확인해야 합니다.", officialUrl: "https://www.data.go.kr/data/15058773/openapi.do" },
  { id: "land-regulation", category: "필지·법규·경계", title: "토지이용규제·행위제한", source: "국토부 토지이용규제정보서비스 · 토지이음", role: "확정 PNU와 지역·지구에 연결된 행위 제한과 확인 필요 법령을 안내", unit: "PNU·지역지구", status: "planned", priority: "P0", lenses: ["필지·법규·경계"], limitation: "법률·인허가 결론을 자동 확정하지 않으며 최신 원문과 관할기관 확인이 필요합니다.", officialUrl: "https://www.data.go.kr/data/15058410/openapi.do" },
  { id: "population-households", category: "사람·주거·생활", title: "인구·가구·주택·연령", source: "SGIS 센서스 통계", role: "대지 주변 생활권의 인구구성·가구·주거 유형을 파악", unit: "행정구역·집계구", status: "planned", priority: "P1", lenses: ["사람·주거·생활"], limitation: "필지 직접값이 아니라 통계 공간단위 값이며 기준연도와 집계구 경계를 함께 표시해야 합니다.", officialUrl: "https://sgis.mods.go.kr/developer/html/openApi/api/data.html" },
  { id: "businesses", category: "상업·생산·지역경제", title: "사업체·생활업종·상권", source: "SGIS 생활업종 · 공공데이터포털 상가업소", role: "주변 활동·업종·공간 프로그램의 분포와 변화 가능성을 파악", unit: "사업체·업종 POI", status: "planned", priority: "P1", lenses: ["상업·생산·지역경제", "지역 생활"], limitation: "등록 사업체와 실제 영업·시간대 활동은 다를 수 있어 현장 관찰과 교차 확인해야 합니다.", officialUrl: "https://sgis.mods.go.kr/developer/html/openApi/api/data.html" },
  { id: "transit", category: "이동·접근·시간", title: "버스·철도·정류장·환승", source: "지자체 BIS · 공공데이터포털 교통정보", role: "대중교통 접근성과 시간대별 이동 조건을 파악", unit: "정류장·노선·링크", status: "planned", priority: "P1", lenses: ["이동·접근·시간"], limitation: "노선·도착정보의 갱신시각과 지역별 제공범위를 표시해야 하며, 도보시간은 네트워크 분석 없이는 추정하지 않습니다.", officialUrl: "https://www.data.go.kr/" },
  { id: "public-welfare", category: "사람·주거·생활", title: "복지·교육·의료·공공시설", source: "공공데이터포털 시설 표준데이터 · 지자체 시설 API", role: "생활권의 돌봄·교육·의료·공공서비스 접근 맥락을 파악", unit: "시설 POI", status: "planned", priority: "P1", lenses: ["사람·주거·생활", "지역 생활"], limitation: "시설 존재가 이용 가능성·수요 충족을 의미하지 않으며 운영시간과 현장 접근성을 별도 확인합니다.", officialUrl: "https://www.data.go.kr/" },
  { id: "culture-heritage", category: "문화·기억·유휴", title: "문화시설·국가유산·지역 기억", source: "한국문화정보원 · 국가유산청", role: "보존·기억·재사용·지역 정체성의 공간적 단서를 탐색", unit: "시설·유산 POI/경계", status: "planned", priority: "P2", lenses: ["문화·기억·유휴"], limitation: "공식 등록자료가 지역의 모든 기억과 사용 흔적을 대표하지 않으므로 주민·현장 자료가 필요합니다.", officialUrl: "https://www.data.go.kr/data/15125097/openapi.do" },
  { id: "hydrology", category: "생태·기후·물", title: "하천·수계·침수·배수", source: "VWorld 수계 레이어 · 국가/지자체 재해정보", role: "물의 흐름·저지대·수변 관계와 기후 위험을 확인", unit: "선·면·위험구역", status: "planned", priority: "P1", lenses: ["생태·기후·물", "지형·레벨"], limitation: "침수·배수 판단은 공식 위험지도와 현장 레벨·배수시설 확인을 함께 요구합니다.", officialUrl: "https://vworld.kr/dev/v4dv_wmsguide_s001.do" },
  { id: "noise", category: "생태·기후·물", title: "소음·환경 측정", source: "국가소음정보시스템 · 지자체 측정자료", role: "도로·철도·상업 활동과 소리 환경을 설계 질문으로 전환", unit: "측정소·측정시점", status: "field", priority: "P1", lenses: ["지역 생활", "생태·기후·물", "이동·접근·시간"], limitation: "측정소·시점 대표성이 제한적이며 대지 소음은 시간대별 현장 측정으로 검증해야 합니다.", officialUrl: "https://www.noiseinfo.or.kr/" },
  { id: "imagery-change", category: "문화·기억·유휴", title: "항공영상·시계열 변화", source: "VWorld 항공영상 · 지자체 공개영상", role: "유휴·철거·신축·녹지 변화와 공간 기억을 비교", unit: "시점별 영상", status: "planned", priority: "P2", lenses: ["문화·기억·유휴", "형태·단면·밀도"], limitation: "영상 촬영일·해상도·구름·시야 조건에 따라 판독이 달라지며 현재 상태를 현장 확인해야 합니다.", officialUrl: "https://www.vworld.kr/" },
  { id: "field-observation", category: "현장·사용자 자료", title: "현장 관찰·사진·시간대 기록", source: "사용자 직접 기록", role: "공공데이터가 설명하지 못하는 소리·냄새·체류·회피·빛·접촉면을 기록", unit: "관찰·사진·위치", status: "implemented", priority: "P0", lenses: ["이동·접근·시간", "지역 생활", "문화·기억·유휴"], limitation: "관찰자의 시점과 시간대에 의존하므로 관찰 시각·위치·반복 여부를 기록해야 합니다." },
];

export const statusLabels: Record<ResearchCatalogStatus, string> = {
  implemented: "현재 사용 가능",
  partial: "부분 구현",
  planned: "보충 구현 필요",
  field: "현장조사 필요",
};

export const priorityLabels: Record<ResearchCatalogPriority, string> = {
  P0: "핵심",
  P1: "중요",
  P2: "확장",
};

export type GoalAlignment = {
  id: string;
  title: string;
  status: "ready" | "partial" | "missing";
  detail: string;
};

export function goalAlignment(project: LocalProject): GoalAlignment[] {
  const hasBoundary = project.site.boundary.length >= 3;
  const hasParcel = Boolean(project.site.pnu || project.site.parcels?.length);
  const hasLenses = project.lenses.length > 0;
  const hasEvidence = project.researchNotes.length > 0;
  const hasObservation = project.observations.length > 0;
  const hasDesignTurn = project.designNotes.length > 0;
  return [
    { id: "site", title: "필지 확정과 대지 경계", status: hasBoundary && hasParcel ? "ready" : hasBoundary || hasParcel ? "partial" : "missing", detail: hasBoundary && hasParcel ? "사용자 경계와 공식 필지 후보 또는 필지 묶음이 모두 있습니다." : hasBoundary ? "경계는 있지만 공식 필지 후보 확인이 남았습니다." : "지도에서 3개 이상의 경계점을 만들고 필지 후보를 확인하세요." },
    { id: "brief", title: "조사 주제와 범위", status: hasLenses ? "ready" : "missing", detail: hasLenses ? `${project.lenses.length}개 조사 렌즈가 선택되었습니다.` : "조사 렌즈를 선택해야 필요한 자료를 추천할 수 있습니다." },
    { id: "collection", title: "출처가 있는 자료 수집", status: hasEvidence ? "ready" : "missing", detail: hasEvidence ? `${project.researchNotes.length}개 조사 근거가 저장되었습니다.` : "자동 수집 또는 원본 파일·수동 근거를 하나 이상 추가하세요." },
    { id: "spatial", title: "공간 관계 분석", status: hasEvidence && hasBoundary ? "partial" : "missing", detail: hasEvidence && hasBoundary ? "대지와 근거를 함께 보유했지만 거리·중첩·밀도 분석을 계속 보강해야 합니다." : "확정 경계와 위치가 있는 공간자료가 필요합니다." },
    { id: "field", title: "현장 관찰과 데이터 공백", status: hasObservation ? "ready" : "missing", detail: hasObservation ? `${project.observations.length}개 현장 관찰이 저장되었습니다.` : "소리·빛·보행·레벨·체류를 현장에서 기록하세요." },
    { id: "design", title: "설계 질문과 복수 가설", status: hasDesignTurn ? "ready" : hasEvidence || hasObservation ? "partial" : "missing", detail: hasDesignTurn ? `${project.designNotes.length}개 AI 설계 전환 기록이 있습니다.` : "근거와 관찰을 바탕으로 AI 설계 전환을 실행하세요." },
  ];
}