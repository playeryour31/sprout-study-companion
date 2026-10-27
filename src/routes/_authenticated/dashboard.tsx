import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookCheck, CalendarDays, Flame, ListChecks, Trophy } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { SubjectIcon } from "@/components/app/SubjectIcon";
import { EmptyState } from "@/components/app/EmptyState";
import { eventsQuery, quizzesQuery, subjectProgress, subjectsQuery } from "@/lib/content";
import { computeStreaks, progressQuery } from "@/lib/progress";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Studia" },
      { name: "description", content: "Your courses, upcoming classes and quizzes at a glance." },
      { property: "og:title", content: "Dashboard — Studia" },
      { property: "og:description", content: "Your courses, upcoming classes and quizzes at a glance." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(subjectsQuery),
      context.queryClient.ensureQueryData(quizzesQuery),
      context.queryClient.ensureQueryData(eventsQuery),
      context.queryClient.ensureQueryData(progressQuery),
    ]),
  component: Dashboard,
});

function dayOffset(d: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const n = Math.round((x.getTime() - today.getTime()) / 86400000);
  return n;
}

function Dashboard() {
  const { t, tn, locale } = useI18n();
  const relDay = (d: Date) => {
    const n = dayOffset(d);
    return n === 0 ? t("Today") : n === 1 ? t("Tomorrow") : t("In {n} days", { n });
  };
  const { user } = Route.useRouteContext();
  const { data: subjects } = useSuspenseQuery(subjectsQuery);
  const { data: quizzes } = useSuspenseQuery(quizzesQuery);
  const { data: events } = useSuspenseQuery(eventsQuery);
  const { data: progress } = useSuspenseQuery(progressQuery);

  const firstName = ((user.user_metadata as { full_name?: string }).full_name ?? t("student")).split(" ")[0];
  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.ends_at ?? e.starts_at).getTime() >= now).slice(0, 4);
  const done = new Set(progress.lessons.map((l) => l.lesson_key));
  const streak = computeStreaks([
    ...progress.lessons.map((l) => new Date(l.completed_at)),
    ...progress.attempts.map((a) => new Date(a.taken_at)),
  ]);
  const avg = progress.attempts.length
    ? Math.round(progress.attempts.reduce((n, a) => n + a.percent, 0) / progress.attempts.length)
    : null;
  const todayCount = upcoming.filter((e) => dayOffset(new Date(e.starts_at)) === 0).length;
  const nextQuiz = quizzes.find((q) => !progress.attempts.some((a) => a.quiz_id === q.id)) ?? quizzes[0];

  const stats = [
    { label: t("Study streak"), value: tn(streak.current, "{n} day", "{n} days"), icon: Flame, tint: "bg-tint-amber text-warning" },
    { label: t("Avg. quiz score"), value: avg === null ? "—" : `${avg}%`, icon: Trophy, tint: "bg-tint-blue text-primary-glow" },
    { label: t("Lessons completed"), value: String(progress.lessons.length), icon: BookCheck, tint: "bg-tint-green text-success" },
    { label: t("Quizzes done"), value: String(progress.attempts.length), icon: ListChecks, tint: "bg-tint-rose text-destructive" },
  ];

  return (
    <div className="space-y-10 fade-up">
      <section className="relative overflow-hidden rounded-3xl bg-hero p-7 text-primary-foreground shadow-elegant md:p-12">
        <p className="text-sm font-medium opacity-80">{t("Welcome back, {name}", { name: firstName ?? "" })}</p>
        <h1 className="mt-3 max-w-xl text-3xl font-extrabold leading-snug tracking-tight md:text-4xl">
          {todayCount > 0
            ? tn(todayCount, "You have {n} thing on your schedule today.", "You have {n} things on your schedule today.")
            : upcoming.length > 0
              ? t("Next up: {title}.", { title: upcoming[0]!.title })
              : t("Ready to learn something new today?")}
        </h1>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link to="/quizzes" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-transform hover:-translate-y-0.5">
            {t("Practise now")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
          <Link to="/schedule" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary-foreground/30 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-primary-foreground/10">
            {t("View schedule")}
          </Link>
        </div>
        <div className="pointer-events-none absolute -end-16 -top-16 h-72 w-72 rounded-full bg-primary-glow/30 blur-3xl" />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tint }) => (
          <div key={label} className="rounded-2xl border bg-card p-5 shadow-card md:p-6">
            <div className={`grid h-10 w-10 place-items-center rounded-xl ${tint}`}>
              <Icon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-2xl font-bold tabular-nums">{value}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">{t("Your subjects")}</h2>
            <Link to="/subjects" className="text-sm font-medium text-primary">{t("See all")}</Link>
          </div>
          {subjects.length === 0 ? (
            <EmptyState title={t("No subjects yet")} text={t("Your school hasn't added any subjects yet. Check back soon.")} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {subjects.slice(0, 4).map((s) => {
                const pct = subjectProgress(s, done);
                return (
                  <Link key={s.id} to="/subjects/$subjectId" params={{ subjectId: s.id }} className="card-lift rounded-2xl bg-card p-5 shadow-card">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary">
                        <SubjectIcon icon={s.icon} className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.instructor || tn(s.lessons.length, "{n} lesson", "{n} lessons")}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t("Progress")}</span><span className="font-semibold text-foreground">{pct}%</span>
                    </div>
                    <Progress value={pct} className="mt-2 h-2" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-bold">{t("Coming up")}</h2>
          <div className="space-y-3 rounded-2xl bg-card p-4 shadow-card">
            {upcoming.length === 0 && <p className="p-2 text-sm text-muted-foreground">{t("Nothing scheduled yet.")}</p>}
            {upcoming.map((e) => {
              const d = new Date(e.starts_at);
              return (
                <div key={e.id} className="flex items-start gap-3 rounded-xl p-2 hover:bg-secondary/60">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
                    <CalendarDays className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{e.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {relDay(d)} · {d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {nextQuiz && (
            <>
              <h2 className="mb-4 mt-6 text-xl font-bold">{t("Quick quiz")}</h2>
              <Link to="/quizzes/$quizId" params={{ quizId: nextQuiz.id }} className="card-lift block rounded-2xl bg-navy p-5 text-navy-foreground">
                <p className="text-xs uppercase tracking-wide opacity-70">{subjects.find((s) => s.id === nextQuiz.subject_id)?.name}</p>
                <p className="mt-1 font-semibold">{nextQuiz.title}</p>
                <p className="mt-3 text-xs opacity-70">{tn(nextQuiz.questions.length, "{n} question", "{n} questions")} · {t("{n} min", { n: nextQuiz.minutes })}</p>
              </Link>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
