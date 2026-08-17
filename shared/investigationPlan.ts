export const investigationLenses = [
  "parcel_regulation",
  "mobility_time",
  "people_living",
  "economy_activity",
  "ecology_climate",
  "culture_memory",
  "form_section",
] as const;

export type InvestigationLens = (typeof investigationLenses)[number];
export type DatasetAccess = "connected" | "configured" | "approval_needed" | "fieldwork";
export type InvestigationDataset = {
  id: string;
  lens: InvestigationLens;
  title: string;
  provider: string;
  category: "parcel" | "regulation" | "environment" | "transport" | "parking" | "facility" | "commerce" | "park" | "demographics" | "terrain" | "building" | "culture";
  spatialScope: "parcel" | "adjacent" | "walkshed" | "neighborhood" | "administrative";
  recommendedRadiusMeters?: number;
  access: DatasetAccess;
  accessUrl?: string;
  rationale: string;
  limitation: string;
};

const datasets: InvestigationDataset[] = [
  { id: "vworld-cadastre", lens: "parcel_regulation", title: "연속지적도 필지 후보", provider: "VWorld", category: "parcel", spatialScope: "parcel", access: "configured", rationale: "지도 선택 지점과 겹치는 공식 필지 후보, PNU, 지목·면적을 확인합니다.", limitation: "지적도는 조사 대상 확정의 참고 정보이며 측량·소유·인허가의 최종 증명은 아닙니다." },
  { id: "land-eum-plan", lens: "parcel_regulation", title: "토지이용계획·용도지역·지구", provider: "토지이음·국토교통부", category: "regulation", spatialScope: "parcel", access: "approval_needed", accessUrl: "https://www.data.go.kr/", rationale: "확정 PNU를 기준으로 용도지역·지구·구역과 행위제한 조사 항목을 만듭니다.", limitation: "토지이용 열람과 확인도면은 참고용이며 최종 인허가 판단을 대신하지 않습니다." },
  { id: "adjacent-form", lens: "parcel_regulation", title: "인접 필지·접도·경계", provider: "VWorld", category: "parcel", spatialScope: "adjacent", recommendedRadiusMeters: 150, access: "configured", rationale: "대지 접도, 인접 필지, 경계의 단절·공유 가능성을 읽습니다.", limitation: "현장 보행·담장·실제 점유 상태는 답사로 확인해야 합니다." },
  { id: "gw-bus", lens: "mobility_time", title: "광주 버스 정류장·도착 정보", provider: "공공데이터포털·광주 BIS", category: "transport", spatialScope: "walkshed", recommendedRadiusMeters: 400, access: "connected", rationale: "광주 대지의 정류장 분포와 시간대별 대중교통 맥락을 확인합니다.", limitation: "정류장 직선거리만으로 실제 보행 접근성을 판단할 수 없습니다." },
  { id: "parking-context", lens: "mobility_time", title: "역 인근 주차장 맥락", provider: "광주교통공사 CSV", category: "parking", spatialScope: "walkshed", recommendedRadiusMeters: 400, access: "connected", rationale: "주차·환승·자동차 접근 맥락을 보조적으로 확인합니다.", limitation: "2022-12-08 기준의 광주 역 인근 주차장 데이터에 한정됩니다." },
  { id: "sgis-demographics", lens: "people_living", title: "인구·가구·주택·연령 구조", provider: "SGIS", category: "demographics", spatialScope: "administrative", access: "configured", rationale: "행정동·집계구 단위의 생활·주거 맥락을 비교합니다.", limitation: "통계 공간 단위는 개별 필지와 다르고 기준연도가 존재합니다." },
  { id: "welfare-facilities", lens: "people_living", title: "사회복지시설", provider: "공공데이터포털", category: "facility", spatialScope: "neighborhood", recommendedRadiusMeters: 800, access: "connected", rationale: "돌봄·복지 시설의 분포와 생활권의 빈틈을 확인합니다.", limitation: "원천 주소·좌표 품질과 실제 이용 가능 여부를 확인해야 합니다." },
  { id: "sgis-business", lens: "economy_activity", title: "사업체·산업 구조", provider: "SGIS", category: "demographics", spatialScope: "administrative", access: "configured", rationale: "산업·고용·생활업종의 장기적 맥락을 읽습니다.", limitation: "통계는 기준연도와 행정구역 단위를 함께 읽어야 합니다." },
  { id: "commerce-radius", lens: "economy_activity", title: "반경 내 상가·업종", provider: "공공데이터포털", category: "commerce", spatialScope: "neighborhood", recommendedRadiusMeters: 400, access: "connected", rationale: "현재 업종 구성과 활동의 단서를 확인합니다.", limitation: "영업 상태·시간대 활동·보행 점유는 현장조사로 보완해야 합니다." },
  { id: "parks-open-space", lens: "ecology_climate", title: "도시공원·오픈스페이스", provider: "공공데이터포털", category: "park", spatialScope: "neighborhood", recommendedRadiusMeters: 800, access: "connected", rationale: "녹지와 공공 오픈스페이스의 분포를 조사합니다.", limitation: "좌표 정규화와 실제 접근성 확인이 필요합니다." },
  { id: "air-quality", lens: "ecology_climate", title: "인근 대기질 측정소", provider: "에어코리아", category: "environment", spatialScope: "neighborhood", recommendedRadiusMeters: 3000, access: "connected", rationale: "대기 환경의 광역 맥락과 측정소 시점을 확인합니다.", limitation: "대지 직접 측정값이 아니라 인근 측정소 관측값입니다." },
  { id: "vworld-terrain", lens: "ecology_climate", title: "지형·고도·경사", provider: "VWorld", category: "terrain", spatialScope: "adjacent", recommendedRadiusMeters: 400, access: "configured", rationale: "대지와 주변의 높낮이·경사·물 흐름 조사 단서를 만듭니다.", limitation: "DEM 해상도와 최신성은 실제 서비스 계약·데이터셋별로 확인해야 합니다." },
  { id: "culture-facilities", lens: "culture_memory", title: "문화·공공시설", provider: "공공데이터포털·지자체", category: "culture", spatialScope: "neighborhood", recommendedRadiusMeters: 800, access: "approval_needed", accessUrl: "https://www.data.go.kr/", rationale: "지역의 문화·공공 활동과 기억의 장소를 조사합니다.", limitation: "해당 지자체 데이터의 활용 승인과 현장 기록이 필요할 수 있습니다." },
  { id: "vworld-building", lens: "form_section", title: "주변 건축물·지형 단면", provider: "VWorld", category: "building", spatialScope: "adjacent", recommendedRadiusMeters: 150, access: "configured", rationale: "주변 건물 배치·층·높이 속성의 가용성을 확인해 단면 조사의 출발점으로 사용합니다.", limitation: "건물 높이·층 속성의 전국적 완결성은 보장되지 않으므로 현장·도면 검증이 필요합니다." },
  { id: "field-section-survey", lens: "form_section", title: "현장 단면·높이·빛 기록", provider: "현장조사", category: "building", spatialScope: "adjacent", recommendedRadiusMeters: 150, access: "fieldwork", rationale: "대지와 접한 길·인접 건물의 층수·높이 추정, 레벨 차, 시선, 오전·오후의 빛·그늘을 같은 단면선에서 기록합니다.", limitation: "사진·스케치·측정 기준과 시간대를 남기지 않으면 높이·빛·단면의 해석 근거가 될 수 없습니다." },
];

