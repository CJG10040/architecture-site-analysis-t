export type BuildingSurveySummaryInput = {
  estimatedHeightMeters: number | null;
  relationship: "adjacent" | "across_street" | "nearby" | "landmark" | "other";
};

export function summarizeBuildingSurveys(surveys: BuildingSurveySummaryInput[]) {
  const heights = surveys.map(item => item.estimatedHeightMeters).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return {
    recordedCount: surveys.length,
    adjacentCount: surveys.filter(item => item.relationship === "adjacent").length,
    heightMinimumMeters: heights.length ? Math.min(...heights) : null,
    heightMaximumMeters: heights.length ? Math.max(...heights) : null,
  };
}
