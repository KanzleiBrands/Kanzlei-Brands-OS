import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const organization = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Willkommen, {session.user.name}</h1>
      <p className="text-muted-foreground">
        {organization?.name} · Rolle: {session.user.role}
      </p>
    </div>
  );
}
