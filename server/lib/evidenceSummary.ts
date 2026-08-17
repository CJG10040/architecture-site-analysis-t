export type EvidenceSummary = {
  version: 1;
  recordCount: number;
  sampleFields: string[];
  sampleRows: Array<Record<string, string | number | boolean | null>>;
  narrative: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function findRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return [];
  if (Array.isArray(record.item)) return record.item;
  if (Array.isArray(record.items)) return record.items;
  for (const key of ["response", "body", "items", "result", "featureCollection", "data"]) {
    if (record[key] !== undefined) {
      const nested = findRows(record[key]);
      if (nested.length) return nested;
    }
  }
  return [record];
}

function compactRow(value: unknown) {
  const record = asRecord(value);
  if (!record) return { value: String(value ?? "") };
  return Object.fromEntries(Object.entries(record)
    .filter(([, item]) => item === null || ["string", "number", "boolean"].includes(typeof item))
    .slice(0, 8)
    .map(([key, item]) => [key, item === undefined ? null : item as string | number | boolean | null]));
}

export function summarizeEvidence(data: unknown, sourceName: string, spatialScope: string) : EvidenceSummary {
  const rows = findRows(data);
  const sampleRows = rows.slice(0, 3).map(compactRow);
  const sampleFields = Array.from(new Set(sampleRows.flatMap(row => Object.keys(row)))).slice(0, 12);
  return {
    version: 1,
    recordCount: rows.length,
    sampleFields,
    sampleRows,
    narrative: `${sourceName}에서 ${rows.length}건의 원천 레코드를 확인했습니다. 적용 공간 범위는 ${spatialScope}입니다. 표본·필드 구성과 실제 접근성·기준 시점은 원천 데이터와 현장조사로 함께 검증해야 합니다.`,
  };
}
