import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { NewUserForm } from "./new-user-form";
import { PipelineAccessToggle } from "./pipeline-access-toggle";
import { CourseAssignmentToggle } from "./course-assignment-toggle";
import { ActivationStatus } from "@/components/activation-status";

type Pipeline = { id: string; name: string };
type Course = { id: string; title: string };
type PipelineAccess = { pipelineId: string };
type OrgUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  passwordHash: string | null;
  activationToken: string | null;
  activationTokenExpiresAt: Date | null;
  pipelineAccess: PipelineAccess[];
};

export function SettingsTab({
  organizationId,
  organizationName,
  users,
  pipelines,
  courses,
  assignedCourseIds,
  baseUrl,
}: {
  organizationId: string;
  organizationName: string;
  users: OrgUser[];
  pipelines: Pipeline[];
  courses: Course[];
  assignedCourseIds: Set<string>;
  baseUrl: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Kunde</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p>
            <span className="text-muted-foreground">Name:</span> {organizationName}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mitarbeiter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <NewUserForm organizationId={organizationId} canAssignAdmin />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Zugang</TableHead>
                <TableHead>Kampagnen-Zugriff</TableHead>
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
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schulung</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Wähle, welche Kurse dieser Kunde in seinem Schulungsbereich sehen kann.
          </p>
          <div className="flex flex-wrap gap-3">
            {courses.map((course) => (
              <label key={course.id} className="flex items-center gap-1.5 text-sm">
                <CourseAssignmentToggle
                  organizationId={organizationId}
                  courseId={course.id}
                  assigned={assignedCourseIds.has(course.id)}
                />
                {course.title}
              </label>
            ))}
            {courses.length === 0 && <span className="text-sm text-muted-foreground">Noch keine Kurse angelegt.</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
