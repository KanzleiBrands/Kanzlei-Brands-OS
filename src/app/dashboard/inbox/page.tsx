import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { contactDisplayName } from "@/lib/contact-display";
import { ReplyForm } from "./reply-form";

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ contact?: string }> }) {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") redirect("/dashboard");

  const { contact: selectedContactId } = await searchParams;

  const messages = await prisma.emailMessage.findMany({
    orderBy: { sentAt: "desc" },
    include: {
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          companyName: true,
          phone: true,
          email: true,
          pipeline: { select: { name: true, organization: { select: { name: true } } } },
        },
      },
    },
  });

  const threadsByContact = new Map<string, typeof messages>();
  for (const message of messages) {
    const existing = threadsByContact.get(message.contactId);
    if (existing) existing.push(message);
    else threadsByContact.set(message.contactId, [message]);
  }
  const threads = [...threadsByContact.values()]; // already newest-first per contact, and Map insertion order follows the desc query

  const activeContactId = selectedContactId ?? threads[0]?.[0]?.contactId ?? null;
  const activeThread = activeContactId ? (threadsByContact.get(activeContactId) ?? []) : [];
  const activeThreadAsc = [...activeThread].reverse();
  const activeContact = activeThread[0]?.contact ?? null;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b p-4 sm:p-6">
        <h1 className="text-2xl font-semibold">Posteingang</h1>
        <p className="text-muted-foreground">
          E-Mail-Korrespondenz mit Leads &amp; Bewerbern aus allen verbundenen Postfächern.
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 flex-shrink-0 overflow-y-auto border-r">
          {threads.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              Noch keine E-Mails. Verbinde ein Postfach unter Einstellungen → Postfach &ndash; passende
              Korrespondenz wird stündlich automatisch synchronisiert.
            </p>
          )}
          {threads.map((thread) => {
            const latest = thread[0];
            const isActive = latest.contactId === activeContactId;
            return (
              <Link
                key={latest.contactId}
                href={`/dashboard/inbox?contact=${latest.contactId}`}
                className={`block border-b px-4 py-3 hover:bg-muted ${isActive ? "bg-muted" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{contactDisplayName(latest.contact)}</p>
                  <p className="flex-shrink-0 text-xs text-muted-foreground">
                    {latest.sentAt.toLocaleDateString("de-DE")}
                  </p>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {latest.contact.pipeline.organization.name} &middot; {latest.contact.pipeline.name}
                </p>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {latest.direction === "OUTBOUND" ? "Du: " : ""}
                  {latest.subject ?? latest.bodyText?.slice(0, 60) ?? ""}
                </p>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          {!activeContact ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Wähle links eine Konversation aus.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b p-4">
                <div>
                  <p className="font-medium">{contactDisplayName(activeContact)}</p>
                  <p className="text-sm text-muted-foreground">{activeContact.email}</p>
                </div>
                <Link href={`/dashboard/contacts/${activeContact.id}`} className="text-sm text-primary underline">
                  Zum Kontakt
                </Link>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex flex-col gap-4">
                  {activeThreadAsc.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-2xl rounded-lg border p-3 ${
                        message.direction === "OUTBOUND" ? "ml-auto bg-primary/5" : "bg-muted/30"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-4 text-xs text-muted-foreground">
                        <span>{message.direction === "OUTBOUND" ? message.fromAddress : message.fromAddress}</span>
                        <span>
                          {message.sentAt.toLocaleDateString("de-DE")} {message.sentAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {message.subject && <p className="mb-1 text-sm font-medium">{message.subject}</p>}
                      <p className="whitespace-pre-wrap text-sm">{message.bodyText ?? "(kein Textinhalt)"}</p>
                    </div>
                  ))}
                </div>
              </div>

              <ReplyForm
                contactId={activeContact.id}
                defaultSubject={activeThread[0]?.subject ? `Re: ${activeThread[0].subject}` : ""}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
