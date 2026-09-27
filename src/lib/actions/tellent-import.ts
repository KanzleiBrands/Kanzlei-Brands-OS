"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/impersonation";
import { AccessDeniedError } from "@/lib/access";

/**
 * Einmalige Datenübernahme aus Tellent HR (vormals KiwiHR) in unser eigenes
 * Personal-Bereich. Matcht per E-Mail gegen bestehende User, übernimmt
 * Position/Standort/Geburtstag/Eintrittsdatum/Austrittsdatum/Manager sowie
 * Abwesenheits-Jahressummen (Urlaub/Krank/Homeoffice/Betriebsurlaub). Läuft
 * bewusst im App-Server (Vercel), nicht in einer externen Sandbox, da nur die
 * App selbst Zugriff auf die produktive Datenbank hat. Nach abgeschlossener
 * Migration kann diese Datei inkl. UI-Seite wieder entfernt werden.
 *
 * Tellents öffentliche API hat keine Query für einzelne, datierte
 * Abwesenheits-Anträge und keine für Dokumente/Verträge (per Schema-
 * Introspektion + Testabfragen geprüft - beides existiert dort schlicht
 * nicht). Nur jährliche Salden (timeOffBalances) sind verfügbar. Wir bilden
 * "genehmigte Abwesenheiten dieses Jahr" deshalb als EINEN Sammel-Antrag pro
 * Person/Art/Jahr ab (Tage-Summe, klar als Import-Sammeleintrag markiert),
 * nicht als echte Einzeltermine - die gibt es bei Tellent nicht abrufbar.
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

type TimeOffCategory = "VACATION" | "SICK_LEAVE" | "REMOTE" | "CUSTOM";

type TimeOffBalanceRow = {
  email: string;
  year: number;
  category: TimeOffCategory;
  customName: string | null;
  allowance: number;
  used: number;
};

type PlannedBalance = { ourName: string; ourEmail: string; year: number; totalDays: number; usedInTellent: number };
type PlannedAbsenceSummary = { ourName: string; ourEmail: string; absenceTypeName: string; year: number; days: number };

export type TellentImportResult = {
  matched: PlannedChange[];
  unmatchedTellent: { name: string; email: string }[];
  unmatchedOurs: { name: string; email: string }[];
  balances: PlannedBalance[];
  absenceSummaries: PlannedAbsenceSummary[];
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

async function fetchAllTimeOffBalances(apiKey: string): Promise<TimeOffBalanceRow[]> {
  const query = `query {
    timeOffBalances {
      items {
        __typename
        ... on VacationTimeOffBalance { user { email } periodStartDate allowance used }
        ... on SickLeaveTimeOffBalance { user { email } periodStartDate allowance used }
        ... on RemoteTimeOffBalance { user { email } periodStartDate allowance used timeOffRule { timeOffType { name } } }
        ... on CustomTimeOffBalance { user { email } periodStartDate allowance used timeOffRule { timeOffType { name } } }
      }
    }
  }`;
  const res = await fetch(TELLENT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Tellent-Abwesenheitskonten-Abfrage fehlgeschlagen (${res.status}): ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`Tellent GraphQL-Fehler (Abwesenheitskonten): ${JSON.stringify(json.errors)}`);
  type RawItem = {
    __typename: string;
    user?: { email: string };
    periodStartDate?: string;
    allowance?: number;
    used?: number;
    timeOffRule?: { timeOffType?: { name?: string } };
  };
  const items: RawItem[] = json.data.timeOffBalances.items;
  const categoryByTypename: Record<string, TimeOffCategory> = {
    VacationTimeOffBalance: "VACATION",
    SickLeaveTimeOffBalance: "SICK_LEAVE",
    RemoteTimeOffBalance: "REMOTE",
    CustomTimeOffBalance: "CUSTOM",
  };
  return items
    .filter((it) => categoryByTypename[it.__typename] && it.user && it.periodStartDate)
    .map((it) => ({
      email: it.user!.email,
      year: Number(it.periodStartDate!.slice(0, 4)),
      category: categoryByTypename[it.__typename],
      customName: it.timeOffRule?.timeOffType?.name ?? null,
      allowance: it.allowance ?? 0,
      used: it.used ?? 0,
    }));
}

const ABSENCE_TYPE_DEFAULTS: Record<Exclude<TimeOffCategory, "CUSTOM">, { name: string; icon: string; color: string }> = {
  VACATION: { name: "Urlaub", icon: "Palmtree", color: "amber" },
  SICK_LEAVE: { name: "Krank", icon: "Stethoscope", color: "red" },
  REMOTE: { name: "Homeoffice", icon: "Home", color: "blue" },
};

async function findOrCreateAbsenceType(category: TimeOffCategory, customName: string | null) {
  const isVacation = category === "VACATION";
  const name = category === "CUSTOM" ? (customName ?? "Sonstige Abwesenheit (Tellent)") : ABSENCE_TYPE_DEFAULTS[category].name;
  const existing = await prisma.absenceType.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (existing) return existing;
  return prisma.absenceType.create({
    data: {
      name,
      icon: category === "CUSTOM" ? "CalendarDays" : ABSENCE_TYPE_DEFAULTS[category].icon,
      color: category === "CUSTOM" ? "slate" : ABSENCE_TYPE_DEFAULTS[category].color,
      allowanceType: isVacation ? "LIMITED" : "UNLIMITED",
      defaultAnnualDays: isVacation ? 30 : null,
      requiresApproval: true,
      order: 0,
    },
  });
}

export async function runTellentImport(formData: FormData): Promise<TellentImportResult> {
  const session = await requireAgencyAdmin();
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const apply = formData.get("apply") === "true";
  if (!apiKey) throw new Error("Kein Tellent-API-Key angegeben.");

  const [tellentUsers, timeOffBalances] = await Promise.all([
    fetchAllTellentUsers(apiKey),
    fetchAllTimeOffBalances(apiKey),
  ]);

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

  // Urlaub bekommt zusätzlich zum Sammel-Antrag (unten) auch das echte
  // Jahres-Kontingent (allowance) als AbsenceBalance, weil das ein normales
  // Konto mit editierbarem Kontingent ist - bei den anderen (UNLIMITED)
  // Abwesenheitsarten gibt es kein Kontingent zu übernehmen.
  const plannedBalances: PlannedBalance[] = timeOffBalances
    .filter((b) => b.category === "VACATION")
    .map((b) => {
      const ours = byEmail.get(normalizeEmail(b.email));
      if (!ours) return null;
      return { ourName: ours.name, ourEmail: ours.email, year: b.year, totalDays: Math.round(b.allowance), usedInTellent: b.used };
    })
    .filter((b): b is PlannedBalance => b !== null)
    .sort((a, b) => a.ourName.localeCompare(b.ourName) || a.year - b.year);

  const plannedAbsenceSummaries: PlannedAbsenceSummary[] = timeOffBalances
    .filter((b) => b.used > 0)
    .map((b) => {
      const ours = byEmail.get(normalizeEmail(b.email));
      if (!ours) return null;
      const typeName = b.category === "CUSTOM" ? (b.customName ?? "Sonstige Abwesenheit (Tellent)") : ABSENCE_TYPE_DEFAULTS[b.category as Exclude<TimeOffCategory, "CUSTOM">].name;
      return { ourName: ours.name, ourEmail: ours.email, absenceTypeName: typeName, year: b.year, days: Math.round(b.used) };
    })
    .filter((s): s is PlannedAbsenceSummary => s !== null)
    .sort((a, b) => a.ourName.localeCompare(b.ourName) || a.year - b.year || a.absenceTypeName.localeCompare(b.absenceTypeName));

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

    if (plannedBalances.length > 0) {
      const vacationType = await findOrCreateAbsenceType("VACATION", null);
      for (const { ourEmail, year, totalDays } of plannedBalances) {
        const ours = byEmail.get(normalizeEmail(ourEmail));
        if (!ours) continue;
        await prisma.absenceBalance.upsert({
          where: { userId_absenceTypeId_year: { userId: ours.id, absenceTypeId: vacationType.id, year } },
          create: { userId: ours.id, absenceTypeId: vacationType.id, year, totalDays },
          update: { totalDays },
        });
      }
    }

    // Sammel-Anträge pro Person/Art/Jahr - ersetzt bei jedem erneuten
    // "Übernehmen" den vorherigen Import-Sammeleintrag (idempotent, keine
    // Dubletten bei mehrfachem Ausführen).
    const typeCache = new Map<string, Awaited<ReturnType<typeof findOrCreateAbsenceType>>>();
    for (const b of timeOffBalances) {
      if (b.used <= 0) continue;
      const ours = byEmail.get(normalizeEmail(b.email));
      if (!ours) continue;
      const cacheKey = b.category === "CUSTOM" ? `CUSTOM:${b.customName}` : b.category;
      let absenceType = typeCache.get(cacheKey);
      if (!absenceType) {
        absenceType = await findOrCreateAbsenceType(b.category, b.customName);
        typeCache.set(cacheKey, absenceType);
      }
      const notePrefix = `[Tellent-Import ${b.year}]`;
      await prisma.absenceRequest.deleteMany({
        where: { userId: ours.id, absenceTypeId: absenceType.id, note: { startsWith: notePrefix } },
      });
      const anchor = new Date(Date.UTC(b.year, 0, 1));
      await prisma.absenceRequest.create({
        data: {
          userId: ours.id,
          absenceTypeId: absenceType.id,
          startDate: anchor,
          endDate: anchor,
          days: Math.round(b.used),
          status: "APPROVED",
          decidedByUserId: session.user.id,
          decidedAt: new Date(),
          note: `${notePrefix} Jahressumme aus Tellent HR (${b.used} Tage) - Tellent liefert keine einzelnen Anträge mit Datum, nur die Jahressumme.`,
        },
      });
    }
  }

  return {
    matched: plannedChanges,
    unmatchedTellent: unmatchedTellent.map((t) => ({ name: `${t.firstName} ${t.lastName}`, email: t.email })),
    unmatchedOurs: unmatchedOurs.map((u) => ({ name: u.name, email: u.email })),
    balances: plannedBalances,
    absenceSummaries: plannedAbsenceSummaries,
    applied: apply,
  };
}
