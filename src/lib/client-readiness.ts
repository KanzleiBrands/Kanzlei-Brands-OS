import { prisma } from "@/lib/prisma";

// Bevor ein Kunde einen Mitarbeiter einladen kann, muss der Account
// vollständig eingerichtet sein - sonst landet der Kunde in einem
// halbfertigen Portal ohne Ansprechpartner oder laufende Kampagne.
export type ClientReadiness = { ready: boolean; missing: string[] };

export async function getClientReadiness(organizationId: string): Promise<ClientReadiness> {
  const [org, pipelines] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { accountManagerId: true, backofficeContactId: true, leadsQuota: true, applicantsQuota: true },
    }),
    prisma.pipeline.findMany({ where: { organizationId }, select: { kind: true } }),
  ]);

  const missing: string[] = [];
  if (!org?.accountManagerId) missing.push("Account Manager");
  if (!org?.backofficeContactId) missing.push("Buchhaltung/Backoffice-Ansprechpartner");
  if (pipelines.length === 0) missing.push("mindestens eine Kampagne");
  if (pipelines.some((p) => p.kind === "LEADS") && org?.leadsQuota == null) missing.push("Leads-Kontingent");
  if (pipelines.some((p) => p.kind === "APPLICANTS") && org?.applicantsQuota == null) missing.push("Bewerber-Kontingent");

  return { ready: missing.length === 0, missing };
}
