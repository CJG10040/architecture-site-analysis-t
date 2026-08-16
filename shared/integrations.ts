export const credentialGroups = [
  {
    id: "dataGoKr",
    name: "공공데이터포털",
    shortName: "data.go.kr",
    description: "하나의 인증키를 서비스별 활용승인 상태에 따라 재사용합니다.",
    fields: [{ id: "primary", label: "서비스 키", placeholder: "공공데이터포털에서 발급·활용승인된 ServiceKey" }],
    activeServices: ["토지이용규제", "에어코리아", "광주 BIS", "사회복지시설"],
    plannedServices: ["전국도시공원", "상가(상권)", "기타 공공데이터포털 서비스"],
  },
  {
    id: "sgis",
    name: "SGIS 통계지리정보서비스",
    shortName: "SGIS",
    description: "통계청 인구·가구·연령·사업체·소지역 통계 조회용 Consumer Key/Secret 쌍입니다.",
    fields: [
      { id: "primary", label: "Consumer Key", placeholder: "SGIS Consumer Key" },
      { id: "secondary", label: "Consumer Secret", placeholder: "SGIS Consumer Secret" },
    ],
    activeServices: [],
    plannedServices: ["인구·가구·연령 구조", "사업체", "소지역 통계"],
  },
  {
    id: "vworld",
    name: "VWorld 국가공간정보",
    shortName: "VWorld",
    description: "서버 측 WFS·WMS·공간데이터 조회에 사용하는 키입니다. 브라우저에 키를 노출하지 않습니다.",
    fields: [{ id: "primary", label: "서버 API 키", placeholder: "VWorld 서버용 API Key" }],
    activeServices: [],
    plannedServices: ["필지·연속지적도", "도로·건물·지형", "항공영상·2D·3D 공간정보"],
  },
  {
    id: "safeMap",
    name: "생활안전정보",
    shortName: "SafeMap",
    description: "재난·안전 WMS 레이어를 선택적으로 불러오기 위한 키입니다.",
    fields: [{ id: "primary", label: "서비스 키", placeholder: "생활안전정보 서비스 키" }],
    activeServices: [],
    plannedServices: ["하천범람 위험 WMS", "생활안전 레이어"],
  },
  {
    id: "openRouteService",
    name: "OpenRouteService",
    shortName: "ORS",
    description: "선택적 보행·자전거·차량 등시선·경로 검증용 키입니다.",
    fields: [{ id: "primary", label: "API 키", placeholder: "OpenRouteService API Key" }],
    activeServices: [],
    plannedServices: ["보행·자전거·차량 경로", "등시선·거리행렬"],
  },
] as const;

export type CredentialGroup = (typeof credentialGroups)[number]["id"];

export const credentialGroupIds = credentialGroups.map(item => item.id) as [CredentialGroup, ...CredentialGroup[]];

export function getCredentialGroup(group: CredentialGroup) {
  return credentialGroups.find(item => item.id === group)!;
}
