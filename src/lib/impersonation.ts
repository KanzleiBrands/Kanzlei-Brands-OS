import { cookies } from "next/headers";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/super-admin";

export const IMPERSONATION_COOKIE = "impersonate_user_id";

/**
 * Session read for everything except middleware (which must keep using the
 * plain `auth` export from src/auth.ts, since NextAuth v5 also uses it as a
 * higher-order route wrapper there). When an AGENCY_ADMIN has started an
 * impersonation, this swaps the session's user for the impersonated client
 * user, so the rest of the app (access checks, queries, UI) sees exactly
 * what that client user would see. `session.impersonation` carries the real
 * agency user's identity for the switch-back banner.
 */
export async function getSession(): Promise<Session | null> {
  const session = await auth();
  if (!session?.user) return null;
  if (session.user.role !== "AGENCY_ADMIN") return session;

  const store = await cookies();
  const impersonatedUserId = store.get(IMPERSONATION_COOKIE)?.value;
  if (!impersonatedUserId) return session;

  const target = await prisma.user.findUnique({
    where: { id: impersonatedUserId },
    include: { organization: { select: { type: true } } },
  });
  if (!target) {
    store.delete(IMPERSONATION_COOKIE);
    return session;
  }

  // Mitarbeiter-Ansicht (organization.type AGENCY) ist ein Super-Admin-
  // Privileg (siehe src/lib/super-admin.ts) - selbst wenn das Cookie von
  // Hand auf eine Mitarbeiter-ID gesetzt würde, greift der Tausch hier nur,
  // wenn der echte eingeloggte Nutzer der Super-Admin ist. Die Kundenansicht
  // (organization.type CLIENT) bleibt unverändert für jeden AGENCY_ADMIN.
  if (target.organization.type === "AGENCY" && !isSuperAdmin(session.user.email)) {
    store.delete(IMPERSONATION_COOKIE);
    return session;
  }

  return {
    ...session,
    user: {
      id: target.id,
      email: target.email,
      name: target.name,
      role: target.role,
      organizationId: target.organizationId,
    },
    impersonation: {
      realUserId: session.user.id,
      realUserName: session.user.name,
      realUserEmail: session.user.email,
    },
  };
}
