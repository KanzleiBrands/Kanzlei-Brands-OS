import { prisma } from "@/lib/prisma";

// Bevor ein Kunde einen Mitarbeiter einladen kann, muss der Account
// vollständig eingerichtet sein - sonst landet der Kunde in einem
// halbfertigen Portal ohne Ansprechpartner oder laufende Kampagne.
export type ClientReadiness = { ready: boolean; missing: string[] };

export async function getClientReadiness(organizationId: string): Promise<ClientReadiness> {
  const [org, agency, pipelineCount] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { accountManagerId: true } }),
    prisma.organization.findFirst({ where: { type: "AGENCY" }, select: { backofficeContactId: true } }),
    prisma.pipeline.count({ where: { organizationId } }),
  ]);

  const missing: string[] = [];
  if (!org?.accountManagerId) missing.push("Account Manager");
  if (!agency?.backofficeContactId) missing.push("Buchhaltung/Backoffice-Ansprechpartner");
  if (pipelineCount === 0) missing.push("mindestens eine Kampagne");

  return { ready: missing.length === 0, missing };
}
