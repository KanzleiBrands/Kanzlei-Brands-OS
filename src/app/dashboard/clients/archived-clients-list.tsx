import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReactivateOrganizationButton } from "./[orgId]/reactivate-organization-button";

type ArchivedClient = { id: string; name: string; archivedAt: Date | null };

export function ArchivedClientsList({ clients }: { clients: ArchivedClient[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Kunde</TableHead>
          <TableHead>Archiviert am</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((client) => (
          <TableRow key={client.id}>
            <TableCell className="font-medium">
              <Link href={`/dashboard/clients/${client.id}`} className="hover:underline">
                {client.name}
              </Link>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {client.archivedAt
                ? client.archivedAt.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
                : "-"}
            </TableCell>
            <TableCell>
              <ReactivateOrganizationButton organizationId={client.id} />
            </TableCell>
          </TableRow>
        ))}
        {clients.length === 0 && (
          <TableRow>
            <TableCell colSpan={3} className="text-center text-muted-foreground">
              Keine archivierten Kunden.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
