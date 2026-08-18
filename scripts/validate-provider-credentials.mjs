import mysql from "mysql2/promise";
import { createDecipheriv, createHash } from "node:crypto";

function decryptCredential(record) {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is unavailable");
  const key = createHash("sha256").update(process.env.JWT_SECRET).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(record.initializationVector, "base64"));
  decipher.setAuthTag(Buffer.from(record.authenticationTag, "base64"));
  const raw = Buffer.concat([decipher.update(Buffer.from(record.encryptedValue, "base64")), decipher.final()]).toString("utf8");
  const parsed = JSON.parse(raw);
  if (!parsed.primary) throw new Error("primary credential is missing");
  return { primary: parsed.primary, secondary: parsed.secondary };
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.text();
    return { status: response.status, ok: response.ok, body };
  } finally {
    clearTimeout(timer);
  }
}

function asResult(provider, response, detail = {}) {
  const compact = response.body.replace(/(?:serviceKey|key|consumer_secret|consumer_key|Authorization)=[^&\s]+/gi, "$1=[REDACTED]").replace(/\s+/g, " ").slice(0, 200);
  const rejected = /(?:INVALID|UNAUTHORIZED|AUTH|ERROR|NO[_ ]?AUTH|인증)/i.test(compact) && !/NORMAL(?:_CODE| SERVICE)?/i.test(compact);
  return { provider, status: response.status, success: response.ok && !rejected, responseKind: response.body.trim().startsWith("{") ? "json" : response.body.trim().startsWith("<") ? "xml" : "other", ...detail, diagnostic: response.ok && !rejected ? undefined : compact };
}

