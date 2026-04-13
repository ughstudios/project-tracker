import { prisma } from "@/lib/prisma";

const ISSUE_DONE_AUTO_ARCHIVE_MS = 24 * 60 * 60 * 1000;

function getArchiveTimestamp(now: Date) {
  return new Date(now.getTime() - ISSUE_DONE_AUTO_ARCHIVE_MS);
}

async function archiveIssueIfEligible(
  issue: { id: string; title: string } | null,
  now: Date,
  cutoff: Date,
) {
  if (!issue) return false;

  const result = await prisma.issue.updateMany({
    where: {
      id: issue.id,
      archivedAt: null,
      status: "DONE",
      doneAt: { lte: cutoff },
    },
    data: { archivedAt: now },
  });
  if (result.count === 0) return false;

  await prisma.auditLog.create({
    data: {
      entityType: "Issue",
      entityId: issue.id,
      action: "AUTO_ARCHIVE",
      description: `Issue "${issue.title}" auto-archived 24 hours after completion.`,
    },
  });
  return true;
}

export async function autoArchiveExpiredDoneIssue(issueId: string) {
  const now = new Date();
  const cutoff = getArchiveTimestamp(now);
  const issue = await prisma.issue.findFirst({
    where: {
      id: issueId,
      archivedAt: null,
      status: "DONE",
      doneAt: { lte: cutoff },
    },
    select: { id: true, title: true },
  });
  return archiveIssueIfEligible(issue, now, cutoff);
}

export async function autoArchiveExpiredDoneIssues() {
  const now = new Date();
  const cutoff = getArchiveTimestamp(now);
  const issues = await prisma.issue.findMany({
    where: {
      archivedAt: null,
      status: "DONE",
      doneAt: { lte: cutoff },
    },
    select: { id: true, title: true },
  });

  let archivedCount = 0;
  for (const issue of issues) {
    if (await archiveIssueIfEligible(issue, now, cutoff)) archivedCount += 1;
  }
  return archivedCount;
}
