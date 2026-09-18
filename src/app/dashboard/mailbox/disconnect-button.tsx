"use client";

import { disconnectMailbox } from "@/lib/actions/email";
import { Button } from "@/components/ui/button";

export function DisconnectButton({ accountId }: { accountId: string }) {
  return (
    <form
      action={(formData) => {
        disconnectMailbox(formData);
      }}
    >
      <input type="hidden" name="accountId" value={accountId} />
      <Button type="submit" variant="outline" size="sm">
        Trennen
      </Button>
    </form>
  );
}
