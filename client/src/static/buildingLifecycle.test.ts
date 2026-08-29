import { describe, expect, it } from "vitest";
import { createBuildingRecord } from "./buildingDataModel";
import { attachBuildingLifecycle, mergeBuildingLifecycleEvents, normalizeBuildingDate, normalizeBuildingLifecycle } from "./buildingLifecycle";
import type { VworldWfsFeature } from "./vworld";

const lifecycleFeature = (id: string, managementNo: string, props: Record<string, unknown> = {}): VworldWfsFeature => ({ id, geometry: null, properties: { BD_MGT_SN: managementNo, PERMIT_DATE: "2010-02-03", START_DATE: "2010", USE_APR_DATE: "2012-04-05", ...props } });

describe("building lifecycle dates", () => {
  it("keeps year-only dates at year precision", () => {
    expect(normalizeBuildingDate("2010")).toEqual({ date: "2010", precision: "year", valid: true });
    expect(normalizeBuildingDate("2010.2.3")).toEqual({ date: "2010-02-03", precision: "day", valid: true });
    expect(normalizeBuildingDate("2010년 2월 3일")).toEqual({ date: "2010-02-03", precision: "day", valid: true });
  });

  it("rejects invalid dates instead of silently correcting them", () => {
    expect(normalizeBuildingDate("2010-02-31")).toEqual({ date: null, precision: "day", valid: false });
    expect(normalizeBuildingDate("미상").valid).toBe(false);
  });

  it("normalizes permit, start, completion and construction year aliases into events", () => {
    const normalized = normalizeBuildingLifecycle(lifecycleFeature("use-1", "A-1"), "hub-1");
    expect(normalized.events).toHaveLength(3);
    expect(normalized.events.map(event => event.type)).toEqual(["permit", "start", "completion"]);
    expect(normalized.events[0]).toMatchObject({ date: "2010-02-03", precision: "day", status: "verified", sourceRefIds: ["hub-1"] });
    expect(normalized.events[1]).toMatchObject({ date: "2010", precision: "year" });
    expect(normalized.events[2]).toMatchObject({ date: "2012-04-05", precision: "day" });
  });
});

describe("building lifecycle attachment", () => {
  it("attaches lifecycle events only for exact or strong identity matches", () => {
    const record = createBuildingRecord({ id: "master-a" });
    record.fields.buildingManagementNo = { value: "A-1", status: "verified", sourceRefIds: ["footprint"] };
    const exact = attachBuildingLifecycle([record], [lifecycleFeature("source-a", "A-1")], "hub-1");
    expect(exact.records[0].lifecycleEvents).toHaveLength(3);
    expect(exact.records[0].lifecycleEvents[0].matchStatus).toBe("matched");
    const candidateFeature = lifecycleFeature("source-b", "X-1");
    candidateFeature.properties.PLAT_PLC = "광주 동구 1-1";
    exact.records[0].fields.address = { value: "광주 동구 1-1", status: "verified", sourceRefIds: ["footprint"] };
    const candidate = attachBuildingLifecycle(exact.records, [candidateFeature], "hub-2");
    expect(candidate.summary.candidates).toBe(1);
    expect(candidate.records[0].lifecycleEvents).toHaveLength(3);
  });

  it("preserves conflicting completion dates as conflict events", () => {
    const record = createBuildingRecord({ id: "master-a" });
    record.fields.buildingManagementNo = { value: "A-1", status: "verified", sourceRefIds: ["footprint"] };
    const first = attachBuildingLifecycle([record], [lifecycleFeature("source-a", "A-1", { PERMIT_DATE: undefined, START_DATE: undefined, USE_APR_DATE: "2012-04-05" })], "hub-1");
    const second = attachBuildingLifecycle(first.records, [lifecycleFeature("source-b", "A-1", { PERMIT_DATE: undefined, START_DATE: undefined, USE_APR_DATE: "2014-06-07" })], "hub-2");
    const completionEvents = second.records[0].lifecycleEvents.filter(event => event.type === "completion");
    expect(completionEvents).toHaveLength(2);
    expect(completionEvents.every(event => event.status === "conflict")).toBe(true);
    expect(second.summary.conflictingEvents).toBeGreaterThan(0);
  });

  it("does not merge a malformed event into a verified event", () => {
    const malformed = normalizeBuildingLifecycle(lifecycleFeature("source-a", "A-1", { PERMIT_DATE: "invalid", START_DATE: undefined, USE_APR_DATE: undefined }), "hub-1").events[0];
    const verified = normalizeBuildingLifecycle(lifecycleFeature("source-b", "A-1", { PERMIT_DATE: "2010-02-03", START_DATE: undefined, USE_APR_DATE: undefined }), "hub-2").events[0];
    const result = mergeBuildingLifecycleEvents([], [malformed, verified]);
    expect(result.events).toHaveLength(2);
    expect(result.events.some(event => event.status === "unknown")).toBe(true);
    expect(result.events.some(event => event.status === "verified")).toBe(true);
  });
});
