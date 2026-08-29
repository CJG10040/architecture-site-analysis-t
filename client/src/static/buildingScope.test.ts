import { describe, expect, it } from "vitest";
import { buildingFieldPolicies, buildingScopeMembership, defaultBuildingScopeConfig, normalizeBuildingScopeConfig, primaryBuildingScope } from "./buildingScope";

describe("building scope policy", () => {
  it("uses nested macro, meso, site and micro ranges", () => {
    expect(buildingScopeMembership(20)).toEqual(["macro", "meso", "site", "micro"]);
    expect(buildingScopeMembership(80)).toEqual(["macro", "meso", "site"]);
    expect(buildingScopeMembership(200)).toEqual(["macro", "meso"]);
    expect(buildingScopeMembership(700)).toEqual(["macro"]);
    expect(buildingScopeMembership(1001)).toEqual([]);
  });

  it("keeps exact boundaries inclusive and returns the nearest analysis level", () => {
    expect(buildingScopeMembership(30)).toContain("micro");
    expect(buildingScopeMembership(100)).toContain("site");
    expect(buildingScopeMembership(300)).toContain("meso");
    expect(buildingScopeMembership(1000)).toContain("macro");
    expect(primaryBuildingScope(20)).toBe("micro");
    expect(primaryBuildingScope(80)).toBe("site");
    expect(primaryBuildingScope(200)).toBe("meso");
    expect(primaryBuildingScope(700)).toBe("macro");
  });

  it("normalizes invalid or reversed thresholds without producing invalid ranges", () => {
    expect(normalizeBuildingScopeConfig({ macroMeters: 50, mesoMeters: 500, siteMeters: -1, microMeters: Number.NaN })).toEqual({ macroMeters: 300, mesoMeters: 300, siteMeters: 30, microMeters: 30 });
    expect(normalizeBuildingScopeConfig()).toEqual(defaultBuildingScopeConfig);
    expect(buildingScopeMembership(-1)).toEqual([]);
  });

  it("requires more detailed fields as the building approaches the site", () => {
    expect(buildingFieldPolicies.macro.aiMode).toBe("aggregate");
    expect(buildingFieldPolicies.meso.required).toContain("distanceToSiteMeters");
    expect(buildingFieldPolicies.site.optional).toContain("grossFloorAreaSqm");
    expect(buildingFieldPolicies.micro.optional).toContain("fieldObservationIds");
  });
});
