import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActivationStatus } from "@/components/activation-status";
import { DeleteUserButton } from "../clients/[orgId]/delete-user-button";
import { EditableUserName } from "../clients/[orgId]/editable-user-name";
import { NewAgencyUserForm } from "./new-agency-user-form";

type AgencyUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null;
  activationToken: string | null;
  activationTokenExpiresAt: Date | null;
};

export function AgencyTeamSection({
  organizationId,
  users,
  baseUrl,
  currentUserId,
}: {
  organizationId: string;
  users: AgencyUser[];
  baseUrl: string;
  currentUserId: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mitarbeiter</CardTitle>
        <CardAction>
          <NewAgencyUserForm organizationId={organizationId} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>Zugang</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const activationLink =
                user.activationToken && user.activationTokenExpiresAt && user.activationTokenExpiresAt > new Date()
                  ? `${baseUrl}/activate/${user.activationToken}`
                  : null;
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <EditableUserName userId={user.id} name={user.name} />
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <ActivationStatus userId={user.id} isActive={!!user.passwordHash} activationLink={activationLink} />
                  </TableCell>
                  <TableCell>
                    {user.id !== currentUserId && <DeleteUserButton userId={user.id} userName={user.name} />}
                  </TableCell>
                </TableRow>
              );
            })}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Noch keine Mitarbeiter angelegt.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
