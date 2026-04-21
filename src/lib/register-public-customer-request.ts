import type { PublicCustomerRequestKind } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export async function registerPublicCustomerRequestRow(input: {
  submissionId: string;
  kind: PublicCustomerRequestKind;
  sourceAuditLogId: string;
}): Promise<void> {
  await prisma.publicCustomerRequest.upsert({
    where: { submissionId: input.submissionId },
    create: {
      submissionId: input.submissionId,
      kind: input.kind,
      sourceAuditLogId: input.sourceAuditLogId,
    },
    update: {},
  });
}
