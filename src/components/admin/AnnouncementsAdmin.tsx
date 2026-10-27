import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { announcementsQuery } from "@/lib/content";
import { announcementKinds, type AnnouncementKind } from "@/lib/data";
import { noticeView, timeAgo } from "@/lib/notifications";
import { pushAnnouncement } from "@/lib/push.functions";
import { btn, btnDanger, Card, confirmDelete, field, Label, useSave } from "./shared";
import { translate as tr, useI18n } from "@/lib/i18n";

const KEYS = [["announcements"]];
const kindLabel: Record<AnnouncementKind, string> = { news: "News", quiz: "Quiz", material: "New material", schedule: "Schedule change" };

export function AnnouncementsAdmin() {
  const { data } = useSuspenseQuery(announcementsQuery);
  useI18n();
  const save = useSave();
  const push = useServerFn(pushAnnouncement);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<AnnouncementKind>("news");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast.error(tr("Title is required.")); return; }
    setBusy(true);
    let id: string | undefined;
    const ok = await save(async () => {
      const r = await supabase.from("announcements").insert({ title: title.trim(), body: body.trim(), kind }).select("id").single();
      id = r.data?.id;
      return r;
    }, "Announcement sent to all students", KEYS);
    if (ok && id) {
      try {
        const { sent } = await push({ data: { announcementId: id } });
        toast.success(tr("Students notified ({n} devices)", { n: sent }));
      } catch (err) {
        console.error(err);
        toast.error(tr("Saved, but phone notifications couldn't be sent."));
      }
    }
    setBusy(false);
    if (ok) { setTitle(""); setBody(""); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card title="New announcement">
        <form onSubmit={submit} className="space-y-3">
          <label className="block"><Label>Type</Label>
            <select className={field} value={kind} onChange={(e) => setKind(e.target.value as AnnouncementKind)}>
              {announcementKinds.map((k) => <option key={k} value={k}>{tr(kindLabel[k])}</option>)}
            </select>
          </label>
          <label className="block"><Label>Title</Label><input className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></label>
          <label className="block"><Label>Message</Label><textarea className={field} rows={5} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} /></label>
          <button className={btn} disabled={busy}><Send className="h-4 w-4" />{tr("Publish")}</button>
        </form>
      </Card>
      <Card title="Published">
        {data.length === 0 && <p className="text-sm text-muted-foreground">{tr("No announcements yet.")}</p>}
        <ul className="divide-y">
          {data.map((n) => (
            <li key={n.id} className="flex items-start gap-3 py-3">
              <div className="flex-1">
                <p className="font-medium">{n.title}</p>
                <p className="whitespace-pre-line text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{tr(kindLabel[n.kind] ?? n.kind)} · {timeAgo(n.created_at)}</p>
              </div>
              <button className={btnDanger} aria-label={tr("Delete")} onClick={async () => {
                if (confirmDelete(`"${n.title}"`)) await save(() => supabase.from("announcements").delete().eq("id", n.id), "Announcement deleted", KEYS);
              }}><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
