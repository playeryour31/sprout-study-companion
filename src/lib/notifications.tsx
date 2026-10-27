import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { announcementsQuery, markAnnouncementsRead, type Announcement } from "./content";
import { getLang, localeFor, translate, useI18n } from "./i18n";
import { enablePush as subscribePush, getPushStatus, refreshPush, type PushStatus } from "./push";

export type Notice = Announcement & { read: boolean; time: string; heading: string; text: string };

type Ctx = {
  notices: Notice[];
  unread: number;
  push: PushStatus;
  enablePush: () => Promise<void>;
  markAllRead: () => void;
};

// Kept on globalThis so a hot reload of this file can't split the provider and its consumers
// across two different context objects (which blanks the page).
const g = globalThis as { __studiaNotificationsContext?: React.Context<Ctx | null> };
const NotificationsContext = (g.__studiaNotificationsContext ??= createContext<Ctx | null>(null));

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return translate("Just now");
  if (s < 3600) return translate("{n} min ago", { n: Math.floor(s / 60) });
  if (s < 86400) return translate("{n} h ago", { n: Math.floor(s / 3600) });
  return new Date(iso).toLocaleDateString(localeFor(getLang()), { month: "short", day: "numeric" });
}

/** Title and text for a notice; schedule notices are built from their event so dates show in the student's language. */
export function noticeView(n: Announcement) {
  if (!n.event) return { heading: n.title, text: n.body };
  const when = new Date(n.event.starts_at).toLocaleString(localeFor(getLang()), {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  return {
    heading: translate("New {type}: {title}", { type: translate(n.event.type), title: n.event.title }),
    text: [when, n.event.location, n.body].filter(Boolean).join(" · "),
  };
}

/** Announcements from the admin panel, with each student's own read state. Mount once inside signed-in pages. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { lang } = useI18n();
  const { data = [] } = useQuery({ ...announcementsQuery, refetchInterval: 60_000 });
  const [push, setPush] = useState<PushStatus>("loading");
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    getPushStatus().then(setPush).catch(() => setPush("unsupported"));
  }, []);

  // Keep this device linked to the signed-in student and their language.
  useEffect(() => {
    if (push === "on") void refreshPush(lang);
  }, [push, lang]);

  // Alert the student about announcements that arrive while the app is open.
  useEffect(() => {
    if (!data.length && seen.current === null) return;
    if (seen.current === null) {
      seen.current = new Set(data.map((n) => n.id));
      return;
    }
    for (const n of data) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      if (n.read) continue;
      const v = noticeView(n);
      toast(v.heading, { description: v.text });
    }
  }, [data]);

  const enablePush = useCallback(async () => {
    try {
      const status = await subscribePush(lang);
      setPush(status);
      if (status === "on") toast.success(translate("Notifications enabled"));
      else if (status === "denied") toast.error(translate("Blocked. Allow notifications in your browser settings."));
    } catch (e) {
      console.error(e);
      toast.error(translate("Couldn't turn on notifications. Please try again."));
    }
  }, [lang]);

  const notices: Notice[] = data.map((n) => ({ ...n, ...noticeView(n), time: timeAgo(n.created_at) }));

  const markAllRead = useCallback(() => {
    const ids = data.filter((n) => !n.read).map((n) => n.id);
    markAnnouncementsRead(ids)
      .then(() => qc.invalidateQueries({ queryKey: announcementsQuery.queryKey }))
      .catch(() => toast.error(translate("Couldn't update your alerts.")));
  }, [data, qc]);

  return (
    <NotificationsContext.Provider
      value={{ notices, unread: notices.filter((n) => !n.read).length, push, enablePush, markAllRead }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const c = useContext(NotificationsContext);
  if (!c) throw new Error("useNotifications must be used inside NotificationsProvider");
  return c;
}
