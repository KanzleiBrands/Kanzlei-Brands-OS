import type { AgencyDepartment, UserRole } from "@prisma/client";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActivationStatus } from "@/components/activation-status";
import { DeleteUserButton } from "../clients/[orgId]/delete-user-button";
import { EditableUserName } from "../clients/[orgId]/editable-user-name";
import { NewAgencyUserForm } from "./new-agency-user-form";
import { EditableUserDepartment } from "./editable-user-department";
import { ImpersonateEmployeeButton } from "./impersonate-employee-button";
import { EditableCashflowAccess } from "./editable-cashflow-access";
import { EditableCourseManager } from "./editable-course-manager";

type AgencyUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departments: AgencyDepartment[];
  hasCashflowAccess: boolean;
  isCourseManager: boolean;
  courseManagerAllDepartments: boolean;
  courseManagerDepartments: AgencyDepartment[];
  passwordHash: string | null;
  activationToken: string | null;
  activationTokenExpiresAt: Date | null;
};

export function AgencyTeamSection({
  organizationId,
  users,
  baseUrl,
  currentUserId,
  isSuperAdmin = false,
}: {
  organizationId: string;
  users: AgencyUser[];
  baseUrl: string;
  currentUserId: string;
  /** Nur der Super-Admin (siehe src/lib/super-admin.ts) darf sich als Mitarbeiter anmelden. */
  isSuperAdmin?: boolean;
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
              <TableHead>Rolle</TableHead>
              <TableHead>Abteilung (internes Portal)</TableHead>
              {isSuperAdmin && <TableHead>Cashflow Cockpit</TableHead>}
              {isSuperAdmin && <TableHead>Kursmanager</TableHead>}
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
                    <Badge variant={user.role === "AGENCY_ADMIN" ? "default" : "secondary"}>
                      {user.role === "AGENCY_ADMIN" ? "Fulfillment" : "Internes Portal"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <EditableUserDepartment
                      userId={user.id}
                      departments={user.departments}
                      required={user.role === "AGENCY_STAFF"}
                    />
                  </TableCell>
                  {isSuperAdmin && (
                    <TableCell>
                      <EditableCashflowAccess
                        userId={user.id}
                        hasCashflowAccess={user.hasCashflowAccess}
                        lockedOn={user.departments.includes("EXECUTIVE") || user.email.toLowerCase() === "lukas@kanzlei-brands.de"}
                      />
                    </TableCell>
                  )}
                  {isSuperAdmin && (
                    <TableCell>
                      <EditableCourseManager
                        userId={user.id}
                        isCourseManager={user.isCourseManager}
                        allDepartments={user.courseManagerAllDepartments}
                        departments={user.courseManagerDepartments}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <ActivationStatus userId={user.id} isActive={!!user.passwordHash} activationLink={activationLink} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      {isSuperAdmin && user.id !== currentUserId && (
                        <ImpersonateEmployeeButton userId={user.id} userName={user.name} />
                      )}
                      {user.id !== currentUserId && <DeleteUserButton userId={user.id} userName={user.name} />}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={isSuperAdmin ? 8 : 6} className="text-center text-muted-foreground">
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
