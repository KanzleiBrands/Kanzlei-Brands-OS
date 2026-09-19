import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession, assertPipelineAccess, AccessDeniedError } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { formatCustomFields } from "@/lib/format-custom-fields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NoteForm } from "./note-form";
import { StageSelectForm } from "./stage-select-form";
import { SendEmailForm } from "./send-email-form";
import { ActivityTimeline } from "./activity-timeline";
import { StarRating } from "@/components/star-rating";
import { DeleteContactButton } from "@/components/delete-contact-button";

export default async function ContactDetailPage({ params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params;

  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: {
      pipeline: { include: { stages: { orderBy: { order: "asc" } } } },
      activities: { orderBy: { createdAt: "desc" }, include: { user: true } },
    },
  });
  if (!contact) notFound();

  try {
    await assertPipelineAccess(session, contact.pipelineId);
  } catch (error) {
    if (error instanceof AccessDeniedError) notFound();
    throw error;
  }

  await logAudit({
    action: "contact.viewed",
    entityType: "Contact",
    entityId: contact.id,
    organizationId: contact.pipeline.organizationId,
    userId: session.user.id,
  });

  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unbenannt";
  const hasMailbox = (await prisma.emailAccount.count({ where: { userId: session.user.id } })) > 0;
  const customFields = formatCustomFields(contact.customFields);

  const activities = contact.activities.map((activity) => ({
    id: activity.id,
    type: activity.type,
    content: activity.content,
    createdAt: activity.createdAt.toLocaleString("de-DE"),
    userName: activity.user?.name ?? null,
  }));

  return (
    <div className="p-8">
      <Link href={`/dashboard/pipelines/${contact.pipelineId}`} className="text-sm text-muted-foreground underline">
        ← Zurück zur Kampagne
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{fullName}</h1>
          <p className="text-muted-foreground">
            {contact.email ?? "Keine E-Mail"} · {contact.phone ?? "Kein Telefon"}
            {contact.location ? ` · ${contact.location}` : ""}
          </p>
          <div className="mt-1">
            <StarRating contactId={contact.id} rating={contact.rating} size="default" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {contact.phone && (
            <Button variant="outline" size="sm" nativeButton={false} render={<a href={`tel:${contact.phone}`} />}>
              Anrufen
            </Button>
          )}
          {contact.email && (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={`mailto:${contact.email}`} />}
            >
              E-Mail
            </Button>
          )}
          <Badge variant="secondary">{contact.source}</Badge>
          <StageSelectForm contactId={contact.id} currentStageId={contact.stageId} stages={contact.pipeline.stages} />
          <DeleteContactButton
            contactId={contact.id}
            contactName={fullName}
            redirectTo={`/dashboard/pipelines/${contact.pipelineId}`}
            variant="full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          {customFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Formular-Angaben</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  {customFields.map((field) => (
                    <div key={field.label} className="contents">
                      <dt className="text-muted-foreground">{field.label}</dt>
                      <dd className="break-words">{field.value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Notiz / Anruf hinzufügen</CardTitle>
            </CardHeader>
            <CardContent>
              <NoteForm contactId={contact.id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>E-Mail senden</CardTitle>
            </CardHeader>
            <CardContent>
              <SendEmailForm contactId={contact.id} hasMailbox={hasMailbox} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Verlauf</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityTimeline activities={activities} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
