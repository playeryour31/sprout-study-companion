import { Link, useNavigate, useRouteContext, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/lib/theme";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import { Bell, BookOpen, CalendarClock, CalendarDays, GraduationCap, LayoutDashboard, ListChecks, LogOut, Menu, ShieldCheck, Sparkles, TrendingUp, WifiOff, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { setupOffline, useOnline } from "@/lib/offline";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { NotificationsProvider, useNotifications } from "@/lib/notifications";
import { useQuery } from "@tanstack/react-query";
import { eventsQuery, isAdminQuery } from "@/lib/content";
import { dueTypes } from "@/lib/data";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/subjects", label: "Subjects", icon: BookOpen },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/quizzes", label: "Quizzes", icon: ListChecks },
  { to: "/progress", label: "Progress", icon: TrendingUp },
  { to: "/study-plan", label: "Study plan", icon: Sparkles },
  { to: "/notifications", label: "Alerts", icon: Bell },
] as const;

const mobileNav = ["/dashboard", "/subjects", "/schedule", "/quizzes", "/study-plan"] as const;

function isActive(path: string, to: string) {
  return path.startsWith(to);
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <NotificationsProvider>
      <Shell>{children}</Shell>
    </NotificationsProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { data: isAdmin } = useQuery(isAdminQuery);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const online = useOnline();
  useEffect(() => {
    void setupOffline();
  }, []);

  const links = (
    <nav className="flex flex-col gap-1">
      {nav.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={() => setOpen(false)}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            isActive(path, to)
              ? "bg-primary text-primary-foreground shadow-elegant"
              : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
        >
          <Icon className="h-4.5 w-4.5" />
          {t(label)}
        </Link>
      ))}
      {isAdmin && (
        <Link
          to="/admin"
          onClick={() => setOpen(false)}
          className={cn(
            "mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            isActive(path, "/admin")
              ? "bg-primary text-primary-foreground shadow-elegant"
              : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
        >
          <ShieldCheck className="h-4.5 w-4.5" />
          {t("Admin panel")}
        </Link>
      )}
    </nav>
  );

  const brand = (
    <Link to="/dashboard" className="flex items-center gap-2.5 px-2">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
        <GraduationCap className="h-5 w-5" />
      </div>
      <span className="text-lg font-bold tracking-tight text-sidebar-accent-foreground">{t("Studia")}</span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col gap-8 bg-sidebar p-5 lg:flex">
        {brand}
        {links}
        <UpcomingCard />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy/60" onClick={() => setOpen(false)} />
          <aside className="fade-up absolute inset-y-0 start-0 flex w-72 flex-col gap-8 bg-sidebar p-5">
            <div className="flex items-center justify-between">
              {brand}
              <button aria-label={t("Close menu")} onClick={() => setOpen(false)} className="text-sidebar-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            {links}
          </aside>
        </div>
      )}

      <div className="lg:ps-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur md:px-8">
          <button aria-label={t("Open menu")} className="lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <LanguageToggle />
          <ThemeToggle />
          <NotificationBell />
          <UserMenu />
        </header>
        {!online && (
          <div className="flex items-center justify-center gap-2 bg-navy px-4 py-2 text-center text-sm text-navy-foreground">
            <WifiOff className="h-4 w-4" /> {t("You're offline — saved lessons are still available.")}
          </div>
        )}
        <main className="mx-auto max-w-7xl px-4 py-6 pb-24 md:px-8 lg:pb-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card lg:hidden">
        {nav.filter((n) => (mobileNav as readonly string[]).includes(n.to)).map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
              isActive(path, to) ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
            {t(label)}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function NotificationBell() {
  const { t } = useI18n();
  const { notices, unread, markAllRead } = useNotifications();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button aria-label={t("Notifications")} className="relative grid h-9 w-9 place-items-center rounded-full hover:bg-secondary">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -end-0.5 -top-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-semibold">{t("Notifications")}</p>
          <Button variant="ghost" size="sm" onClick={markAllRead}>{t("Mark all read")}</Button>
        </div>
        <ul className="max-h-80 overflow-auto">
          {notices.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">{t("No announcements yet.")}</li>}
          {notices.slice(0, 6).map((n) => (
            <li key={n.id} className={cn("border-b px-4 py-3 last:border-0", !n.read && "bg-secondary/60")}>
              <p className="text-sm font-medium">{n.heading}</p>
              <p className="text-xs text-muted-foreground">{n.text}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{n.time}</p>
            </li>
          ))}
        </ul>
        <Link to="/notifications" className="block border-t px-4 py-2.5 text-center text-sm font-medium text-primary">
          {t("Notification settings")}
        </Link>
      </PopoverContent>
    </Popover>
  );
}

function UserMenu() {
  const { t } = useI18n();
  const { user } = useRouteContext({ from: "/_authenticated" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const meta = user.user_metadata as { full_name?: string; avatar_url?: string };
  const name = meta.full_name ?? user.email ?? t("Student");
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button aria-label={t("Account")} className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {meta.avatar_url ? <img src={meta.avatar_url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : initials}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="truncate font-semibold">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        <Button variant="outline" className="mt-4 w-full" onClick={signOut}>
          <LogOut className="h-4 w-4" /> {t("Sign out")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/** Countdown to the next quizzes, exams and deadlines, in the sidebar. */
function UpcomingCard() {
  const { t, tn, locale } = useI18n();
  const { data: events = [] } = useQuery(eventsQuery);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  if (now === null) return <div className="mt-auto" />;
  const next = events
    .filter((e) => dueTypes.includes(e.type) && new Date(e.ends_at ?? e.starts_at).getTime() >= now)
    .slice(0, 3);

  const countdown = (iso: string) => {
    const ms = new Date(iso).getTime() - now;
    if (ms <= 0) return t("Now");
    const mins = Math.round(ms / 60000);
    if (mins < 60) return t("In {n} min", { n: mins });
    const hours = Math.round(mins / 60);
    if (hours < 24) return t("In {n} h", { n: hours });
    const days = Math.round(hours / 24);
    return days === 1 ? t("Tomorrow") : tn(days, "In {n} day", "In {n} days");
  };

  return (
    <Link to="/schedule" className="mt-auto block rounded-2xl bg-sidebar-accent p-4 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/80">
      <p className="flex items-center gap-2 font-semibold text-sidebar-accent-foreground">
        <CalendarClock className="h-4 w-4 text-primary-glow" />
        {t("Coming up")}
      </p>
      {next.length === 0 ? (
        <p className="mt-2 text-xs opacity-80">{t("No quizzes or deadlines coming up.")}</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {next.map((e) => (
            <li key={e.id} className="flex items-start gap-2">
              <span className="mt-0.5 rounded-md bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary-glow">{t(e.type)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-sidebar-accent-foreground">{e.title}</p>
                <p className="text-[11px] opacity-75">
                  {countdown(e.starts_at)} · {new Date(e.starts_at).toLocaleString(locale, { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}
