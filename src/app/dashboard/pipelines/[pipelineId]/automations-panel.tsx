"use client";

import { useTransition } from "react";
import type { AutomationTrigger, PipelineKind } from "@prisma/client";
import { toggleAutomationRule, updateAutomationRecipient } from "@/lib/actions/automations";
import { automationTriggerLabel, AUTOMATION_TRIGGERS } from "@/lib/automation-labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

type Rule = { trigger: AutomationTrigger; active: boolean; recipientUserId: string | null };
type OrgUser = { id: string; name: string };

function RuleRow({
  pipelineId,
  pipelineKind,
  rule,
  users,
  senderEmail,
}: {
  pipelineId: string;
  pipelineKind: PipelineKind;
  rule: Rule;
  users: OrgUser[];
  senderEmail: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
          {automationTriggerLabel(rule.trigger, pipelineKind)}
        </span>
        <span className="text-sm text-muted-foreground">von: {senderEmail}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={rule.recipientUserId ?? ""}
          onValueChange={(value) => {
            const formData = new FormData();
            formData.set("pipelineId", pipelineId);
            formData.set("trigger", rule.trigger);
            formData.set("recipientUserId", value ?? "");
            startTransition(() => {
              updateAutomationRecipient(formData);
            });
          }}
        >
          <SelectTrigger className="w-40 sm:w-48">
            <SelectValue>{(value: string) => users.find((u) => u.id === value)?.name ?? "Empfänger wählen"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            defaultChecked={rule.active}
            disabled={isPending}
            onCheckedChange={(checked) => {
              const formData = new FormData();
              formData.set("pipelineId", pipelineId);
              formData.set("trigger", rule.trigger);
              formData.set("active", String(checked));
              startTransition(() => {
                toggleAutomationRule(formData);
              });
            }}
          />
          Aktiv
        </label>
      </div>
    </div>
  );
}

export function AutomationsPanel({
  pipelineId,
  pipelineKind,
  rules,
  users,
  senderEmail,
}: {
  pipelineId: string;
  pipelineKind: PipelineKind;
  rules: Rule[];
  users: OrgUser[];
  senderEmail: string;
}) {
  const rulesByTrigger = new Map(rules.map((r) => [r.trigger, r]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automatisierungen</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Erinnert per E-Mail, wenn ein {pipelineKind === "APPLICANTS" ? "Bewerber" : "Lead"} nach Eingang zu lange
          unbearbeitet bleibt.
        </p>
        {AUTOMATION_TRIGGERS.map((trigger) => (
          <RuleRow
            key={trigger}
            pipelineId={pipelineId}
            pipelineKind={pipelineKind}
            rule={rulesByTrigger.get(trigger) ?? { trigger, active: false, recipientUserId: null }}
            users={users}
            senderEmail={senderEmail}
          />
        ))}
        {users.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Noch keine Mitarbeiter in diesem Kunden angelegt, um sie als Empfänger auszuwählen.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
