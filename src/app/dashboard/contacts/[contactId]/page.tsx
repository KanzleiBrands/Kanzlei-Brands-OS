import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession, assertPipelineAccess, AccessDeniedError } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NoteForm } from "./note-form";
import { StageSelectForm } from "./stage-select-form";
import { SendEmailForm } from "./send-email-form";

const ACTIVITY_LABELS: Record<string, string> = {
  NOTE: "Notiz",
  STAGE_CHANGE: "Statusänderung",
  EMAIL_IN: "E-Mail (eingehend)",
  EMAIL_OUT: "E-Mail (ausgehend)",
  CALL: "Anruf",
};

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

  return (
    <div className="p-8">
      <Link href={`/dashboard/pipelines/${contact.pipelineId}`} className="text-sm text-muted-foreground underline">
        ← Zurück zur Pipeline
      </Link>
      <div className="mt-2 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{fullName}</h1>
          <p className="text-muted-foreground">
            {contact.email ?? "Keine E-Mail"} · {contact.phone ?? "Kein Telefon"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{contact.source}</Badge>
          <StageSelectForm contactId={contact.id} currentStageId={contact.stageId} stages={contact.pipeline.stages} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Notiz hinzufügen</CardTitle>
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

        <Card>
          <CardHeader>
            <CardTitle>Verlauf</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {contact.activities.map((activity) => (
              <div key={activity.id} className="border-b pb-2 text-sm last:border-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{ACTIVITY_LABELS[activity.type] ?? activity.type}</span>
                  <span className="text-xs text-muted-foreground">
                    {activity.createdAt.toLocaleString("de-DE")}
                  </span>
                </div>
                {activity.content && <p className="text-muted-foreground">{activity.content}</p>}
                {activity.user && <p className="text-xs text-muted-foreground">von {activity.user.name}</p>}
              </div>
            ))}
            {contact.activities.length === 0 && (
              <p className="text-sm text-muted-foreground">Noch keine Aktivitäten.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
