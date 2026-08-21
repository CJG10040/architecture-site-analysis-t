import { describe, expect, it } from "vitest";
import { createLocalProject, createWorkspace, getActiveProject, normalizeWorkspace, updateProject } from "./model";

describe("local static workspace", () => {
  it("creates a usable project without a server or account", () => {
    const workspace = createWorkspace(createLocalProject("개인 과제"));
    expect(getActiveProject(workspace).title).toBe("개인 과제");
    expect(workspace.projects).toHaveLength(1);
  });

  it("rejects malformed imported files", () => {
    expect(normalizeWorkspace({ schemaVersion: 1, projects: [] })).toBeNull();
    expect(normalizeWorkspace({ schemaVersion: 2, projects: [] })).toBeNull();
  });

  it("updates only the targeted project", () => {
    const workspace = createWorkspace(createLocalProject("초안"));
    const updated = updateProject(workspace, { ...getActiveProject(workspace), title: "수정본" });
    expect(getActiveProject(updated).title).toBe("수정본");
  });
});
