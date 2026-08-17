import { fetchVworldParcelCandidates } from "../server/lib/dataAdapters.ts";

const result = await fetchVworldParcelCandidates({ latitude: 35.1467, longitude: 126.9210 });
console.log(JSON.stringify({ status: result.status, candidateCount: result.candidates.length, hasPnu: result.candidates.some(candidate => Boolean(candidate.pnu)), hasGeometry: result.candidates.some(candidate => Boolean(candidate.boundaryGeoJson)) }));
