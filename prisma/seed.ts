import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const agency = await prisma.organization.upsert({
    where: { slug: "kanzlei-brands" },
    update: {},
    create: {
      type: "AGENCY",
      name: "Kanzlei Brands",
      slug: "kanzlei-brands",
      logoUrl: "/brand/logo-on-dark.svg",
      primaryColor: "#B9975B",
    },
  });

  const agencyAdminPassword = await bcrypt.hash("changeme123", 10);
  await prisma.user.upsert({
    where: { email: "lukas@kanzlei-brands.de" },
    update: {},
    create: {
      email: "lukas@kanzlei-brands.de",
      name: "Lukas",
      role: "AGENCY_ADMIN",
      passwordHash: agencyAdminPassword,
      organizationId: agency.id,
    },
  });

  const demoClient = await prisma.organization.upsert({
    where: { slug: "demo-kunde" },
    update: {},
    create: {
      type: "CLIENT",
      name: "Demo Kunde GmbH",
      slug: "demo-kunde",
      parentId: agency.id,
    },
  });

  const clientAdminPassword = await bcrypt.hash("changeme123", 10);
  await prisma.user.upsert({
    where: { email: "admin@demo-kunde.de" },
    update: {},
    create: {
      email: "admin@demo-kunde.de",
      name: "Demo Kunde Admin",
      role: "CLIENT_ADMIN",
      passwordHash: clientAdminPassword,
      organizationId: demoClient.id,
    },
  });

  const leadPipeline = await prisma.pipeline.create({
    data: {
      name: "Website Leads",
      kind: "LEADS",
      organizationId: demoClient.id,
      stages: {
        create: [
          { name: "Neu", order: 0 },
          { name: "Kontaktiert", order: 1 },
          { name: "Termin vereinbart", order: 2 },
          { name: "Gewonnen", order: 3 },
          { name: "Verloren", order: 4 },
        ],
      },
    },
  });

  await prisma.webhookEndpoint.create({
    data: {
      source: "GENERIC",
      organizationId: demoClient.id,
      pipelineId: leadPipeline.id,
    },
  });

  await prisma.course.upsert({
    where: { id: "seed-onboarding-course" },
    update: {},
    create: {
      id: "seed-onboarding-course",
      title: "Plattform-Onboarding",
      description: "Erste Schritte auf der Kanzlei Brands Plattform.",
      category: "ONBOARDING",
      published: true,
      lessons: {
        create: [
          { title: "Willkommen & Rundgang", order: 0 },
          { title: "Leads verwalten", order: 1 },
        ],
      },
    },
  });

  // Offers are scoped to the client organization that should see them in its Kunden-Hub.
  await prisma.offer.create({
    data: {
      title: "Performance-Marketing Paket",
      description: "Zusätzliche Meta & LinkedIn Kampagnen für mehr Leads.",
      organizationId: demoClient.id,
    },
  });

  console.log("Seed complete.");
  console.log("Agency admin login: lukas@kanzlei-brands.de / changeme123");
  console.log("Client admin login: admin@demo-kunde.de / changeme123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
