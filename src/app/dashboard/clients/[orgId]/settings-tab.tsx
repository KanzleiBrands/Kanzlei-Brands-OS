import Link from "next/link";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { NewUserForm } from "./new-user-form";
import { PipelineAccessToggle } from "./pipeline-access-toggle";
import { CourseAssignmentToggle } from "./course-assignment-toggle";
import { ActivationStatus } from "@/components/activation-status";
import { DeleteUserButton } from "./delete-user-button";
import { EditableUserName } from "./editable-user-name";
import { ImpersonateUserButton } from "./impersonate-user-button";
import { ArchiveOrganizationButton } from "./archive-organization-button";
import { ReactivateOrganizationButton } from "./reactivate-organization-button";
import { EditClientNameForm } from "./edit-client-name-form";
import { QuotaSettingsForm } from "./quota-settings-form";
import { IntakeSettingsForm } from "./intake-settings-form";
import { HubSettingsForm } from "./hub-settings-form";
import { MonthlyReportToggle } from "./monthly-report-toggle";
import { DataRetentionForm } from "./data-retention-form";

export type SettingsSubTab = "general" | "team" | "board" | "training" | "danger";

const SETTINGS_SUBTABS: { value: SettingsSubTab; label: string }[] = [
  { value: "general", label: "Allgemein" },
  { value: "team", label: "Mitarbeiter" },
  { value: "board", label: "Kundenboard & Hub" },
  { value: "training", label: "Schulung" },
  { value: "danger", label: "Gefahrenzone" },
];

export const SETTINGS_SUBTAB_VALUES: SettingsSubTab[] = SETTINGS_SUBTABS.map((s) => s.value);

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
  subTab,
  organizationId,
  organizationName,
  archivedAt,
  users,
  pipelines,
  courses,
  assignedCourseIds,
  baseUrl,
  leadsQuota,
  applicantsQuota,
  leadsUsed,
  applicantsUsed,
  accountManagerId,
  backofficeContactId,
  leadsFormUrl,
  applicantsFormUrl,
  agencyUsers,
  monthlyReportEnabled,
  applicantDataRetentionMonths,
  leadDataRetentionMonths,
  driveFolderUrl,
  landingPageUrl,
  metaAdLibraryUrl,
  linkedInAdLibraryUrl,
  bookedProductTags,
  availableProductTags,
  activeApplicantChannels,
  activeLeadChannels,
  jobsBooked,
  leadsBooked,
  inviteReadiness,
}: {
  organizationId: string;
  organizationName: string;
  archivedAt: Date | null;
  users: OrgUser[];
  pipelines: Pipeline[];
  courses: Course[];
  assignedCourseIds: Set<string>;
  baseUrl: string;
  leadsQuota: number | null;
  applicantsQuota: number | null;
  leadsUsed: number;
  applicantsUsed: number;
  accountManagerId: string | null;
  backofficeContactId: string | null;
  leadsFormUrl: string | null;
  applicantsFormUrl: string | null;
  agencyUsers: { id: string; name: string }[];
  monthlyReportEnabled: boolean;
  applicantDataRetentionMonths: number | null;
  leadDataRetentionMonths: number | null;
  driveFolderUrl: string | null;
  landingPageUrl: string | null;
  metaAdLibraryUrl: string | null;
  linkedInAdLibraryUrl: string | null;
  bookedProductTags: string[];
  availableProductTags: string[];
  activeApplicantChannels: string[];
  activeLeadChannels: string[];
  jobsBooked: boolean;
  leadsBooked: boolean;
  inviteReadiness: { ready: boolean; missing: string[] };
  subTab: SettingsSubTab;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 overflow-x-auto border-b">
        {SETTINGS_SUBTABS.map((s) => (
          <Link
            key={s.value}
            href={`/dashboard/clients/${organizationId}?tab=settings&subtab=${s.value}`}
            className={`flex-shrink-0 border-b-2 px-2.5 py-2 text-sm whitespace-nowrap ${
              subTab === s.value
                ? "border-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {subTab === "general" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Kunde</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <EditClientNameForm organizationId={organizationId} name={organizationName} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kampagnen-Kontingente</CardTitle>
            </CardHeader>
            <CardContent>
              <QuotaSettingsForm
                organizationId={organizationId}
                leadsQuota={leadsQuota}
                applicantsQuota={applicantsQuota}
                leadsUsed={leadsUsed}
                applicantsUsed={applicantsUsed}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reporting</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                Automatischer Performance-Report per E-Mail an die Admins dieses Kunden, immer am letzten Tag des
                Monats.
              </p>
              <MonthlyReportToggle organizationId={organizationId} enabled={monthlyReportEnabled} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Datenschutz (DSGVO)</CardTitle>
            </CardHeader>
            <CardContent>
              <DataRetentionForm
                organizationId={organizationId}
                applicantDataRetentionMonths={applicantDataRetentionMonths}
                leadDataRetentionMonths={leadDataRetentionMonths}
              />
            </CardContent>
          </Card>
        </>
      )}

      {subTab === "board" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Kundenboard: weitere Kampagnen beauftragen</CardTitle>
            </CardHeader>
            <CardContent>
              <IntakeSettingsForm
                organizationId={organizationId}
                accountManagerId={accountManagerId}
                backofficeContactId={backofficeContactId}
                leadsFormUrl={leadsFormUrl}
                applicantsFormUrl={applicantsFormUrl}
                agencyUsers={agencyUsers}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kunden-Hub</CardTitle>
            </CardHeader>
            <CardContent>
              <HubSettingsForm
                organizationId={organizationId}
                driveFolderUrl={driveFolderUrl}
                landingPageUrl={landingPageUrl}
                metaAdLibraryUrl={metaAdLibraryUrl}
                linkedInAdLibraryUrl={linkedInAdLibraryUrl}
                bookedProductTags={bookedProductTags}
                availableProductTags={availableProductTags}
                activeApplicantChannels={activeApplicantChannels}
                activeLeadChannels={activeLeadChannels}
                jobsBooked={jobsBooked}
                leadsBooked={leadsBooked}
              />
            </CardContent>
          </Card>
        </>
      )}

      {subTab === "team" && (
        <Card>
          <CardHeader>
            <CardTitle>Mitarbeiter</CardTitle>
            <CardAction>
              <NewUserForm organizationId={organizationId} canAssignAdmin inviteReadiness={inviteReadiness} />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Zugang</TableHead>
                  <TableHead>Kampagnen-Zugriff</TableHead>
                  <TableHead className="w-20" />
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
                      <div className="flex items-center gap-0.5">
                        <ImpersonateUserButton userId={user.id} userName={user.name} />
                        <DeleteUserButton userId={user.id} userName={user.name} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {subTab === "training" && (
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
      )}

      {subTab === "danger" && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle>Gefahrenzone</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {archivedAt ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Dieser Kunde ist archiviert und in der Kunden-Übersicht ausgeblendet. Alle Daten sind weiterhin
                  vorhanden.
                </p>
                <div>
                  <ReactivateOrganizationButton organizationId={organizationId} />
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Archiviert diesen Kunden. Er verschwindet aus der Kunden-Übersicht, alle Daten (Kampagnen,
                  Kontakte, Mitarbeiter, Lead-Quellen) bleiben erhalten und du kannst ihn jederzeit wieder
                  reaktivieren.
                </p>
                <div>
                  <ArchiveOrganizationButton organizationId={organizationId} organizationName={organizationName} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
