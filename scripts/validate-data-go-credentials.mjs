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
  const timeout = setTimeout(() => controller.abort(), 12_000);
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
    const errorCode = responseCode && !["00", "SUCCESS", "NORMAL_SERVICE"].includes(String(responseCode)) ? String(responseCode) : null;
    const normalXmlMessage = xmlMessage && /^(NORMAL SERVICE\.?|SUCCESS|정상적으로 처리되었습니다\.)$/i.test(xmlMessage.trim());
    return { service: label, httpStatus: response.status, responseKind: body.trim().startsWith("{") ? "json" : "xml", success: response.ok && !errorCode, safeError: errorCode || (normalXmlMessage ? null : xmlMessage), safeMessage: responseMessage || (normalXmlMessage ? xmlMessage : null) };
  } catch (error) {
    return { service: label, httpStatus: null, responseKind: null, success: false, safeError: error instanceof Error ? error.name : "unknown_error" };
  } finally {
    clearTimeout(timeout);
  }
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [rows] = await connection.execute("SELECT encryptedValue, initializationVector, authenticationTag FROM apiCredentials WHERE provider = 'dataGoKr' AND isEnabled = 1 LIMIT 1");
  if (!rows.length) throw new Error("활성화된 공공데이터포털 공통 키를 찾지 못했습니다.");
  const serviceKey = decryptCredential(rows[0]);
  const results = await Promise.all([
    call(serviceKey, "토지이용규제", "https://apis.data.go.kr/1613000/arLandUseInfoService/getLandUseInfo", { pnu: "2911010100100010000", numOfRows: "1", pageNo: "1", returnType: "json" }),
    call(serviceKey, "에어코리아", "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty", { stationName: "광주", dataTerm: "DAILY", numOfRows: "1", pageNo: "1", returnType: "json" }),
    call(serviceKey, "광주 BIS", "http://apis.data.go.kr/6290000/gj_bis/stationInfo", { resultType: "json" }),
    call(serviceKey, "사회복지시설", "https://apis.data.go.kr/B554287/sclWlfrFcltInfoInqirService1/getFcltListInfoInqire", { jrsdSggNm: "광주광역시 동구", pageNo: "1", numOfRows: "1" }),
  ]);
  console.log(JSON.stringify({ credentialGroup: "dataGoKr", checkedAt: new Date().toISOString(), results }, null, 2));
} finally {
  await connection.end();
}

process.exit(0);
