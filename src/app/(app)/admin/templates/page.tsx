import { prisma } from "@/lib/db";
import { formatDateTime } from "@contracts/shared/dates";
import { PageHeader, Card, Badge } from "@/components/ui";
import { TemplateEditor } from "./editor";
import { PLACEHOLDERS } from "./placeholders";

export const metadata = { title: "Message templates" };

export default async function TemplatesPage() {
  const templates = await prisma.messageTemplate.findMany({ orderBy: [{ key: "asc" }] });
  return (
    <>
      <PageHeader title="Message templates" subtitle="WhatsApp, SMS and email templates used by outreach, interview reminders and offers." />
      <Card className="mb-4">
        <p className="text-sm text-slate-600">
          Available placeholders:{" "}
          {Object.keys(PLACEHOLDERS).map((k) => (
            <code key={k} className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">{`{{${k}}}`}</code>
          ))}
        </p>
        <p className="mt-1 text-xs text-slate-400">The code refers to templates by key (e.g. enrolment_link_whatsapp) — change a key only if nothing depends on it. Unknown placeholders render empty when sent.</p>
      </Card>
      <div className="space-y-4">
        {templates.map((t) => (
          <Card key={t.id} title={<>{t.name} <span className="ml-1 font-mono text-xs text-slate-400">{t.key}</span></>} actions={<span className="flex items-center gap-2 text-xs text-slate-400">Updated {formatDateTime(t.updatedAt)} {t.active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</span>}>
            <TemplateEditor t={t} />
          </Card>
        ))}
        <Card title="New template">
          <TemplateEditor t={{ key: "", name: "", channel: "WHATSAPP", subject: null, body: "Hi {{name}}, ", active: true }} />
        </Card>
      </div>
    </>
  );
}