export function recommendInvestigationDatasets(lenses: InvestigationLens[]) {
  const selected = new Set(lenses);
  return datasets.filter(dataset => selected.has(dataset.lens));
}

export function recommendContextScopes(lenses: InvestigationLens[]) {
  const selected = new Set(lenses);
  const scopes = [
    { id: "parcel", label: "필지 자체", radiusMeters: 0, rationale: "PNU·경계·용도지역·지목을 확인합니다." },
    { id: "adjacent", label: "인접 150m", radiusMeters: 150, rationale: "접도·경계·인접 건물·단면을 읽습니다." },
  ];
  if (selected.has("mobility_time") || selected.has("economy_activity")) scopes.push({ id: "walkshed", label: "보행권 400m", radiusMeters: 400, rationale: "이동·정류장·상가·시간대를 읽습니다." });
  if (selected.has("people_living") || selected.has("ecology_climate") || selected.has("culture_memory")) scopes.push({ id: "neighborhood", label: "생활권 800m", radiusMeters: 800, rationale: "시설·녹지·생활권 관계를 읽습니다." });
  if (selected.has("people_living") || selected.has("economy_activity")) scopes.push({ id: "administrative", label: "행정동·집계구", radiusMeters: 0, rationale: "인구·가구·사업체 통계의 공간 단위를 읽습니다." });
  return scopes;
}
