import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { contactDisplayName } from "@/lib/contact-display";
import { completeTask, reopenTask } from "@/lib/actions/tasks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function formatDate(value: Date) {
  return value.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function TasksPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const tasks = await prisma.task.findMany({
    where: { assignedToUserId: session.user.id },
    include: { contact: { select: { id: true, firstName: true, lastName: true, companyName: true } } },
    orderBy: { dueAt: "asc" },
  });

  const now = Date.now();
  const open = tasks.filter((t) => !t.completedAt);
  const done = tasks.filter((t) => t.completedAt).sort((a, b) => b.dueAt.getTime() - a.dueAt.getTime());
  const overdue = open.filter((t) => t.dueAt.getTime() < now);
  const upcoming = open.filter((t) => t.dueAt.getTime() >= now);

  function TaskRow({ task }: { task: (typeof tasks)[number] }) {
    const isOverdue = !task.completedAt && task.dueAt.getTime() < now;
    return (
      <div
        className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${
          isOverdue ? "border-destructive/50 bg-destructive/5" : ""
        } ${task.completedAt ? "opacity-70" : ""}`}
      >
        <div>
          <Link href={`/dashboard/contacts/${task.contact.id}?tab=tasks`} className="font-medium hover:underline">
            <span className={task.completedAt ? "line-through" : undefined}>{task.title}</span>
          </Link>
          <p className={`text-sm ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
            {contactDisplayName(task.contact)} · Fällig: {formatDate(task.dueAt)}
            {isOverdue ? " (überfällig)" : ""}
            {task.repeatIntervalDays ? ` · wiederholt sich alle ${task.repeatIntervalDays} Tage` : ""}
          </p>
        </div>
        {task.completedAt ? (
          <form action={reopenTask}>
            <input type="hidden" name="taskId" value={task.id} />
            <Button type="submit" size="sm" variant="outline">
              Wieder öffnen
            </Button>
          </form>
        ) : (
          <form action={completeTask}>
            <input type="hidden" name="taskId" value={task.id} />
            <Button type="submit" size="sm">
              Erledigt
            </Button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-semibold">Meine Wiedervorlagen - {session.user.name}</h1>
      <p className="mb-6 text-muted-foreground">
        Alle deine Wiedervorlagen aus jeder Kampagne an einem Ort. Bei Fälligkeit bekommst du zusätzlich eine
        E-Mail-Erinnerung.
      </p>

      <div className="flex flex-col gap-6">
        {overdue.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">Überfällig ({overdue.length})</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {overdue.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Anstehend ({upcoming.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Keine anstehenden Wiedervorlagen.</p>}
            {upcoming.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </CardContent>
        </Card>

        {done.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground">
              Erledigte Wiedervorlagen ({done.length})
            </summary>
            <div className="mt-3 flex flex-col gap-2">
              {done.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
