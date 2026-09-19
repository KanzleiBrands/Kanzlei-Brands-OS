"use client";

import Link from "next/link";
import { useMemo, useTransition } from "react";
import { moveContactStage } from "@/lib/actions/contacts";
import { initialsOf, avatarColorFor } from "@/lib/avatar";
import { CONTACT_SOURCE_LABELS } from "@/lib/contact-source-labels";
import { Button } from "@/components/ui/button";
import { DeleteContactButton } from "@/components/delete-contact-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Contact = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  source: string;
  createdAt: Date;
  rejectionReason: string | null;
};

type Stage = {
  id: string;
  name: string;
  color: string | null;
  contacts: Contact[];
};

function ReactivateButton({ contactId, reactivateStageId }: { contactId: string; reactivateStageId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        const formData = new FormData();
        formData.set("contactId", contactId);
        formData.set("stageId", reactivateStageId);
        startTransition(() => {
          moveContactStage(formData);
        });
      }}
    >
      {isPending ? "..." : "Reaktivieren"}
    </Button>
  );
}

export function ExcludedContactsTable({
  stages,
  reactivateStageId,
  pipelineKind,
}: {
  stages: Stage[];
  reactivateStageId: string | undefined;
  pipelineKind: string;
}) {
  const rows = useMemo(
    () =>
      stages.flatMap((stage) =>
        stage.contacts.map((contact) => ({ ...contact, stageName: stage.name, stageColor: stage.color })),
      ),
    [stages],
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Kontakt</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Grund</TableHead>
          <TableHead>Quelle</TableHead>
          <TableHead>Eingang</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((contact) => {
          const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unbenannt";
          return (
            <TableRow key={contact.id}>
              <TableCell>
                <Link href={`/dashboard/contacts/${contact.id}`} className="flex items-center gap-2">
                  <span
                    className="flex size-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                    style={{ backgroundColor: avatarColorFor(fullName) }}
                  >
                    {initialsOf(contact.firstName, contact.lastName)}
                  </span>
                  <span>
                    <span className="block font-medium">{fullName}</span>
                    <span className="block text-xs text-muted-foreground">{contact.email}</span>
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <span
                    className="inline-block size-2 rounded-full"
                    style={{ backgroundColor: contact.stageColor ?? "var(--muted-foreground)" }}
                  />
                  {contact.stageName}
                </span>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{contact.rejectionReason ?? "-"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {CONTACT_SOURCE_LABELS[contact.source] ?? contact.source}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {contact.createdAt.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {reactivateStageId && <ReactivateButton contactId={contact.id} reactivateStageId={reactivateStageId} />}
                  <DeleteContactButton contactId={contact.id} contactName={fullName} />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              {pipelineKind === "LEADS" ? "Keine ungeeigneten Kontakte." : "Keine ausgeschlossenen Kontakte."}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
