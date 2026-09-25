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
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col p-4 sm:h-[calc(100vh-4rem)] sm:p-8">
      <div className={`${showListOnMobile ? "block" : "hidden"} shrink-0 md:block`}>
        <h1 className="mb-2 text-2xl font-semibold">Posteingang</h1>
        <p className="mb-4 text-muted-foreground sm:mb-6">
          E-Mail-Korrespondenz mit Leads &amp; Bewerbern aus allen verbundenen Postfächern.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <div
          className={`${showListOnMobile ? "block" : "hidden"} w-full flex-shrink-0 overflow-y-auto border-r border-foreground/10 md:block md:w-80 lg:w-96`}
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
          <div className="flex flex-col gap-1 p-2">
            {threads.map((thread) => {
              const latest = thread[0];
              const isActive = latest.contactId === activeContactId;
              const needsReply = latest.direction === "INBOUND";
              const name = contactDisplayName(latest.contact);
              return (
                <Link
                  key={latest.contactId}
                  href={`/dashboard/inbox?contact=${latest.contactId}`}
                  className={`flex items-start gap-3 rounded-xl px-3 py-3 transition-colors ${
                    isActive ? "bg-primary/10" : "hover:bg-muted"
                  }`}
                >
                  <div
                    className="flex size-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: avatarColorFor(name) }}
                  >
                    {initialsOf(latest.contact.firstName, latest.contact.lastName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`truncate text-sm ${needsReply ? "font-semibold" : "font-medium"}`}>{name}</p>
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
        </div>

        <div className={`${showListOnMobile ? "hidden" : "flex"} w-full flex-1 flex-col overflow-hidden md:flex`}>
          {!activeContact ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <MailOpenIcon className="size-8 text-muted-foreground/50" />
              Wähle links eine Konversation aus.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-foreground/10 px-4 py-3.5">
                <Link
                  href="/dashboard/inbox"
                  aria-label="Zurück zur Übersicht"
                  className="text-muted-foreground hover:text-foreground md:hidden"
                >
                  <ArrowLeftIcon className="size-5" />
                </Link>
                <div
                  className="flex size-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
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
                  className="flex-shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
                >
                  Zum Kontakt
                </Link>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="flex flex-col gap-4">
                  {activeThreadAsc.map((message) => {
                    const isOutbound = message.direction === "OUTBOUND";
                    return (
                      <div
                        key={message.id}
                        className={`max-w-[88%] rounded-2xl px-4 py-3 sm:max-w-xl ${
                          isOutbound
                            ? "ml-auto rounded-br-md bg-primary text-primary-foreground"
                            : "rounded-bl-md bg-muted"
                        }`}
                      >
                        <div
                          className={`mb-1.5 flex items-center justify-between gap-4 text-xs ${
                            isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
                          }`}
                        >
                          <span className="truncate">{message.fromAddress}</span>
                          <span className="flex-shrink-0">
                            {message.sentAt.toLocaleDateString("de-DE")}{" "}
                            {message.sentAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {message.subject && <p className="mb-1 text-sm font-semibold">{message.subject}</p>}
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {message.bodyText ?? "(kein Textinhalt)"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <ReplyForm
                key={activeContact.id}
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
