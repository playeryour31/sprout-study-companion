import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, Circle, Paperclip } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { eventsQuery, type Material, type StudyEvent } from "@/lib/content";
import { translate as tr, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Card } from "./shared";
import { FileInsightsAI } from "./FileInsightsAI";

type Student = { user_id: string; email: string; full_name: string };
type Open = { user_id: string; event_id: string; material_id: string; opened_at: string };

const statsQuery = queryOptions({
  queryKey: ["file-stats"],
  queryFn: async () => {
    const [s, o] = await Promise.all([
      supabase.rpc("admin_students"),
      supabase.from("material_opens").select("user_id, event_id, material_id, opened_at").order("opened_at"),
    ]);
    if (s.error) throw s.error;
    if (o.error) throw o.error;
    return { students: (s.data ?? []) as Student[], opens: (o.data ?? []) as Open[] };
  },
});

export function FileStatsAdmin() {
  const { data: events } = useSuspenseQuery(eventsQuery);
  const { data } = useSuspenseQuery(statsQuery);
  const withFiles = events.filter((e) => e.materials.length > 0).reverse();

  return (
    <div className="space-y-6">
    <FileInsightsAI />
    <Card title="Who opened lesson files">
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">
        {tr("{n} students signed up. Opens are counted when a student taps a file in the schedule.", { n: data.students.length })}
      </p>
      {withFiles.length === 0 && <p className="text-sm text-muted-foreground">{tr("No schedule items have files attached yet.")}</p>}
      <div className="space-y-4">
        {withFiles.map((e) => <EventStats key={e.id} event={e} students={data.students} opens={data.opens.filter((o) => o.event_id === e.id)} />)}
      </div>
    </Card>
    </div>
  );
}

function EventStats({ event, students, opens }: { event: StudyEvent; students: Student[]; opens: Open[] }) {
  const { locale } = useI18n();
  const reached = new Set(opens.map((o) => o.user_id)).size;
  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-semibold">{event.title}</p>
          <p className="text-xs text-muted-foreground">{tr(event.type)} · {new Date(event.starts_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</p>
        </div>
        <p className="text-sm font-semibold text-primary">{tr("{a} of {b} students opened a file", { a: reached, b: students.length })}</p>
      </div>
      <div className="mt-3 space-y-2">
        {event.materials.map((m) => <FileRow key={m.id} file={m} students={students} opens={opens.filter((o) => o.material_id === m.id)} />)}
      </div>
    </div>
  );
}

function FileRow({ file, students, opens }: { file: Material; students: Student[]; opens: Open[] }) {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const firstOpen = new Map<string, string>();
  for (const o of opens) if (!firstOpen.has(o.user_id)) firstOpen.set(o.user_id, o.opened_at);
  const count = firstOpen.size;
  const pct = students.length ? Math.round((count / students.length) * 100) : 0;
  const sorted = [...students].sort((a, b) => Number(firstOpen.has(b.user_id)) - Number(firstOpen.has(a.user_id)));

  return (
    <div className="rounded-lg bg-secondary/50">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 px-3 py-2.5 text-start text-sm" aria-expanded={open}>
        <Paperclip className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate font-medium">{file.title}</span>
        <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </span>
        <span className="tabular-nums text-xs font-semibold">{count}/{students.length}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="divide-y border-t px-3">
          {sorted.length === 0 && <li className="py-2 text-xs text-muted-foreground">{tr("No students yet.")}</li>}
          {sorted.map((s) => {
            const at = firstOpen.get(s.user_id);
            return (
              <li key={s.user_id} className="flex items-center gap-2 py-2 text-sm">
                {at ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                <span className="min-w-0 flex-1 truncate">
                  {s.full_name || s.email}
                  {s.full_name && <span className="ms-2 text-xs text-muted-foreground">{s.email}</span>}
                </span>
                <span className="text-xs text-muted-foreground">
                  {at ? new Date(at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" }) : tr("Not opened")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
