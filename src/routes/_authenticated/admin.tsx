import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isAdminQuery } from "@/lib/content";
import { SubjectsAdmin } from "@/components/admin/SubjectsAdmin";
import { QuizzesAdmin } from "@/components/admin/QuizzesAdmin";
import { EventsAdmin } from "@/components/admin/EventsAdmin";
import { AnnouncementsAdmin } from "@/components/admin/AnnouncementsAdmin";
import { FileStatsAdmin } from "@/components/admin/FileStatsAdmin";
import { StudentsAdmin } from "@/components/admin/StudentsAdmin";
import { AdminsAdmin } from "@/components/admin/AdminsAdmin";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin panel — Studia" },
      { name: "description", content: "Manage subjects, lessons, files, quizzes, the schedule and announcements." },
      { property: "og:title", content: "Admin panel — Studia" },
      { property: "og:description", content: "Manage subjects, lessons, files, quizzes, the schedule and announcements." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { t } = useI18n();
  const { user } = Route.useRouteContext();
  const { data: isAdmin, isLoading } = useQuery(isAdminQuery);

  if (isLoading) return <div className="h-96 animate-pulse rounded-2xl bg-card" />;
  if (!isAdmin)
    return (
      <div className="mx-auto max-w-md rounded-2xl bg-card p-8 text-center shadow-card">
        <h1 className="text-xl font-bold">{t("Admins only")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("Your account doesn't have access to the admin panel.")}</p>
        <Link to="/dashboard" className="mt-4 inline-block text-sm font-semibold text-primary">{t("Back to dashboard")}</Link>
      </div>
    );

  const loading = <div className="h-64 animate-pulse rounded-2xl bg-card" />;
  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{t("Admin panel")}</h1>
        <p className="text-muted-foreground">{t("Everything you add here appears for all students straight away.")}</p>
      </div>
      <Tabs defaultValue="subjects">
        <TabsList className="flex h-auto flex-wrap justify-start bg-secondary">
          <TabsTrigger value="subjects">{t("Subjects & files")}</TabsTrigger>
          <TabsTrigger value="quizzes">{t("Quizzes")}</TabsTrigger>
          <TabsTrigger value="schedule">{t("Schedule")}</TabsTrigger>
          <TabsTrigger value="stats">{t("File stats")}</TabsTrigger>
          <TabsTrigger value="students">{t("Students")}</TabsTrigger>
          <TabsTrigger value="news">{t("Announcements")}</TabsTrigger>
          <TabsTrigger value="admins">{t("Admins")}</TabsTrigger>
        </TabsList>
        <Suspense fallback={loading}>
          <TabsContent value="subjects" className="mt-6"><SubjectsAdmin /></TabsContent>
          <TabsContent value="quizzes" className="mt-6"><QuizzesAdmin /></TabsContent>
          <TabsContent value="schedule" className="mt-6"><EventsAdmin /></TabsContent>
          <TabsContent value="stats" className="mt-6"><FileStatsAdmin /></TabsContent>
          <TabsContent value="students" className="mt-6"><StudentsAdmin /></TabsContent>
          <TabsContent value="news" className="mt-6"><AnnouncementsAdmin /></TabsContent>
          <TabsContent value="admins" className="mt-6"><AdminsAdmin myEmail={user.email ?? ""} /></TabsContent>
        </Suspense>
      </Tabs>
    </div>
  );
}
