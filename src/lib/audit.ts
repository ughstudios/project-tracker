import { prisma } from "@/lib/prisma";

type AuditInput = {
  actorId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  description: string;
};

export async function writeAuditLog(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        description: input.description,
      },
    });
  } catch {
    // Do not block main workflows if audit logging fails.
  }
}

