import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BackLink } from "@/components/back-link";
import { requireSession, assertPipelineAccess, AccessDeniedError } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { customFieldEntries } from "@/lib/format-custom-fields";
import { CONTACT_SOURCE_LABELS } from "@/lib/contact-source-labels";
import { contactDisplayName } from "@/lib/contact-display";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NoteForm } from "./note-form";
import { StageSelectForm } from "./stage-select-form";
import { SendEmailForm } from "./send-email-form";
import { ActivityTimeline } from "./activity-timeline";
import { StarRating } from "@/components/star-rating";
import { DeleteContactButton } from "@/components/delete-contact-button";
import { EditContactDialog } from "./edit-contact-dialog";
import { CustomFieldRow } from "./custom-field-row";
import { AddCustomFieldDialog } from "./add-custom-field-dialog";
import { CvUploadForm } from "./cv-upload-form";
import { AdditionalContactDialog } from "./additional-contact-dialog";
import { RemoveAdditionalContactButton } from "./remove-additional-contact-button";

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
      additionalContacts: { orderBy: { createdAt: "asc" } },
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
  const displayName = contactDisplayName(contact);
  const isB2BLead = contact.pipeline.kind === "LEADS" && !!contact.companyName;
  const hasMailbox = (await prisma.emailAccount.count({ where: { userId: session.user.id } })) > 0;
  const customFields = customFieldEntries(contact.customFields);

  const activities = contact.activities.map((activity) => ({
    id: activity.id,
    type: activity.type,
    content: activity.content,
    createdAt: activity.createdAt.toLocaleString("de-DE"),
    userName: activity.user?.name ?? null,
  }));

  return (
    <div className="p-8">
      <BackLink href={`/dashboard/pipelines/${contact.pipelineId}`}>Zurück zur Kampagne</BackLink>
      <div className="mt-2 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{displayName}</h1>
          <p className="text-muted-foreground">
            {isB2BLead && `${fullName} · `}
            {contact.email ?? "Keine E-Mail"} · {contact.phone ?? "Kein Telefon"}
          </p>
          <div className="mt-1">
            <StarRating contactId={contact.id} rating={contact.rating} size="default" />
          </div>
          {contact.rejectionReason && (
            <p className="mt-1 text-sm text-destructive">Absagegrund: {contact.rejectionReason}</p>
          )}
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
          <Badge variant="secondary">{CONTACT_SOURCE_LABELS[contact.source] ?? contact.source}</Badge>
          <StageSelectForm
            contactId={contact.id}
            currentStageId={contact.stageId}
            pipelineKind={contact.pipeline.kind}
            stages={contact.pipeline.stages}
          />
          <EditContactDialog
            contactId={contact.id}
            firstName={contact.firstName}
            lastName={contact.lastName}
            email={contact.email}
            phone={contact.phone}
            companyName={contact.companyName}
            website={contact.website}
            address={contact.address}
            showCompanyFields={contact.pipeline.kind === "LEADS"}
          />
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
          {contact.pipeline.kind === "APPLICANTS" && (
            <Card>
              <CardHeader>
                <CardTitle>Lebenslauf</CardTitle>
              </CardHeader>
              <CardContent>
                <CvUploadForm contactId={contact.id} cvUrl={contact.cvUrl} />
              </CardContent>
            </Card>
          )}

          {isB2BLead && (
            <Card>
              <CardHeader>
                <CardTitle>Firma</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Website</span>
                  {contact.website ? (
                    <a href={contact.website} target="_blank" rel="noreferrer" className="text-primary underline">
                      {contact.website}
                    </a>
                  ) : (
                    <span>-</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Adresse</span>
                  <span>{contact.address ?? "-"}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {isB2BLead && (
            <Card>
              <CardHeader>
                <CardTitle>Weitere Kontakte</CardTitle>
                <CardAction>
                  <AdditionalContactDialog contactId={contact.id} />
                </CardAction>
              </CardHeader>
              <CardContent>
                {contact.additionalContacts.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {contact.additionalContacts.map((person) => (
                      <div key={person.id} className="flex items-center justify-between gap-2 text-sm">
                        <div>
                          <p className="font-medium">{person.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {[person.role, person.email, person.phone].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <RemoveAdditionalContactButton id={person.id} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Noch keine weiteren Kontakte.</p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Zusätzliche Angaben</CardTitle>
              <CardAction>
                <AddCustomFieldDialog contactId={contact.id} pipelineKind={contact.pipeline.kind} />
              </CardAction>
            </CardHeader>
            <CardContent>
              {customFields.length > 0 ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  {customFields.map((field) => (
                    <CustomFieldRow
                      key={field.key}
                      contactId={contact.id}
                      fieldKey={field.key}
                      label={field.label}
                      value={field.value}
                      editable={field.editable}
                    />
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">Noch keine zusätzlichen Angaben.</p>
              )}
            </CardContent>
          </Card>

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
