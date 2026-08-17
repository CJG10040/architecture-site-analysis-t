import { describe, expect, it } from "vitest";
import { recommendContextScopes, recommendInvestigationDatasets } from "./investigationPlan";

describe("investigation plan recommendations", () => {
  it("includes parcel and regulation sources for the parcel lens", () => {
    expect(recommendInvestigationDatasets(["parcel_regulation"]).map(item => item.id)).toEqual(expect.arrayContaining(["vworld-cadastre", "land-eum-plan", "adjacent-form"]));
  });

  it("uses survey-purpose scopes instead of one fixed radius", () => {
    const scopes = recommendContextScopes(["mobility_time", "people_living"]);
    expect(scopes.map(item => item.id)).toEqual(expect.arrayContaining(["parcel", "adjacent", "walkshed", "neighborhood", "administrative"]));
  });
});
