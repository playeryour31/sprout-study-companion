import { createFileRoute } from "@tanstack/react-router";
import { BellRing, CalendarClock, FileText, ListChecks, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNotifications } from "@/lib/notifications";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Alerts & Notifications — Studia" },
      { name: "description", content: "Reminders for quizzes, new materials and schedule changes." },
      { property: "og:title", content: "Alerts & Notifications — Studia" },
      { property: "og:description", content: "Reminders for quizzes, new materials and schedule changes." },
    ],
  }),
  component: NotificationsPage,
});

const icons = { quiz: ListChecks, material: FileText, schedule: CalendarClock, news: Megaphone };

function NotificationsPage() {
  const { t } = useI18n();
  const { notices, push, enablePush, markAllRead } = useNotifications();
  const [busy, setBusy] = useState(false);
  const pushText: Record<string, string> = {
    loading: "",
    on: t("On — you'll get alerts on this device, even when Studia is closed."),
    off: t("Turn on alerts so you never miss a quiz, exam or deadline — even when Studia is closed."),
    denied: t("Blocked. Allow notifications in your browser settings."),
    unsupported: t("This browser doesn't support notifications. Alerts will show inside the app."),
    iframe: t("Open Studia in its own browser tab to turn on alerts."),
    "ios-install": t("On iPhone: tap Share, then “Add to Home Screen”, open Studia from the icon, and turn on alerts here."),
  };
  return (
    <div className="mx-auto max-w-3xl space-y-6 fade-up">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{t("Alerts")}</h1>
        <p className="text-muted-foreground">{t("Stay on top of quizzes, materials and schedule changes.")}</p>
      </div>

      <div className="rounded-2xl bg-navy p-6 text-navy-foreground">
        <div className="flex items-start gap-4">
          <BellRing className="h-6 w-6 shrink-0 text-primary-glow" />
          <div className="flex-1">
            <p className="font-semibold">{t("Device notifications")}</p>
            <p className="text-sm opacity-75">{pushText[push]}</p>
          </div>
          {push === "off" && (
            <Button disabled={busy} onClick={async () => { setBusy(true); await enablePush(); setBusy(false); }}>
              {busy ? t("Turning on…") : t("Enable")}
            </Button>
          )}
          {push === "on" && <BellRing className="h-5 w-5 text-success" aria-label={t("On")} />}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t("Inbox")}</h2>
        <Button variant="ghost" size="sm" onClick={markAllRead}>{t("Mark all read")}</Button>
      </div>
      <ul className="space-y-3">
        {notices.length === 0 && <li className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-card">{t("No announcements yet.")}</li>}
        {notices.map((n) => {
          const I = icons[n.kind] ?? Megaphone;
          return (
            <li key={n.id} className={cn("flex gap-4 rounded-2xl bg-card p-4 shadow-card", !n.read && "ring-2 ring-primary/30")}>
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><I className="h-5 w-5" /></div>
              <div className="flex-1">
                <p className="font-semibold">{n.heading}</p>
                <p className="whitespace-pre-line text-sm text-muted-foreground">{n.text}</p>
              </div>
              <span className="text-xs text-muted-foreground">{n.time}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
