"use client";

import Link from "next/link";
import { avatarColorFor } from "@/lib/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ClientSwitcher({
  currentLabel,
  clients,
}: {
  currentLabel: string;
  clients: { id: string; name: string }[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted">
        <span className="truncate font-medium">{currentLabel}</span>
        <span className="text-muted-foreground">⌄</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Kunden</DropdownMenuLabel>
          <DropdownMenuItem render={<Link href="/dashboard" />} className="gap-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-background">
              A
            </span>
            Alle Kunden
          </DropdownMenuItem>
          {clients.map((client) => (
            <DropdownMenuItem key={client.id} render={<Link href={`/dashboard/clients/${client.id}`} />} className="gap-2">
              <span
                className="flex size-5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                style={{ backgroundColor: avatarColorFor(client.name) }}
              >
                {client.name[0]?.toUpperCase()}
              </span>
              <span className="truncate">{client.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