function safeFailure(provider, operation, error) {
  const cause = error && typeof error === "object" && "cause" in error ? error.cause : undefined;
  const causeCode = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : undefined;
  const detail = error instanceof Error ? error.message.replace(/(?:key|secret)=[^&\s]+/gi, "$1=[REDACTED]").slice(0, 160) : "unknown_error";
  return { provider, success: false, operation, error: error instanceof Error ? error.name : "unknown_error", causeCode, detail };
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [rows] = await connection.execute("SELECT provider, encryptedValue, initializationVector, authenticationTag FROM apiCredentials WHERE provider IN ('vworld', 'sgis', 'safeMap', 'openRouteService') AND isEnabled = 1");
  const credentials = Object.fromEntries(rows.map(row => [row.provider, decryptCredential(row)]));
  const results = [];

  if (credentials.vworld) {
    const url = new URL("https://api.vworld.kr/req/data");
    Object.entries({ service: "data", request: "GetFeature", data: "LP_PA_CBND_BUBUN", format: "json", crs: "EPSG:4326", geometry: "true", attribute: "true", geomFilter: "POINT(126.9210 35.1467)", size: "1", key: credentials.vworld.primary }).forEach(([name, value]) => url.searchParams.set(name, value));
    try { results.push(asResult("vworld", await request(url, { headers: { Accept: "application/json" } }), { operation: "연속지적도 GetFeature" })); }
    catch (error) { results.push(safeFailure("vworld", "연속지적도 GetFeature", error)); }
  }

  if (credentials.sgis?.secondary) {
    const authUrl = new URL("https://sgisapi.kostat.go.kr/OpenAPI3/auth/authentication.json");
    authUrl.searchParams.set("consumer_key", credentials.sgis.primary);
    authUrl.searchParams.set("consumer_secret", credentials.sgis.secondary);
    try {
      const auth = await request(authUrl, { headers: { Accept: "application/json" } });
      const result = asResult("sgis", auth, { operation: "인증" });
      const parsed = auth.body.trim().startsWith("{") ? JSON.parse(auth.body) : null;
      result.success = result.success && Boolean(parsed?.result?.accessToken) && Number(parsed?.errCd ?? -1) === 0;
      results.push(result);
      if (result.success) {
        const token = parsed.result.accessToken;
        const stageUrl = new URL("https://sgisapi.kostat.go.kr/OpenAPI3/addr/stage.json");
        stageUrl.searchParams.set("accessToken", token);
        stageUrl.searchParams.set("cd", "29");
        const stage = await request(stageUrl, { headers: { Accept: "application/json" } });
        const stageParsed = stage.body.trim().startsWith("{") ? JSON.parse(stage.body) : null;
        const stageResult = asResult("sgis", stage, { operation: "광주 시군구 코드 조회" });
        stageResult.success = stageResult.success && Number(stageParsed?.errCd ?? -1) === 0;
        stageResult.resultCount = Array.isArray(stageParsed?.result) ? stageParsed.result.length : 0;
        stageResult.sampleCodes = Array.isArray(stageParsed?.result) ? stageParsed.result.slice(0, 8).map(item => ({ cd: item.cd, addr_name: item.addr_name })) : [];
        results.push(stageResult);

        const populationUrl = new URL("https://sgisapi.kostat.go.kr/OpenAPI3/stats/population.json");
        populationUrl.searchParams.set("accessToken", token);
        populationUrl.searchParams.set("year", "2020");
        populationUrl.searchParams.set("adm_cd", "29");
        populationUrl.searchParams.set("low_search", "1");
        const population = await request(populationUrl, { headers: { Accept: "application/json" } });
        const populationParsed = population.body.trim().startsWith("{") ? JSON.parse(population.body) : null;
        const populationResult = asResult("sgis", population, { operation: "광주 시군구 인구 통계" });
        populationResult.success = populationResult.success && Number(populationParsed?.errCd ?? -1) === 0;
        populationResult.resultCount = Array.isArray(populationParsed?.result) ? populationParsed.result.length : 0;
        populationResult.safeMessage = populationParsed?.errMsg ?? undefined;
        results.push(populationResult);
      }
    } catch (error) { results.push(safeFailure("sgis", "인증", error)); }
  } else { results.push({ provider: "sgis", success: false, operation: "인증", error: "Consumer Secret not configured" }); }

  if (credentials.safeMap) {
    const url = new URL("http://www.safemap.go.kr/openapi2/IF_0102");
    Object.entries({ serviceKey: credentials.safeMap.primary, pageNo: "1", numOfRows: "1", returnType: "json" }).forEach(([name, value]) => url.searchParams.set(name, value));
    try { results.push(asResult("safeMap", await request(url, { headers: { Accept: "application/json, application/xml;q=0.9" } }), { operation: "보안등 정보조회 IF_0102" })); }
    catch (error) { results.push(safeFailure("safeMap", "보안등 정보조회 IF_0102", error)); }

    const wmsUrl = new URL("http://www.safemap.go.kr/openapi2/IF_0102_WMS");
    Object.entries({ serviceKey: credentials.safeMap.primary, service: "WMS", request: "GetMap", version: "1.1.1", layers: "A2SM_CMMNPOI_SECULIGHT", styles: "A2SM_CMMNPOI_07", srs: "EPSG:4326", bbox: "126.84814453125,35.137879119634185,126.859130859375,35.146862906756304", format: "image/png", width: "64", height: "64", transparent: "TRUE" }).forEach(([name, value]) => wmsUrl.searchParams.set(name, value));
    try { results.push(asResult("safeMap", await request(wmsUrl, { headers: { Accept: "image/png, application/xml;q=0.9" } }), { operation: "보안등 WMS IF_0102_WMS" })); }
    catch (error) { results.push(safeFailure("safeMap", "보안등 WMS IF_0102_WMS", error)); }
  }

  if (credentials.openRouteService) {
    const url = new URL("https://api.openrouteservice.org/v2/directions/foot-walking");
    url.searchParams.set("start", "126.9210,35.1467");
    url.searchParams.set("end", "126.9220,35.1477");
    try { results.push(asResult("openRouteService", await request(url, { headers: { Authorization: credentials.openRouteService.primary, Accept: "application/geo+json" } }), { operation: "보행 경로 경량 조회" })); }
    catch (error) { results.push(safeFailure("openRouteService", "보행 경로 경량 조회", error)); }
  }

  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
} finally {
  await connection.end();
}

process.exit(0);
