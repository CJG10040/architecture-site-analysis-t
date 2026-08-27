import type { ResearchNote } from "./model";

export function safeDownloadName(value: string, fallback = "site-study") {
  return value.replace(/[^0-9A-Za-z가-힣_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || fallback;
}

export function researchNoteBundle(note: ResearchNote) {
  return JSON.stringify({
    source: note.source,
    title: note.title,
    summary: note.summary,
    url: note.url,
    latitude: note.latitude,
    longitude: note.longitude,
    catalogId: note.catalogId,
    createdAt: note.createdAt,
    detail: note.detail,
    rawData: note.rawData,
    rawDataTruncated: note.rawDataTruncated ?? false,
    spatialLayer: note.spatialLayer,
  }, null, 2);
}

export function researchNoteRaw(note: ResearchNote) {
  return note.rawData ?? note.detail ?? note.summary;
}

export function researchLayerGeoJson(note: ResearchNote) {
  if (!note.spatialLayer) return null;
  return JSON.stringify({
    type: "FeatureCollection",
    features: note.spatialLayer.features.map(feature => ({ type: "Feature", id: feature.id, geometry: feature.geometry, properties: feature.properties })),
    properties: { title: note.title, source: note.source, fetchedAt: note.spatialLayer.fetchedAt, totalFeatureCount: note.spatialLayer.totalFeatureCount, truncated: note.spatialLayer.truncated },
  }, null, 2);
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function researchNotesCsv(notes: ResearchNote[]) {
  const header = ["id", "source", "title", "summary", "url", "latitude", "longitude", "catalogId", "createdAt", "hasDetail", "hasRawData", "hasSpatialLayer"].join(",");
  const rows = notes.map(note => [note.id, note.source, note.title, note.summary, note.url, note.latitude, note.longitude, note.catalogId, note.createdAt, Boolean(note.detail), Boolean(note.rawData), Boolean(note.spatialLayer)].map(csvCell).join(","));
  return [header, ...rows].join("\n");
}
