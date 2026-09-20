import { cookies } from "next/headers";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

  const target = await prisma.user.findUnique({ where: { id: impersonatedUserId } });
  if (!target) {
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
