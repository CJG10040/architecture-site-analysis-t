export function getProjectSelectionAction(activeProjectId: number | null, projects: Array<{ id: number }> | undefined) {
  if (activeProjectId) return { type: "keep" as const };
  const firstProject = projects?.[0];
  return firstProject ? { type: "select" as const, projectId: firstProject.id } : { type: "create" as const };
}
