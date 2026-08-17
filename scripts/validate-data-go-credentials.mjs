import mysql from "mysql2/promise";
import { createDecipheriv, createHash } from "node:crypto";

function decryptCredential(record) {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is unavailable");
  const key = createHash("sha256").update(process.env.JWT_SECRET).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(record.initializationVector, "base64"));
  decipher.setAuthTag(Buffer.from(record.authenticationTag, "base64"));
  const raw = Buffer.concat([decipher.update(Buffer.from(record.encryptedValue, "base64")), decipher.final()]).toString("utf8");
  const parsed = JSON.parse(raw);
  if (!parsed.primary) throw new Error("공통 키에 primary 값이 없습니다.");
  return parsed.primary;
}

async function call(serviceKey, label, endpoint, params) {
  const url = new URL(endpoint);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("serviceKey", serviceKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json, application/xml;q=0.9" } });
    const body = await response.text();
    let responseCode = null;
    let responseMessage = null;
    if (body.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(body);
        const header = parsed.response?.header || parsed.header || parsed.RESULT;
        responseCode = header?.resultCode || header?.RESULT_CODE || parsed.RESULT_CODE || null;
        responseMessage = header?.resultMsg || header?.RESULT_MSG || parsed.RESULT_MSG || null;
      } catch { /* Response remains classified as JSON without a parsed status. */ }
    }
    const xmlMessage = body.match(/<(?:errMsg|returnAuthMsg|RESULT_MSG|resultMsg)>([^<]+)/i)?.[1] || null;
    const errorCode = responseCode && !["0", "00", "SUCCESS", "NORMAL_SERVICE", "NORMAL_CODE"].includes(String(responseCode)) ? String(responseCode) : null;
    const normalXmlMessage = xmlMessage && /^(NORMAL SERVICE\.?|SUCCESS|정상적으로 처리되었습니다\.)$/i.test(xmlMessage.trim());
    const success = response.ok && !errorCode;
    const diagnostic = success ? null : body.replaceAll(serviceKey, "[REDACTED]").replace(/\s+/g, " ").slice(0, 240);
    return { service: label, httpStatus: response.status, responseKind: body.trim().startsWith("{") ? "json" : "xml", success, safeError: success ? null : errorCode || (normalXmlMessage ? null : xmlMessage), safeMessage: responseMessage || (normalXmlMessage ? xmlMessage : null), diagnostic };
  } catch (error) {
    const causeCode = error && typeof error === "object" && "cause" in error && error.cause && typeof error.cause === "object" && "code" in error.cause ? String(error.cause.code) : null;
    return { service: label, httpStatus: null, responseKind: null, success: false, safeError: causeCode || (error instanceof Error ? error.name : "unknown_error") };
  } finally {
    clearTimeout(timeout);
  }
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [rows] = await connection.execute("SELECT encryptedValue, initializationVector, authenticationTag FROM apiCredentials WHERE provider = 'dataGoKr' AND isEnabled = 1 LIMIT 1");
  if (!rows.length) throw new Error("활성화된 공공데이터포털 공통 키를 찾지 못했습니다.");
  const serviceKey = decryptCredential(rows[0]);
  const requests = [
    ["토지이용규제 행위제한", "https://apis.data.go.kr/1613000/arLandUseInfoService/DTarLandUseInfo", { areaCd: "11110", ucodeList: "UQA430", landUseNm: "주택" }],
    ["에어코리아 측정소정보", "https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getMsrstnList", { addr: "광주광역시", numOfRows: "1", pageNo: "1", returnType: "json" }],
    ["에어코리아 대기오염정보", "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty", { stationName: "서석동", dataTerm: "DAILY", numOfRows: "1", pageNo: "1", returnType: "json" }],
    ["광주 BIS", "https://apis.data.go.kr/6290000/gj_bis/stationInfo", { resultType: "json" }],
    ["사회복지시설", "https://apis.data.go.kr/B554287/sclWlfrFcltInfoInqirService1/getFcltListInfoInqire", { jrsdSggNm: "광주광역시 동구", pageNo: "1", numOfRows: "1" }],
    ["상가(상권) 반경상가", "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius", { radius: "800", cx: "126.9210", cy: "35.1467", pageNo: "1", numOfRows: "5", type: "json" }],
    ["전국도시공원", "https://api.data.go.kr/openapi/tn_pubr_public_cty_park_info_api", { pageNo: "1", numOfRows: "5", type: "json" }],
  ];
  const results = [];
  for (const [label, endpoint, params] of requests) {
    results.push(await call(serviceKey, label, endpoint, params));
  }
  console.log(JSON.stringify({ credentialGroup: "dataGoKr", checkedAt: new Date().toISOString(), results }, null, 2));
} finally {
  await connection.end();
}

process.exit(0);
