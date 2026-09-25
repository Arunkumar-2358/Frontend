import Link from "next/link";
import type { TaskType } from "@contracts";
import { api } from "@/lib/api/client";
import { formatDateTime } from "@contracts/shared/dates";
import { PageHeader, Card, Table, Td, Badge, Input, humanize, LinkButton } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { completeTaskAction } from "./actions";

export const metadata = { title: "My tasks" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ scope?: string; type?: string }> }) {
  const sp = await searchParams;
  const { scope, canViewTeam: isLeader, tasks } = await api("GET /v1/tasks", { query: { scope: sp.scope === "team" ? "team" : undefined, type: sp.type as TaskType | undefined } });
  const t = Date.now();
  return (
    <>
      <PageHeader
        title={scope === "team" ? "Team tasks" : "My tasks"}
        subtitle={`${tasks.length} open · ${tasks.filter((x) => x.dueAt.getTime() <= t).length} due now or overdue`}
        actions={isLeader ? <LinkButton href={scope === "team" ? "/tasks" : "/tasks?scope=team"}>{scope === "team" ? "Show mine" : "Show my team"}</LinkButton> : undefined}
      />
      <Card pad={false}>
        <Table head={["Due", "Task", "Lead", scope === "team" ? "Assignee" : "", "Complete"]} empty="No open tasks — nice work.">
          {tasks.map((task) => {
            const overdue = task.dueAt.getTime() <= t;
            return (
              <tr key={task.id} className={overdue ? "bg-red-50/40" : undefined}>
                <Td className="whitespace-nowrap">
                  <div className={overdue ? "font-medium text-red-600" : ""}>{formatDateTime(task.dueAt)}</div>
                  <Badge tone={overdue ? "red" : "slate"}>{humanize(task.type)}</Badge>
                </Td>
                <Td>{task.title}</Td>
                <Td>
                  {task.candidate ? (
                    <Link className="text-brand-600 hover:underline" href={`/leads/${task.candidate.id}`}>
                      {task.candidate.name} <span className="text-xs text-slate-400">{task.candidate.candidateCode}</span>
                    </Link>
                  ) : task.refType === "red_flag" ? (
                    <Link className="text-brand-600 hover:underline" href={`/red-flags/${task.refId}`}>Red flag</Link>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td>{scope === "team" ? task.assignee?.name ?? "Unassigned" : ""}</Td>
                <Td>
                  <ActionForm action={completeTaskAction} className="flex min-w-56 gap-2">
                    <input type="hidden" name="taskId" value={task.id} />
                    <Input name="result" placeholder="Result / note" className="py-1 text-xs" />
                    <Submit size="sm" variant="secondary">Done</Submit>
                  </ActionForm>
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </>
  );
}
