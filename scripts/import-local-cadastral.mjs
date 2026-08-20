import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { gzipSync } from "node:zlib";
import mysql from "mysql2/promise";
import shp from "shpjs";

const inputs = process.argv.slice(2);
if (!inputs.length) throw new Error("사용법: node scripts/import-local-cadastral.mjs <zip> [...zip]");

const districtNames = { "12210": "동구", "12240": "서구", "12270": "남구", "12300": "북구", "12330": "광산구" };
const BATCH_SIZE = 1_000;
const connection = await mysql.createConnection(process.env.DATABASE_URL);

function coordinateExtent(geometry) {
  const positions = [];
  const visit = value => Array.isArray(value) && typeof value[0] === "number" ? positions.push(value) : Array.isArray(value) && value.forEach(visit);
  visit(geometry.coordinates);
  if (!positions.length) throw new Error("도형 좌표가 없습니다.");
  return positions.reduce((extent, [longitude, latitude]) => [Math.min(extent[0], longitude), Math.min(extent[1], latitude), Math.max(extent[2], longitude), Math.max(extent[3], latitude)], [Infinity, Infinity, -Infinity, -Infinity]);
}

async function insertBatch(importId, rows) {
  if (!rows.length) return;
  const placeholders = rows.map(() => "(?,?,?,?,?,?,?,?,?,?)").join(",");
  const values = rows.flatMap(row => [importId, row.pnu, row.jibun, row.landIndicator, row.localAdminCode, row.minLongitude, row.minLatitude, row.maxLongitude, row.maxLatitude, row.geometryGzipBase64]);
  await connection.execute(`INSERT INTO cadastralParcels (importId,pnu,jibun,landIndicator,localAdminCode,minLongitude,minLatitude,maxLongitude,maxLatitude,geometryGzipBase64) VALUES ${placeholders}`, values);
}

try {
  const reports = [];
  for (const inputPath of inputs) {
    const input = await readFile(inputPath);
    if (input.byteLength > 35 * 1024 * 1024) throw new Error(`${basename(inputPath)} 파일이 35MB 제한을 초과합니다.`);
    const parsed = await shp(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength));
    const collection = Array.isArray(parsed) ? parsed[0] : parsed;
    const features = collection.features ?? [];
    const first = features[0];
    const districtCode = String(first?.properties?.COL_ADM_SE ?? "");
    const districtName = districtNames[districtCode];
    const datasetReference = (collection.fileName?.match(/_(\d{6})$/)?.[1] ?? basename(inputPath).match(/_(\d{6})\.zip$/)?.[1] ?? "unknown");
    if (!districtName || !/^\d{6}$/.test(datasetReference) || !features.length || features.length > 200_000) throw new Error(`${basename(inputPath)}의 구 코드·기준일·필지 수가 검증 범위를 벗어났습니다.`);
    const validFeatures = features.filter(feature => /^\d{19}$/.test(String(feature.properties?.PNU ?? "")) && ["Polygon", "MultiPolygon"].includes(feature.geometry?.type));
    if (validFeatures.length !== features.length) throw new Error(`${basename(inputPath)}에 PNU 또는 Polygon이 없는 레코드가 포함되어 있습니다.`);
    const sha256 = createHash("sha256").update(input).digest("hex");
    await connection.execute("DELETE p FROM cadastralParcels p INNER JOIN cadastralImports i ON p.importId=i.id WHERE i.districtCode=? AND i.datasetReference=?", [districtCode, datasetReference]);
    await connection.execute("DELETE FROM cadastralImports WHERE districtCode=? AND datasetReference=?", [districtCode, datasetReference]);
    const [result] = await connection.execute("INSERT INTO cadastralImports (districtCode,districtName,datasetReference,sourceFileName,sha256,featureCount,coordinateReference,cadastralImportStatus,safeError) VALUES (?,?,?,?,?,?,?,'processing',NULL)", [districtCode, districtName, datasetReference, basename(inputPath), sha256, features.length, "WGS84 경위도 (SHP PRJ 변환)"]);
    const importId = Number(result.insertId);
    const batch = [];
    for (const feature of validFeatures) {
      const [minLongitude, minLatitude, maxLongitude, maxLatitude] = coordinateExtent(feature.geometry);
      batch.push({ pnu: String(feature.properties.PNU), jibun: String(feature.properties.JIBUN ?? "") || null, landIndicator: String(feature.properties.BCHK ?? "") || null, localAdminCode: districtCode, minLongitude, minLatitude, maxLongitude, maxLatitude, geometryGzipBase64: gzipSync(Buffer.from(JSON.stringify(feature.geometry))).toString("base64") });
      if (batch.length === BATCH_SIZE) { await insertBatch(importId, batch.splice(0)); }
    }
    await insertBatch(importId, batch);
    await connection.execute("UPDATE cadastralImports SET cadastralImportStatus='active', featureCount=? WHERE id=?", [features.length, importId]);
    reports.push({ districtCode, districtName, datasetReference, featureCount: features.length, importId });
  }
  console.log(JSON.stringify({ imported: reports }, null, 2));
} finally {
  await connection.end();
}

process.exit(0);
