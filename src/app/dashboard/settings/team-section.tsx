import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { NewUserForm } from "../clients/[orgId]/new-user-form";
import { PipelineAccessToggle } from "../clients/[orgId]/pipeline-access-toggle";
import { ActivationStatus } from "@/components/activation-status";
import { DeleteUserButton } from "../clients/[orgId]/delete-user-button";

type Pipeline = { id: string; name: string };
type PipelineAccess = { pipelineId: string };
type TeamUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  passwordHash: string | null;
  activationToken: string | null;
  activationTokenExpiresAt: Date | null;
  pipelineAccess: PipelineAccess[];
};

export function TeamSection({
  organizationId,
  users,
  pipelines,
  baseUrl,
  currentUserId,
}: {
  organizationId: string;
  users: TeamUser[];
  pipelines: Pipeline[];
  baseUrl: string;
  currentUserId: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <NewUserForm organizationId={organizationId} canAssignAdmin={false} />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>Rolle</TableHead>
              <TableHead>Zugang</TableHead>
              <TableHead>Kampagnen-Zugriff</TableHead>
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
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "CLIENT_ADMIN" ? "default" : "secondary"}>
                      {user.role === "CLIENT_ADMIN" ? "Admin" : "Mitarbeiter"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ActivationStatus userId={user.id} isActive={!!user.passwordHash} activationLink={activationLink} />
                  </TableCell>
                  <TableCell>
                    {user.role === "CLIENT_STAFF" ? (
                      <div className="flex flex-wrap gap-3">
                        {pipelines.map((pipeline) => {
                          const granted = user.pipelineAccess.some((a) => a.pipelineId === pipeline.id);
                          return (
                            <label key={pipeline.id} className="flex items-center gap-1 text-sm">
                              <PipelineAccessToggle userId={user.id} pipelineId={pipeline.id} granted={granted} />
                              {pipeline.name}
                            </label>
                          );
                        })}
                        {pipelines.length === 0 && (
                          <span className="text-sm text-muted-foreground">Keine Kampagnen vorhanden</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Voller Zugriff (Admin)</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.role === "CLIENT_STAFF" && user.id !== currentUserId && (
                      <DeleteUserButton userId={user.id} userName={user.name} />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
