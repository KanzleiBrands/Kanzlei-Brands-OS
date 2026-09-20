"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { IMPERSONATION_COOKIE } from "@/lib/impersonation";

export async function startImpersonation(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY_ADMIN") {
    throw new Error("Nur Agentur-Admins können eine Kundenansicht starten.");
  }

  const targetUserId = String(formData.get("userId") ?? "");
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { organization: true },
  });
  if (!target || target.organization.type !== "CLIENT") {
    throw new Error("Nutzer nicht gefunden.");
  }

  const store = await cookies();
  store.set(IMPERSONATION_COOKIE, target.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 4,
    path: "/",
  });

  await logAudit({
    action: "impersonation.start",
    entityType: "User",
    entityId: target.id,
    organizationId: target.organizationId,
    userId: session.user.id,
    metadata: { targetUserName: target.name, targetUserEmail: target.email },
  });

  redirect("/dashboard");
}

export async function stopImpersonation() {
  const store = await cookies();
  const impersonatedUserId = store.get(IMPERSONATION_COOKIE)?.value;
  store.delete(IMPERSONATION_COOKIE);

  const session = await auth();
  if (impersonatedUserId && session?.user) {
    const target = await prisma.user.findUnique({ where: { id: impersonatedUserId } });
    if (target) {
      await logAudit({
        action: "impersonation.stop",
        entityType: "User",
        entityId: target.id,
        organizationId: target.organizationId,
        userId: session.user.id,
        metadata: { targetUserName: target.name, targetUserEmail: target.email },
      });
    }
  }

  redirect("/dashboard");
}
