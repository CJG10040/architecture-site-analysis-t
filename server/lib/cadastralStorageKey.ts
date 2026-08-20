/** 객체 저장소 경로는 ASCII만 허용하므로, 사용자 원본명과 분리해 결정론적 키를 만든다. */
export function buildCadastralStorageKey(input: { districtCode: string; datasetReference: string; timestamp: number }) {
  const { districtCode, datasetReference, timestamp } = input;
  if (!/^\d{5}$/.test(districtCode) || !/^\d{6}$/.test(datasetReference) || !Number.isSafeInteger(timestamp)) throw new Error("연속지적도 저장 키 정보를 확인할 수 없습니다.");
  return `admin/cadastral/${districtCode}/${datasetReference}/${timestamp}-cadastral-${districtCode}-${datasetReference}.zip`;
}
