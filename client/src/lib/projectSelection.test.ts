import { describe, expect, it } from "vitest";
import { getProjectSelectionAction } from "./projectSelection";

describe("initial project selection", () => {
  it("opens project creation when no active or saved project exists", () => {
    expect(getProjectSelectionAction(null, [])).toEqual({ type: "create" });
  });

  it("selects the first saved project when none is active", () => {
    expect(getProjectSelectionAction(null, [{ id: 42 }, { id: 43 }])).toEqual({ type: "select", projectId: 42 });
  });

  it("does not replace an already active project", () => {
    expect(getProjectSelectionAction(9, [{ id: 42 }])).toEqual({ type: "keep" });
  });
});
