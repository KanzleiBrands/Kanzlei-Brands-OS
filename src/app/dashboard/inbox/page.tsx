import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, InboxIcon, MailOpenIcon } from "lucide-react";
import { requireSession } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { contactDisplayName } from "@/lib/contact-display";
import { initialsOf, avatarColorFor } from "@/lib/avatar";
import { ReplyForm } from "./reply-form";

function formatListDate(date: Date): string {
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Gestern";
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

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

  // On mobile, list and thread are two separate screens (master/detail) toggled
  // by whether ?contact= is present - a permanent two-pane row doesn't fit a
  // phone viewport. md+ always shows both panes side by side.
  const showListOnMobile = !selectedContactId;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col md:h-[calc(100vh-4rem)]">
      <div className="border-b p-4 sm:p-6">
        <h1 className="text-2xl font-semibold">Posteingang</h1>
        <p className="text-muted-foreground">
          E-Mail-Korrespondenz mit Leads &amp; Bewerbern aus allen verbundenen Postfächern.
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div
          className={`${showListOnMobile ? "block" : "hidden"} w-full flex-shrink-0 overflow-y-auto border-r md:block md:w-80`}
        >
          {threads.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
              <InboxIcon className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Noch keine E-Mails. Verbinde ein Postfach unter Einstellungen → Postfach &ndash; passende
                Korrespondenz wird alle 15 Minuten automatisch synchronisiert.
              </p>
            </div>
          )}
          {threads.map((thread) => {
            const latest = thread[0];
            const isActive = latest.contactId === activeContactId;
            const needsReply = latest.direction === "INBOUND";
            const name = contactDisplayName(latest.contact);
            return (
              <Link
                key={latest.contactId}
                href={`/dashboard/inbox?contact=${latest.contactId}`}
                className={`flex items-start gap-3 border-b px-4 py-3 transition-colors hover:bg-muted ${isActive ? "bg-muted" : ""}`}
              >
                <div
                  className="flex size-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: avatarColorFor(name) }}
                >
                  {initialsOf(latest.contact.firstName, latest.contact.lastName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="flex-shrink-0 text-xs text-muted-foreground">{formatListDate(latest.sentAt)}</p>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {latest.contact.pipeline.organization.name} &middot; {latest.contact.pipeline.name}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    {needsReply && <span className="size-1.5 flex-shrink-0 rounded-full bg-primary" aria-hidden="true" />}
                    <p className={`truncate text-sm ${needsReply ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                      {latest.direction === "OUTBOUND" ? "Du: " : ""}
                      {latest.subject ?? latest.bodyText?.slice(0, 60) ?? ""}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className={`${showListOnMobile ? "hidden" : "flex"} w-full flex-1 flex-col overflow-hidden md:flex`}>
          {!activeContact ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <MailOpenIcon className="size-8 text-muted-foreground/50" />
              Wähle links eine Konversation aus.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b p-4">
                <Link href="/dashboard/inbox" aria-label="Zurück zur Übersicht" className="text-muted-foreground hover:text-foreground md:hidden">
                  <ArrowLeftIcon className="size-5" />
                </Link>
                <div
                  className="flex size-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: avatarColorFor(contactDisplayName(activeContact)) }}
                >
                  {initialsOf(activeContact.firstName, activeContact.lastName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{contactDisplayName(activeContact)}</p>
                  <p className="truncate text-sm text-muted-foreground">{activeContact.email}</p>
                </div>
                <Link
                  href={`/dashboard/contacts/${activeContact.id}`}
                  className="flex-shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
                >
                  Zum Kontakt
                </Link>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex flex-col gap-3">
                  {activeThreadAsc.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[85%] rounded-2xl border px-4 py-3 shadow-sm sm:max-w-2xl ${
                        message.direction === "OUTBOUND" ? "ml-auto bg-primary/5" : "bg-card"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-4 text-xs text-muted-foreground">
                        <span>{message.fromAddress}</span>
                        <span>
                          {message.sentAt.toLocaleDateString("de-DE")}{" "}
                          {message.sentAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
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
