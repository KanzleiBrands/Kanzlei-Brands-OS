import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function logAudit(params: {
  action: string;
  entityType: string;
  entityId: string;
  organizationId: string;
  userId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      organizationId: params.organizationId,
      userId: params.userId,
      metadata: params.metadata,
    },
  });
}
