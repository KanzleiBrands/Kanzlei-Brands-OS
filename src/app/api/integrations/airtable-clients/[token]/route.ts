import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { generateActivationToken } from "@/lib/invite";
import { logAudit } from "@/lib/audit";
import { sendSystemEmail } from "@/lib/email/resend";
import { getBaseUrl } from "@/lib/base-url";

/** Empty/whitespace-only strings from Airtable formula fields become null instead of "". */
function normalize(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!process.env.AIRTABLE_CLIENT_SYNC_TOKEN || token !== process.env.AIRTABLE_CLIENT_SYNC_TOKEN) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const recordId = normalize(body.recordId);
  const firma = normalize(body.firma);
  if (!recordId || !firma) {
    return NextResponse.json({ error: "recordId and firma are required" }, { status: 400 });
  }

  const applicantsFormUrl = normalize(body.jotformStellenonboarding);
  const leadsFormUrl = normalize(body.jotformMandatsakquiseBriefing);
  const contactFirstName = normalize(body.hauptApVorname);
  const contactLastName = normalize(body.hauptApNachname);
  const contactEmail = normalize(body.hauptApEmail)?.toLowerCase() ?? null;
  // Set for bulk-backfilling already-known clients, so re-creating their
  // portal accounts here doesn't blast out unsolicited invite emails - a
  // genuinely new client arriving via the live Airtable automation never
  // sets this, so that path still emails immediately as intended.
  const skipEmail = body.skipEmail === true;

  const agency = await prisma.organization.findFirst({ where: { type: "AGENCY" } });
  if (!agency) {
    return NextResponse.json({ error: "No agency organization configured" }, { status: 500 });
  }

  // Optional: assign an existing agency staff member as this client's account
  // manager by email, e.g. for bulk-backfilling clients whose Airtable Deal
  // already names one. Silently ignored if the email doesn't match an
  // AGENCY_ADMIN, rather than failing the whole sync over it.
  const accountManagerEmail = normalize(body.accountManagerEmail)?.toLowerCase() ?? null;
  const accountManager = accountManagerEmail
    ? await prisma.user.findFirst({ where: { email: accountManagerEmail, role: "AGENCY_ADMIN" } })
    : null;

  const existing = await prisma.organization.findUnique({ where: { airtableRecordId: recordId } });

  const organization = existing
    ? await prisma.organization.update({
        where: { id: existing.id },
        data: {
          name: firma,
          applicantsFormUrl,
          leadsFormUrl,
          ...(accountManager ? { accountManagerId: accountManager.id } : {}),
        },
      })
    : await prisma.organization.create({
        data: {
          type: "CLIENT",
          name: firma,
          slug: slugify(firma),
          parentId: agency.id,
          airtableRecordId: recordId,
          applicantsFormUrl,
          leadsFormUrl,
          accountManagerId: accountManager?.id,
        },
      });

  await logAudit({
    action: existing ? "organization.airtable_synced" : "organization.airtable_created",
    entityType: "Organization",
    entityId: organization.id,
    organizationId: agency.id,
    metadata: { recordId, firma },
  });

  let userCreated = false;
  if (contactEmail && contactFirstName) {
    const existingUser = await prisma.user.findUnique({ where: { email: contactEmail } });
    if (!existingUser) {
      const { token: activationToken, expiresAt } = generateActivationToken();
      await prisma.user.create({
        data: {
          name: [contactFirstName, contactLastName].filter(Boolean).join(" "),
          email: contactEmail,
          role: "CLIENT_ADMIN",
          organizationId: organization.id,
          passwordHash: null,
          activationToken,
          activationTokenExpiresAt: expiresAt,
        },
      });
      userCreated = true;

      if (!skipEmail) {
        const baseUrl = await getBaseUrl();
        await sendSystemEmail({
          to: contactEmail,
          subject: "Zugang zu deinem Kanzlei Brands Kundenportal",
          text: `Hallo ${contactFirstName},\n\ndein Zugang zum Kanzlei Brands Kundenportal ist bereit. Aktiviere ihn hier:\n${baseUrl}/activate/${activationToken}\n\nViele Grüße\nKanzlei Brands`,
        });
      }
    }
  }

  return NextResponse.json({ ok: true, organizationId: organization.id, created: !existing, userCreated }, { status: 200 });
}
