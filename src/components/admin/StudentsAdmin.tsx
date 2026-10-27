import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { translate as tr, useI18n } from "@/lib/i18n";
import { Card } from "./shared";

type Account = {
  user_id: string; email: string; full_name: string; avatar_url: string; provider: string;
  created_at: string; last_sign_in_at: string | null; email_confirmed_at: string | null;
};

const accountsQuery = queryOptions({
  queryKey: ["student-accounts"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("admin_student_accounts");
    if (error) throw error;
    return (data ?? []) as Account[];
  },
});

export function StudentsAdmin() {
  const { t, locale } = useI18n();
  const { data } = useSuspenseQuery(accountsQuery);
  const [q, setQ] = useState("");
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : t("Never"));
  const week = Date.now() - 7 * 864e5;
  const activeWeek = data.filter((a) => a.last_sign_in_at && new Date(a.last_sign_in_at).getTime() > week).length;
  const newWeek = data.filter((a) => new Date(a.created_at).getTime() > week).length;
  const list = data.filter((a) => `${a.full_name} ${a.email}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <Card title="Student accounts">
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[[t("Total students"), data.length], [t("Signed in this week"), activeWeek], [t("New this week"), newWeek]].map(([l, v]) => (
          <div key={String(l)} className="rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="text-2xl font-bold">{v}</p>
          </div>
        ))}
      </div>
      <div className="relative mb-4">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search by name or email")} className="ps-9" />
      </div>
      {list.length === 0 && <p className="text-sm text-muted-foreground">{t("No students found.")}</p>}
      <div className="space-y-2">
        {list.map((a) => (
          <div key={a.user_id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
            {a.avatar_url ? (
              <img src={a.avatar_url} alt="" className="h-10 w-10 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted font-semibold">{(a.full_name || a.email || "?")[0]?.toUpperCase()}</div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{a.full_name || a.email}</p>
              <p className="truncate text-xs text-muted-foreground" dir="ltr">{a.email}</p>
            </div>
            <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
              <span><span className="text-muted-foreground">{t("Signed up")}: </span>{fmt(a.created_at)}</span>
              <span><span className="text-muted-foreground">{t("Last sign-in")}: </span>{fmt(a.last_sign_in_at)}</span>
              <span><span className="text-muted-foreground">{t("Sign-in method")}: </span>{a.provider === "google" ? "Google" : tr(a.provider === "email" ? "Email" : a.provider)}{!a.email_confirmed_at && ` · ${t("Unconfirmed")}`}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
