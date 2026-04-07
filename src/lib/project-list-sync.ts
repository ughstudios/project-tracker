/** Cross-tab signal so list UIs refetch after projects are created or changed elsewhere. */
export const PROJECTS_LIST_VERSION_KEY = "issue-tracker:projects-list-version";

export function bumpProjectsListVersion(): void {
  try {
    localStorage.setItem(PROJECTS_LIST_VERSION_KEY, String(Date.now()));
  } catch {
    /* private mode / disabled storage */
  }
}
