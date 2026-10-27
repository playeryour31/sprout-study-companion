import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { eventsQuery, subjectsQuery } from "@/lib/content";
import { dueTypes, eventTypes, type EventType } from "@/lib/data";
import { pushAnnouncement } from "@/lib/push.functions";
import { btn, btnDanger, Card, confirmDelete, field, Label, useSave } from "./shared";
import { translate as tr, useI18n } from "@/lib/i18n";

const KEYS = [["events"]];

export function EventsAdmin() {
  const { data: events } = useSuspenseQuery(eventsQuery);
  const { data: subjects } = useSuspenseQuery(subjectsQuery);
  const save = useSave();
  const qc = useQueryClient();
  const push = useServerFn(pushAnnouncement);
  const { locale } = useI18n();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<EventType>("class");
  const [subjectId, setSubjectId] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [location, setLocation] = useState("");
  const [notify, setNotify] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function pickType(t: EventType) {
    setType(t);
    setNotify(dueTypes.includes(t));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) { toast.error(tr("Title and date are required.")); return; }
    const startsAt = new Date(`${date}T${start || "00:00"}`);
    const endsAt = end ? new Date(`${date}T${end}`) : null;
    if (Number.isNaN(startsAt.getTime())) { toast.error(tr("Please enter a valid date and time.")); return; }
    if (endsAt && endsAt < startsAt) { toast.error(tr("End time must be after the start time.")); return; }
    setBusy(true);
    let eventId: string | undefined;
    const ok = await save(async () => {
      const r = await supabase.from("events").insert({
        title: title.trim(), type, subject_id: subjectId || null,
        starts_at: startsAt.toISOString(), ends_at: endsAt?.toISOString() ?? null, location: location.trim(),
      }).select("id").single();
      eventId = r.data?.id;
      return r;
    }, "Added to the schedule", KEYS);
    if (ok && notify && eventId) {
      const a = await supabase.from("announcements").insert({
        title: title.trim(), body: message.trim(), kind: type === "quiz" || type === "exam" ? "quiz" : "schedule", event_id: eventId,
      }).select("id").single();
      if (a.error || !a.data) toast.error(a.error?.message ?? tr("Couldn't notify students."));
      else {
        await qc.invalidateQueries({ queryKey: ["announcements"] });
        try {
          const { sent } = await push({ data: { announcementId: a.data.id } });
          toast.success(tr("Students notified ({n} devices)", { n: sent }));
        } catch (err) {
          console.error(err);
          toast.error(tr("Saved, but phone notifications couldn't be sent."));
        }
      }
    }
    setBusy(false);
    if (ok) { setTitle(""); setLocation(""); setMessage(""); }
  }

  const upcoming = events.filter((e) => new Date(e.ends_at ?? e.starts_at).getTime() >= Date.now() - 86400000);
  const past = events.length - upcoming.length;

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card title="Add to schedule">
        <form onSubmit={submit} className="space-y-3">
          <label className="block"><Label>Title</Label><input className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><Label>Type</Label>
              <select className={field} value={type} onChange={(e) => pickType(e.target.value as EventType)}>
                {eventTypes.map((t) => <option key={t} value={t} className="capitalize">{tr(t)}</option>)}
              </select>
            </label>
            <label className="block"><Label>Subject</Label>
              <select className={field} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">{tr("None")}</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </div>
          <label className="block"><Label>Date</Label><input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><Label>Starts</Label><input type="time" className={field} value={start} onChange={(e) => setStart(e.target.value)} /></label>
            <label className="block"><Label hint="(optional)">Ends</Label><input type="time" className={field} value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          </div>
          <label className="block"><Label hint="(optional)">Location</Label><input className={field} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} /></label>
          <label className="flex items-start gap-2.5 rounded-xl bg-secondary p-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            <span>
              <span className="flex items-center gap-1.5 font-semibold"><BellRing className="h-4 w-4 text-primary" />{tr("Notify all students")}</span>
              <span className="block text-xs text-muted-foreground">{tr("Sends an alert to their phones and shows it in their alerts.")}</span>
            </span>
          </label>
          {notify && (
            <label className="block"><Label hint="(optional)">Message to students</Label><textarea className={field} rows={2} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} /></label>
          )}
          <button className={btn} disabled={busy}><Plus className="h-4 w-4" />{busy ? tr("Saving…") : tr("Add")}</button>
        </form>
      </Card>
      <Card title="Upcoming">
        {upcoming.length === 0 && <p className="text-sm text-muted-foreground">{tr("Nothing scheduled.")}</p>}
        <ul className="divide-y">
          {upcoming.map((e) => {
            const d = new Date(e.starts_at);
            return (
              <li key={e.id} className="flex items-center gap-3 py-3">
                <div className="flex-1">
                  <p className="font-medium">{e.title}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {tr(e.type)} · {d.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}
                    {e.subject_id && ` · ${subjects.find((s) => s.id === e.subject_id)?.name ?? ""}`}
                    {e.location && ` · ${e.location}`}
                  </p>
                </div>
                <button className={btnDanger} aria-label={tr("Delete")} onClick={async () => {
                  if (confirmDelete(`"${e.title}"`)) await save(() => supabase.from("events").delete().eq("id", e.id), "Removed", KEYS);
                }}><Trash2 className="h-4 w-4" /></button>
              </li>
            );
          })}
        </ul>
        {past > 0 && <p className="mt-3 text-xs text-muted-foreground">{tr(past === 1 ? "{n} past item still shows in students' calendars." : "{n} past items still show in students' calendars.", { n: past })}</p>}
      </Card>
    </div>
  );
}
