import { describe, expect, it } from "vitest";
import { createBuildingRecord, createEmptyBuildingStudy, normalizeBuildingStudy } from "./buildingDataModel";
import { createLocalProject, normalizeWorkspace } from "./model";

describe("building data model", () => {
  it("keeps source values, calculated values, observations and analysis as separate layers", () => {
    const study = createEmptyBuildingStudy();
    const record = createBuildingRecord({ id: "b-1", centroid: { latitude: 35, longitude: 126 }, distanceToSiteMeters: 20, footprintAreaSqm: 120, sourceRefIds: ["raw-1"] });
    study.records.push(record);
    expect(record.footprintAreaSqm.status).toBe("calculated");
    expect(record.scopeMembership).toEqual(["macro", "meso", "site", "micro"]);
    expect(study.rawReferences).toEqual([]);
    expect(study.observationLinks).toEqual([]);
    expect(study.analyses).toEqual([]);
  });

  it("normalizes missing building study for legacy projects", () => {
    const project = createLocalProject("legacy");
    const legacy = { ...project } as Record<string, unknown>;
    delete legacy.buildingStudy;
    const workspace = normalizeWorkspace({ schemaVersion: 1, activeProjectId: project.id, projects: [legacy] });
    expect(workspace?.projects[0].buildingStudy?.records).toEqual([]);
    expect(workspace?.projects[0].buildingStudy?.scopeConfig.macroMeters).toBe(1000);
  });

  it("preserves unknown and conflict states instead of converting them to facts", () => {
    const study = normalizeBuildingStudy({ records: [{ id: "b-2", matchStatus: "conflict", matchConfidence: "candidate", footprintAreaSqm: { value: null, status: "unknown", sourceRefIds: [] } }], analyses: [] });
    expect(study.records[0].matchStatus).toBe("conflict");
    expect(study.records[0].footprintAreaSqm.status).toBe("unknown");
  });
});
