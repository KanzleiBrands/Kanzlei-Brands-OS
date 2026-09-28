"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { IMPERSONATION_COOKIE } from "@/lib/impersonation";
import { isSuperAdmin } from "@/lib/super-admin";

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

/**
 * Mitarbeiter-Ansicht - im Gegensatz zu startImpersonation (Kundenansicht,
 * jeder AGENCY_ADMIN) nur für den Super-Admin (siehe src/lib/super-admin.ts):
 * jeder AGENCY_ADMIN kann sich als jeder andere Mitarbeiter anmelden wäre
 * eine massive Rechteausweitung, da AGENCY_ADMIN auch an Fulfillment-
 * Mitarbeitende vergeben wird.
 */
export async function startEmployeeImpersonation(formData: FormData) {
  const session = await auth();
  if (!session?.user || !isSuperAdmin(session.user.email)) {
    throw new Error("Nur der Super-Admin kann eine Mitarbeiter-Ansicht starten.");
  }

  const targetUserId = String(formData.get("userId") ?? "");
  if (targetUserId === session.user.id) {
    throw new Error("Du bist bereits als dieser Nutzer angemeldet.");
  }
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { organization: true },
  });
  if (!target || target.organization.type !== "AGENCY") {
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
    action: "impersonation.start_employee",
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
