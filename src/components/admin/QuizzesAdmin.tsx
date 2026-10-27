import { useSuspenseQuery } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { quizzesQuery, subjectsQuery, type Quiz } from "@/lib/content";
import type { Question } from "@/lib/data";
import { btn, btnDanger, btnGhost, Card, confirmDelete, field, Label, useSave } from "./shared";
import { translate as tr } from "@/lib/i18n";

const KEYS = [["quizzes"]];
const typeLabel = { mcq: "Multiple choice", truefalse: "True / False", fill: "Fill in the blank", essay: "Short essay" };

function blank(type: Question["type"]): Question {
  const id = crypto.randomUUID();
  if (type === "mcq") return { id, type, prompt: "", options: ["", ""], answer: 0, explanation: "" };
  if (type === "truefalse") return { id, type, prompt: "", answer: true, explanation: "" };
  if (type === "fill") return { id, type, prompt: "", answer: [""], explanation: "" };
  return { id, type, prompt: "", keywords: [], minWords: 30, explanation: "" };
}

export function QuizzesAdmin() {
  const { data: quizzes } = useSuspenseQuery(quizzesQuery);
  const { data: subjects } = useSuspenseQuery(subjectsQuery);
  const [editing, setEditing] = useState<Quiz | "new" | null>(null);
  const save = useSave();

  if (editing) return <QuizEditor {...(editing === "new" ? {} : { initial: editing })} onDone={() => setEditing(null)} />;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold">{tr("Quizzes")}</h2>
        <button className={btn} disabled={!subjects.length} onClick={() => setEditing("new")}><Plus className="h-4 w-4" />{tr("New quiz")}</button>
      </div>
      {!subjects.length && <p className="text-sm text-muted-foreground">{tr("Add a subject first.")}</p>}
      {subjects.length > 0 && quizzes.length === 0 && <p className="text-sm text-muted-foreground">{tr("No quizzes yet.")}</p>}
      <ul className="divide-y">
        {quizzes.map((q) => (
          <li key={q.id} className="flex items-center gap-3 py-3">
            <div className="flex-1">
              <p className="font-medium">{q.title}</p>
              <p className="text-xs text-muted-foreground">
                {subjects.find((s) => s.id === q.subject_id)?.name} · {tr(q.questions.length === 1 ? "{n} question" : "{n} questions", { n: q.questions.length })} · {tr("{n} min", { n: q.minutes })}
              </p>
            </div>
            <button className={btnGhost} onClick={() => setEditing(q)}><Pencil className="h-4 w-4" />{tr("Edit")}</button>
            <button className={btnDanger} aria-label={tr("Delete quiz")} onClick={async () => {
              if (confirmDelete(tr('quiz "{title}"', { title: q.title }))) await save(() => supabase.from("quizzes").delete().eq("id", q.id), "Quiz deleted", KEYS);
            }}><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function QuizEditor({ initial, onDone }: { initial?: Quiz; onDone: () => void }) {
  const { data: subjects } = useSuspenseQuery(subjectsQuery);
  const save = useSave();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subjectId, setSubjectId] = useState(initial?.subject_id ?? subjects[0]?.id ?? "");
  const [minutes, setMinutes] = useState(initial?.minutes ?? 10);
  const [questions, setQuestions] = useState<Question[]>(initial?.questions ?? []);
  const [busy, setBusy] = useState(false);

  const setQ = (i: number, q: Question) => setQuestions((xs) => xs.map((x, j) => (j === i ? q : x)));

  async function submit() {
    if (!title.trim()) { toast.error(tr("Quiz title is required.")); return; }
    if (!questions.length) { toast.error(tr("Add at least one question.")); return; }
    for (const [n, q] of questions.entries()) {
      if (!q.prompt.trim()) { toast.error(tr("Question {n} needs a prompt.", { n: n + 1 })); return; }
      if (q.type === "mcq" && q.options.filter((o) => o.trim()).length < 2) { toast.error(tr("Question {n} needs at least 2 options.", { n: n + 1 })); return; }
      if (q.type === "fill" && !q.answer.some((a) => a.trim())) { toast.error(tr("Question {n} needs an accepted answer.", { n: n + 1 })); return; }
    }
    const clean = questions.map((q): Question => {
      if (q.type === "mcq") return { ...q, options: q.options.map((o) => o.trim()) };
      if (q.type === "fill") return { ...q, answer: q.answer.map((a) => a.trim()).filter(Boolean) };
      if (q.type === "essay") return { ...q, keywords: q.keywords.map((k) => k.trim()).filter(Boolean) };
      return q;
    });
    setBusy(true);
    const row = { title: title.trim(), subject_id: subjectId, minutes: Math.max(1, Math.min(180, minutes)), questions: clean };
    const ok = await save(
      () => (initial ? supabase.from("quizzes").update(row).eq("id", initial.id) : supabase.from("quizzes").insert(row)),
      "Quiz saved",
      KEYS,
    );
    setBusy(false);
    if (ok) onDone();
  }

  return (
    <div className="space-y-4">
      <Card title={initial ? "Edit quiz" : "New quiz"}>
        <div className="grid gap-3 sm:grid-cols-[1fr_200px_120px]">
          <label className="block"><Label>Title</Label><input className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></label>
          <label className="block"><Label>Subject</Label>
            <select className={field} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="block"><Label>Minutes</Label><input type="number" min={1} max={180} className={field} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></label>
        </div>
      </Card>

      {questions.map((q, i) => (
        <Card key={q.id}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-primary">{tr("Question {n} · {type}", { n: i + 1, type: tr(typeLabel[q.type]) })}</p>
            <button className={btnDanger} aria-label={tr("Remove question")} onClick={() => setQuestions((xs) => xs.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-3">
            <textarea className={field} rows={2} placeholder={tr("Question")} value={q.prompt} onChange={(e) => setQ(i, { ...q, prompt: e.target.value })} />
            {q.type === "mcq" && (
              <div className="space-y-2">
                <Label hint="(pick the correct one)">Options</Label>
                {q.options.map((o, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <input type="radio" name={`ans-${q.id}`} aria-label={tr("Option {n} is correct", { n: k + 1 })} checked={q.answer === k} onChange={() => setQ(i, { ...q, answer: k })} />
                    <input className={field} placeholder={tr("Option {l}", { l: String.fromCharCode(65 + k) })} value={o}
                      onChange={(e) => setQ(i, { ...q, options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} />
                    {q.options.length > 2 && (
                      <button className={btnDanger} aria-label={tr("Remove option")} onClick={() => setQ(i, { ...q, options: q.options.filter((_, j) => j !== k), answer: q.answer === k ? 0 : q.answer > k ? q.answer - 1 : q.answer })}><X className="h-4 w-4" /></button>
                    )}
                  </div>
                ))}
                {q.options.length < 6 && <button className={btnGhost} onClick={() => setQ(i, { ...q, options: [...q.options, ""] })}><Plus className="h-4 w-4" />{tr("Add option")}</button>}
              </div>
            )}
            {q.type === "truefalse" && (
              <label className="block"><Label>Correct answer</Label>
                <select className={field} value={q.answer ? "true" : "false"} onChange={(e) => setQ(i, { ...q, answer: e.target.value === "true" })}>
                  <option value="true">{tr("True")}</option><option value="false">{tr("False")}</option>
                </select>
              </label>
            )}
            {q.type === "fill" && (
              <label className="block"><Label hint="(comma separated)">Accepted answers</Label>
                <input className={field} value={q.answer.join(", ")} onChange={(e) => setQ(i, { ...q, answer: e.target.value.split(",") })} />
              </label>
            )}
            {q.type === "essay" && (
              <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                <label className="block"><Label hint="(comma separated, used for scoring)">Key words</Label>
                  <input className={field} value={q.keywords.join(", ")} onChange={(e) => setQ(i, { ...q, keywords: e.target.value.split(",") })} />
                </label>
                <label className="block"><Label>Min words</Label>
                  <input type="number" min={1} className={field} value={q.minWords} onChange={(e) => setQ(i, { ...q, minWords: Number(e.target.value) })} />
                </label>
              </div>
            )}
            <input className={field} placeholder={tr("Explanation shown after the quiz")} value={q.explanation} onChange={(e) => setQ(i, { ...q, explanation: e.target.value })} />
          </div>
        </Card>
      ))}

      <Card>
        <p className="mb-3 text-sm font-semibold">{tr("Add a question")}</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(typeLabel) as Question["type"][]).map((t) => (
            <button key={t} className={btnGhost} onClick={() => setQuestions((xs) => [...xs, blank(t)])}><Plus className="h-4 w-4" />{tr(typeLabel[t])}</button>
          ))}
        </div>
      </Card>

      <div className="flex gap-2">
        <button className={btn} disabled={busy} onClick={submit}>{tr("Save quiz")}</button>
        <button className={btnGhost} onClick={onDone}>{tr("Cancel")}</button>
      </div>
    </div>
  );
}
