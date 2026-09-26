"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/impersonation";
import { AccessDeniedError } from "@/lib/access";

/**
 * Einmalige Datenübernahme aus Tellent HR (vormals KiwiHR) in unser eigenes
 * Personal-Bereich. Matcht per E-Mail gegen bestehende User, übernimmt
 * Position/Standort/Geburtstag/Eintrittsdatum/Austrittsdatum/Manager. Läuft
 * bewusst im App-Server (Vercel), nicht in einer externen Sandbox, da nur die
 * App selbst Zugriff auf die produktive Datenbank hat. Nach abgeschlossener
 * Migration kann diese Datei inkl. UI-Seite wieder entfernt werden.
 */

const TELLENT_ENDPOINT = "https://api.kiwihr.com/api/graphql/public";

const EMAIL_ALIASES: Record<string, string> = {
  "lukas@rock-marketing.de": "lukas@kanzlei-brands.de",
};

type TellentUser = {
  firstName: string;
  lastName: string;
  email: string;
  birthDate: string | null;
  employmentStartDate: string | null;
  employmentEndDate: string | null;
  position: { name: string } | null;
  location: { name: string } | null;
  manager: { email: string } | null;
};

type PlannedChange = {
  ourName: string;
  ourEmail: string;
  position: string | null;
  location: string | null;
  birthday: string | null;
  hireDate: string | null;
  employmentEndedAt: string | null;
  managerEmail: string | null;
};

export type TellentImportResult = {
  matched: PlannedChange[];
  unmatchedTellent: { name: string; email: string }[];
  unmatchedOurs: { name: string; email: string }[];
  applied: boolean;
};

async function requireAgencyAdmin() {
  const session = await getSession();
  if (!session?.user) throw new AccessDeniedError("Nicht eingeloggt.");
  if (session.user.role !== "AGENCY_ADMIN") {
    throw new AccessDeniedError("Diese Funktion ist nur für die Geschäftsführung verfügbar.");
  }
  return session;
}

function normalizeEmail(email: string | null | undefined): string {
  const lower = (email ?? "").toLowerCase();
  return EMAIL_ALIASES[lower] ?? lower;
}

function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

async function fetchAllTellentUsers(apiKey: string): Promise<TellentUser[]> {
  const all: TellentUser[] = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const query = `query {
      users(offset: ${offset}, limit: ${limit}) {
        items {
          firstName
          lastName
          email
          birthDate
          employmentStartDate
          employmentEndDate
          position { name }
          location { name }
          manager { email }
        }
        pageInfo { limit offset }
      }
    }`;
    const res = await fetch(TELLENT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`Tellent-Abfrage fehlgeschlagen (${res.status}): ${await res.text()}`);
    const json = await res.json();
    if (json.errors) throw new Error(`Tellent GraphQL-Fehler: ${JSON.stringify(json.errors)}`);
    const items: TellentUser[] = json.data.users.items;
    all.push(...items);
    if (items.length < limit) break;
    offset += limit;
  }
  return all;
}

export async function runTellentImport(formData: FormData): Promise<TellentImportResult> {
  const session = await requireAgencyAdmin();
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const apply = formData.get("apply") === "true";
  if (!apiKey) throw new Error("Kein Tellent-API-Key angegeben.");

  const tellentUsers = await fetchAllTellentUsers(apiKey);

  const ourUsers = await prisma.user.findMany({
    where: { organizationId: session.user.organizationId, role: { in: ["AGENCY_ADMIN", "AGENCY_STAFF"] } },
    select: { id: true, email: true, name: true },
  });
  const byEmail = new Map(ourUsers.map((u) => [u.email.toLowerCase(), u]));

  const matched: { tellent: TellentUser; ours: (typeof ourUsers)[number] }[] = [];
  const unmatchedTellent: TellentUser[] = [];
  for (const t of tellentUsers) {
    const ours = byEmail.get(normalizeEmail(t.email));
    if (ours) matched.push({ tellent: t, ours });
    else unmatchedTellent.push(t);
  }
  const matchedEmails = new Set(matched.map((m) => normalizeEmail(m.tellent.email)));
  const unmatchedOurs = ourUsers.filter((u) => !matchedEmails.has(u.email.toLowerCase()));

  const plannedChanges: PlannedChange[] = matched.map(({ tellent: t, ours }) => ({
    ourName: ours.name,
    ourEmail: ours.email,
    position: t.position?.name ?? null,
    location: t.location?.name ?? null,
    birthday: t.birthDate,
    hireDate: t.employmentStartDate,
    employmentEndedAt: t.employmentEndDate,
    managerEmail: t.manager?.email ?? null,
  }));

  if (apply) {
    for (const { tellent: t, ours } of matched) {
      const data: Record<string, unknown> = {};
      if (t.position?.name) data.position = t.position.name;
      if (t.location?.name) data.location = t.location.name;
      if (t.birthDate) data.birthday = toDate(t.birthDate);
      if (t.employmentStartDate) data.hireDate = toDate(t.employmentStartDate);
      if (t.employmentEndDate) data.employmentEndedAt = toDate(t.employmentEndDate);
      if (Object.keys(data).length > 0) {
        await prisma.user.update({ where: { id: ours.id }, data });
      }
    }
    for (const { tellent: t, ours } of matched) {
      const managerEmail = t.manager?.email ? normalizeEmail(t.manager.email) : null;
      if (!managerEmail) continue;
      const manager = byEmail.get(managerEmail);
      if (manager && manager.id !== ours.id) {
        await prisma.user.update({ where: { id: ours.id }, data: { managerId: manager.id } });
      }
    }
  }

  return {
    matched: plannedChanges,
    unmatchedTellent: unmatchedTellent.map((t) => ({ name: `${t.firstName} ${t.lastName}`, email: t.email })),
    unmatchedOurs: unmatchedOurs.map((u) => ({ name: u.name, email: u.email })),
    applied: apply,
  };
}
