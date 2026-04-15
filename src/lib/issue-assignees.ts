/** Prisma include: assignment rows with user id, name, email (stable order by userId). */
export const issueAssignmentsWithUsersInclude = {
  assignments: {
    orderBy: { userId: "asc" as const },
    include: { user: { select: { id: true, name: true, email: true } } },
  },
} as const;

export function issueRowToApiShape<
  T extends { assignments: { user: { id: string; name: string; email: string } }[] },
>(row: T) {
  const { assignments, ...rest } = row;
  return {
    ...rest,
    assignees: assignments.map((a) => a.user),
  };
}

/** Create payload: `assigneeIds` wins; else legacy single `assigneeId`. */
export function resolveAssigneeIdsForCreate(body: Record<string, unknown>): string[] {
  if (Array.isArray(body.assigneeIds)) {
    return [
      ...new Set(
        body.assigneeIds
          .filter((x): x is string => typeof x === "string" && x.trim() !== "")
          .map((x) => x.trim()),
      ),
    ];
  }
  if (typeof body.assigneeId === "string" && body.assigneeId.trim()) {
    return [body.assigneeId.trim()];
  }
  return [];
}

/** Patch: returns new id list, or `unchanged` when body omits both keys. */
export function resolveAssigneeIdsForPatch(
  body: Record<string, unknown>,
): string[] | "unchanged" {
  if (body.assigneeIds !== undefined) {
    if (!Array.isArray(body.assigneeIds)) {
      return "unchanged";
    }
    return [
      ...new Set(
        body.assigneeIds
          .filter((x): x is string => typeof x === "string" && x.trim() !== "")
          .map((x) => x.trim()),
      ),
    ];
  }
  if (body.assigneeId !== undefined) {
    if (body.assigneeId === null || body.assigneeId === "") {
      return [];
    }
    if (typeof body.assigneeId === "string" && body.assigneeId.trim()) {
      return [body.assigneeId.trim()];
    }
    return [];
  }
  return "unchanged";
}
