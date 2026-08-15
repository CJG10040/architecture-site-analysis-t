import fs from "node:fs";
import mysql from "mysql2/promise";

const file = "/home/ubuntu/upload/광주교통공사_역인근주차장현황_20221208.csv";
const rows = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").trim().split(/\r?\n/);

function parseCsv(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { values.push(current); current = ""; }
    else current += char;
  }
  values.push(current);
  return values;
}

const headers = parseCsv(rows[0]);
const indexOf = name => headers.indexOf(name);
const records = rows.slice(1).map(row => parseCsv(row)).map(fields => ({
  sourceIdentifier: fields[indexOf("주차장관리번호")],
  stationName: fields[indexOf("문화노선도명")] || null,
  name: fields[indexOf("주차장명")],
  address: fields[indexOf("소재지도로명주소")] || null,
  latitude: fields[indexOf("위도")],
  longitude: fields[indexOf("경도")],
  capacity: Number(fields[indexOf("주차구획수")]) || null,
  feeInfo: fields[indexOf("요금정보")] || null,
  facilityType: fields[indexOf("주차장유형")] || null,
})).filter(row => row.sourceIdentifier && row.name && row.latitude && row.longitude);

const connection = await mysql.createConnection(process.env.DATABASE_URL);
for (const row of records) {
  await connection.execute(
    `INSERT INTO parkingFacilities (sourceIdentifier, stationName, name, address, latitude, longitude, capacity, feeInfo, facilityType, datasetReferenceDate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '2022-12-08')
     ON DUPLICATE KEY UPDATE stationName=VALUES(stationName), name=VALUES(name), address=VALUES(address), latitude=VALUES(latitude), longitude=VALUES(longitude), capacity=VALUES(capacity), feeInfo=VALUES(feeInfo), facilityType=VALUES(facilityType), datasetReferenceDate=VALUES(datasetReferenceDate)`,
    [row.sourceIdentifier, row.stationName, row.name, row.address, row.latitude, row.longitude, row.capacity, row.feeInfo, row.facilityType],
  );
}
await connection.end();
console.log(`Seeded ${records.length} Gwangju station-adjacent parking facility records.`);
