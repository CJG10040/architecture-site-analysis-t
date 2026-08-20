export type TerrainCoordinate = { latitude: number; longitude: number };

export type TerrainSample = TerrainCoordinate & { elevationMeters: number };

export type TerrainProfilePoint = TerrainSample & { distanceMeters: number };

export type TerrainAnalysisResult = {
  source: { provider: string; dataset: string; resolutionMeters: number; sourceUrl: string; requestedAt: string };
  sampleCount: number;
  elevation: { minimumMeters: number; maximumMeters: number; meanMeters: number; rangeMeters: number };
  slope: { degrees: number; percent: number; downhillBearingDegrees: number; downhillDirection: string; classification: "flat" | "gentle" | "moderate" | "steep" };
  section: { axis: "east_west" | "north_south"; label: string; points: TerrainProfilePoint[] };
  limitations: string[];
};
