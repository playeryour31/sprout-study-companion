import { useServerFn } from "@tanstack/react-start";
import { Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { Markdown } from "@/components/app/Markdown";
import { askFileInsights } from "@/lib/file-insights.functions";
import { translate as tr, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { btn, Card, field } from "./shared";

type Turn = { role: "user" | "assistant"; content: string };

const suggestions = [
  "Summarise how students engaged with lesson files.",
  "Which students haven't opened any files?",
  "Which schedule items had the lowest engagement, and what should I do?",
];

export function FileInsightsAI() {
  const { lang } = useI18n();
  const ask = useServerFn(askFileInsights);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history = [...turns, { role: "user" as const, content: question }];
    setTurns(history);
    setQ("");
    setError(null);
    setBusy(true);
    try {
      const res = await ask({ data: { history, lang: lang === "en" ? "en" : "ar" } });
      if (res.ok) setTurns([...history, { role: "assistant", content: res.answer }]);
      else setError(tr(res.error));
    } catch (e) {
      console.error(e);
      setError(tr("Something went wrong analysing the stats."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Ask AI about file engagement">
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">{tr("Ask anything about who opened files — get a summary and practical next steps.")}</p>
      {turns.length === 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} onClick={() => send(tr(s))} disabled={busy} className="rounded-full border px-3 py-1.5 text-start text-xs font-medium hover:bg-secondary disabled:opacity-60">
              {tr(s)}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-4">
        {turns.map((t, i) => (
          <div key={i} className={cn("rounded-xl p-4", t.role === "user" ? "ms-8 bg-nav-active text-sm font-medium" : "me-4 border bg-background")}>
            {t.role === "user" ? t.content : <Markdown text={t.content} />}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 animate-pulse text-primary" /> {tr("Analysing student engagement…")}
          </div>
        )}
        {error && <p className="rounded-xl bg-tint-rose p-3 text-sm text-destructive">{error}</p>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void send(q); }} className="mt-4 flex gap-2">
        <input className={field} value={q} onChange={(e) => setQ(e.target.value)} maxLength={1000} placeholder={tr("e.g. Who should I remind before Thursday's quiz?")} />
        <button className={btn} disabled={busy || !q.trim()} aria-label={tr("Ask")}><Send className="h-4 w-4 rtl:-scale-x-100" /></button>
      </form>
    </Card>
  );
}
