import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { btn, btnDanger, Card, confirmDelete, field, Label, useSave } from "./shared";
import { translate as tr } from "@/lib/i18n";

const KEYS = [["admin-emails"]];

export function AdminsAdmin({ myEmail }: { myEmail: string }) {
  const save = useSave();
  const { data = [] } = useQuery({
    queryKey: KEYS[0]!,
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_emails").select("email, created_at").order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const [email, setEmail] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { toast.error(tr("Enter a valid email address.")); return; }
    if (await save(() => supabase.from("admin_emails").insert({ email: v }), "Admin added", KEYS)) setEmail("");
  }

  return (
    <Card title="Who can use the admin panel" className="max-w-2xl">
      <p className="mb-4 text-sm text-muted-foreground">{tr("People with these emails can manage subjects, files, quizzes, the schedule and announcements after signing in with Google.")}</p>
      <form onSubmit={submit} className="mb-4 flex gap-2">
        <label className="flex-1"><span className="sr-only"><Label>Email</Label></span>
          <input className={field} type="email" placeholder="teacher@school.com" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button className={btn}><Plus className="h-4 w-4" />{tr("Add")}</button>
      </form>
      <ul className="divide-y">
        {data.map((a) => (
          <li key={a.email} className="flex items-center gap-3 py-2.5 text-sm">
            <span className="flex-1">{a.email}{a.email === myEmail.toLowerCase() && <span className="ms-2 text-xs text-muted-foreground">{tr("(you)")}</span>}</span>
            {a.email !== myEmail.toLowerCase() && (
              <button className={btnDanger} aria-label={tr("Remove admin")} onClick={async () => {
                if (confirmDelete(tr("admin access for {email}", { email: a.email }))) await save(() => supabase.from("admin_emails").delete().eq("email", a.email), "Admin removed", KEYS);
              }}><Trash2 className="h-4 w-4" /></button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
