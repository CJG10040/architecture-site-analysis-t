import { readFile } from "node:fs/promises";
import path from "node:path";
import shp from "shpjs";

const inputPath = process.argv[2];
if (!inputPath) throw new Error("사용법: node scripts/inspect-cadastral-shp.mjs <zip-path>");

const input = await readFile(inputPath);
const parsed = await shp(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength));
const collections = Array.isArray(parsed) ? parsed : [parsed];

function extentForFeature(feature) {
  const values = [];
  const visit = value => Array.isArray(value) && typeof value[0] === "number" ? values.push(value) : Array.isArray(value) && value.forEach(visit);
  visit(feature.geometry?.coordinates);
  return values.reduce((extent, coordinate) => [Math.min(extent[0], coordinate[0]), Math.min(extent[1], coordinate[1]), Math.max(extent[2], coordinate[0]), Math.max(extent[3], coordinate[1])], [Infinity, Infinity, -Infinity, -Infinity]);
}

const report = collections.map(collection => {
  const features = collection.features ?? [];
  const first = features[0] ?? { properties: {}, geometry: null };
  const extent = features.slice(0, Math.min(features.length, 200)).reduce((all, feature) => {
    const item = extentForFeature(feature);
    return [Math.min(all[0], item[0]), Math.min(all[1], item[1]), Math.max(all[2], item[2]), Math.max(all[3], item[3])];
  }, [Infinity, Infinity, -Infinity, -Infinity]);
  return {
    layerName: collection.fileName ?? path.basename(inputPath),
    featureCount: features.length,
    geometryType: first.geometry?.type ?? null,
    propertyFields: Object.keys(first.properties ?? {}),
    sampleProperties: first.properties ?? {},
    sampleExtentFirst200: extent,
  };
});

console.log(JSON.stringify({ input: path.basename(inputPath), report }, null, 2));
