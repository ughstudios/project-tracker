import { prisma } from "@/lib/prisma";

const CLOSED_AUTO_ARCHIVE_MS = 24 * 60 * 60 * 1000;

function closedCutoff(now: Date): Date {
  return new Date(now.getTime() - CLOSED_AUTO_ARCHIVE_MS);
}

/**
 * Archives public customer requests that have been CLOSED for at least 24 hours (mirrors issue DONE auto-archive).
 */
export async function autoArchiveClosedPublicCustomerRequests(): Promise<number> {
  const now = new Date();
  const cutoff = closedCutoff(now);
  const result = await prisma.publicCustomerRequest.updateMany({
    where: {
      archivedAt: null,
      status: "CLOSED",
      closedAt: { not: null, lte: cutoff },
    },
    data: { archivedAt: now },
  });
  return result.count;
}
