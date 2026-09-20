import { completeTask, reopenTask, deleteTask } from "@/lib/actions/tasks";
import { Button } from "@/components/ui/button";

type Task = {
  id: string;
  title: string;
  dueAt: string;
  completedAt: string | null;
  repeatIntervalDays: number | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function TaskList({ tasks }: { tasks: Task[] }) {
  const open = [...tasks.filter((t) => !t.completedAt)].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const done = [...tasks.filter((t) => t.completedAt)].sort((a, b) => b.dueAt.localeCompare(a.dueAt));
  const now = Date.now();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {open.length === 0 && <p className="text-sm text-muted-foreground">Keine offenen Wiedervorlagen.</p>}
        {open.map((task) => {
          const overdue = new Date(task.dueAt).getTime() < now;
          return (
            <div
              key={task.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${
                overdue ? "border-destructive/50 bg-destructive/5" : ""
              }`}
            >
              <div>
                <p className="font-medium">{task.title}</p>
                <p className={`text-sm ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                  Fällig: {formatDate(task.dueAt)}
                  {overdue ? " (überfällig)" : ""}
                  {task.repeatIntervalDays ? ` · wiederholt sich alle ${task.repeatIntervalDays} Tage` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <form action={completeTask}>
                  <input type="hidden" name="taskId" value={task.id} />
                  <Button type="submit" size="sm">
                    Erledigt
                  </Button>
                </form>
                <form action={deleteTask}>
                  <input type="hidden" name="taskId" value={task.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Löschen
                  </Button>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      {done.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Erledigte Wiedervorlagen ({done.length})</summary>
          <div className="mt-2 flex flex-col gap-2">
            {done.map((task) => (
              <div
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 opacity-70"
              >
                <div>
                  <p className="font-medium line-through">{task.title}</p>
                  <p className="text-sm text-muted-foreground">Fällig war: {formatDate(task.dueAt)}</p>
                </div>
                <form action={reopenTask}>
                  <input type="hidden" name="taskId" value={task.id} />
                  <Button type="submit" size="sm" variant="outline">
                    Wieder öffnen
                  </Button>
                </form>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
