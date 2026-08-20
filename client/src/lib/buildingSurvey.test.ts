import { describe, expect, it } from "vitest";
import { summarizeBuildingSurveys } from "./buildingSurvey";

describe("주변 건물 조사 요약", () => {
  it("입력한 높이만으로 범위와 인접 기록 수를 계산한다", () => {
    expect(summarizeBuildingSurveys([
      { estimatedHeightMeters: 12, relationship: "adjacent" },
      { estimatedHeightMeters: null, relationship: "nearby" },
      { estimatedHeightMeters: 27, relationship: "adjacent" },
    ])).toEqual({ recordedCount: 3, adjacentCount: 2, heightMinimumMeters: 12, heightMaximumMeters: 27 });
  });

  it("높이가 기록되지 않으면 범위를 확정하지 않는다", () => {
    expect(summarizeBuildingSurveys([{ estimatedHeightMeters: null, relationship: "across_street" }])).toMatchObject({ heightMinimumMeters: null, heightMaximumMeters: null });
  });
});
