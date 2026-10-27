import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Turn = { role: "user" | "assistant"; content: string };

/** Admin only: ask the AI about who opened lesson files attached to schedule items. */
export const askFileInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { history: Turn[]; lang?: "ar" | "en" }) => {
    const raw = Array.isArray(input?.history) ? input.history.slice(-10) : [];
    const history = raw
      .map((t) => ({ role: t?.role === "assistant" ? ("assistant" as const) : ("user" as const), content: String(t?.content ?? "").slice(0, 4000) }))
      .filter((t) => t.content.trim());
    if (!history.length || history[history.length - 1]!.role !== "user") throw new Error("Please type a question.");
    return { history, lang: input?.lang === "en" ? ("en" as const) : ("ar" as const) };
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: isAdmin } = await sb.rpc("is_admin");
    if (!isAdmin) return { ok: false as const, status: 403, error: "Admins only" };

    const [st, ev, op] = await Promise.all([
      sb.rpc("admin_students"),
      sb.from("events").select("id, title, type, starts_at, subjects(name), event_materials(material:materials(id, title))").order("starts_at"),
      sb.from("material_opens").select("user_id, event_id, material_id, opened_at").order("opened_at"),
    ]);
    if (st.error || ev.error || op.error) {
      console.error(st.error ?? ev.error ?? op.error);
      return { ok: false as const, status: 500, error: "Couldn't load the file stats. Please try again." };
    }

    // Names only (no emails) go to the model.
    const students = st.data ?? [];
    const nameOf = new Map(students.map((s, i) => [s.user_id, s.full_name || `Student ${i + 1}`]));
    type Ev = { id: string; title: string; type: string; starts_at: string; subjects: { name: string } | null; event_materials: { material: { id: string; title: string } | null }[] };
    const events = (ev.data as unknown as Ev[]).filter((e) => e.event_materials.some((m) => m.material));
    const lines: string[] = [`Students signed up (${students.length}): ${students.map((s) => nameOf.get(s.user_id)).join(", ") || "none"}`];
    for (const e of events) {
      lines.push(`\nSchedule item: "${e.title}" (${e.type}${e.subjects ? `, ${e.subjects.name}` : ""}) at ${e.starts_at}`);
      for (const { material: m } of e.event_materials) {
        if (!m) continue;
        const opens = (op.data ?? []).filter((o) => o.event_id === e.id && o.material_id === m.id);
        const first = new Map<string, string>();
        const count = new Map<string, number>();
        for (const o of opens) {
          if (!first.has(o.user_id)) first.set(o.user_id, o.opened_at);
          count.set(o.user_id, (count.get(o.user_id) ?? 0) + 1);
        }
        const openers = [...first].map(([u, at]) => `${nameOf.get(u) ?? "Unknown"} (first ${at}, ${count.get(u)}x)`);
        const missing = students.filter((s) => !first.has(s.user_id)).map((s) => nameOf.get(s.user_id));
        lines.push(`  File "${m.title}": opened by ${first.size}/${students.length}. Opened: ${openers.join("; ") || "nobody"}. Not opened: ${missing.join(", ") || "nobody"}.`);
      }
    }
    if (!events.length) lines.push("\nNo schedule items have files attached yet.");

    const { answerFileInsights } = await import("./file-insights.server");
    const { GatewayError } = await import("./study-plan.server");
    try {
      const answer = await answerFileInsights(lines.join("\n").slice(0, 60000), data.history, data.lang);
      return { ok: true as const, answer };
    } catch (e) {
      if (e instanceof GatewayError) {
        const message =
          e.status === 402
            ? "The app is out of AI credits. Please add credits to keep using AI insights."
            : e.status === 429
              ? "Too many requests right now. Please wait a moment and try again."
              : e.message;
        return { ok: false as const, status: e.status, error: message };
      }
      console.error(e);
      return { ok: false as const, status: 500, error: "Something went wrong analysing the stats." };
    }
  });
