import type { AgencyDepartment, DashboardPage } from "@prisma/client";

export const AGENCY_DEPARTMENTS: AgencyDepartment[] = ["SALES", "BACKOFFICE", "FULFILLMENT", "MARKETING", "EXECUTIVE"];

export const DEPARTMENT_LABELS: Record<AgencyDepartment, string> = {
  SALES: "Vertrieb",
  BACKOFFICE: "Backoffice",
  FULFILLMENT: "Fulfillment",
  MARKETING: "Marketing",
  EXECUTIVE: "Geschäftsführung",
};

/** Jede Abteilung hat ihre eigene Hub-Seite im Seiten-Layout-Builder (siehe getPageLayout). */
export const DEPARTMENT_HUB_PAGE: Record<AgencyDepartment, DashboardPage> = {
  SALES: "SALES_HUB",
  BACKOFFICE: "BACKOFFICE_HUB",
  FULFILLMENT: "FULFILLMENT_HUB",
  MARKETING: "MARKETING_HUB",
  EXECUTIVE: "EXECUTIVE_HUB",
};

export function isAgencyDepartment(value: string): value is AgencyDepartment {
  return (AGENCY_DEPARTMENTS as string[]).includes(value);
}
