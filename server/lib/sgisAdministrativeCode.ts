const legalSidoToSgisSido: Record<string, string> = {
  "11": "11", "26": "21", "27": "22", "28": "23", "29": "24", "30": "25", "31": "26", "36": "29",
  "41": "31", "42": "32", "43": "33", "44": "34", "45": "35", "46": "36", "47": "37", "48": "38", "50": "39",
};

// 2026 전남광주통합특별시 연속지적도는 기존 광주 법정동 코드(29xxx) 대신 12xxx 코드를 사용한다.
// 이 다섯 구는 SGIS의 기존 광주 센서스 시군구 코드와 일대일 대응하므로 산술 추정 대신 명시적으로 매핑한다.
const integratedGwangjuPnuToSgisSgg: Record<string, string> = {
  "12210": "24010", "12240": "24020", "12270": "24030", "12300": "24040", "12330": "24050",
};

/**
 * 법정동 PNU 앞 5자리를 SGIS 센서스 시군구 코드로 바꾼다.
 * 두 체계는 시도·시군구 번호가 달라, 예를 들어 광주 동구 PNU 29110은 SGIS 24010이 된다.
 * 읍면동·제주 특례 등 변환이 불확실한 경우에는 undefined를 반환해 임의 통계를 수집하지 않는다.
 */
export function deriveSgisSggCodeFromPnu(pnu?: string) {
  const normalized = pnu?.trim() ?? "";
  if (!/^\d{19}$/.test(normalized)) return undefined;
  const integratedGwangju = integratedGwangjuPnuToSgisSgg[normalized.slice(0, 5)];
  if (integratedGwangju) return integratedGwangju;
  const sgisSido = legalSidoToSgisSido[normalized.slice(0, 2)];
  const legalSgg = Number(normalized.slice(2, 5));
  if (!sgisSido || !Number.isInteger(legalSgg) || legalSgg < 100) return undefined;
  const sgisSgg = legalSgg - 100;
  if (sgisSgg < 0 || sgisSgg > 999) return undefined;
  return `${sgisSido}${String(sgisSgg).padStart(3, "0")}`;
}
