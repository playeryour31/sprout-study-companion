<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- AI calls live in server-only `src/lib/*.server.ts` and are exposed via `createServerFn` in `*.functions.ts`; keeps the AI key and prompts off the browser.
- Subjects, lessons, materials, quizzes, events and announcements live in Cloud tables managed from the admin page; src/lib/data.ts holds only shared types; quiz grading lives in src/lib/quiz.ts with tests.
- Admin rights come from the admin_emails table checked by the security-definer is_admin() in RLS; never trust client-side flags for admin.
- Lesson files are stored in the private `materials` bucket and read through short-lived signed URLs.
- Offline PWA uses vite-plugin-pwa generateSW (/sw.js), registered only from src/lib/offline.ts, which refuses dev/preview/iframe hosts; /~oauth navigations are never cached.
- All app pages live under src/routes/_authenticated/ (ssr:false gate, redirects to the public cover page at /); AppShell wraps only that layout.
- Theme: `dark` class on <html> set by an inline pre-paint script (src/lib/theme.tsx); dark unless the user picked light.
- Student progress (lesson completions, quiz attempts) is stored per user with owner-only RLS; streaks are derived from activity dates in src/lib/progress.ts, never stored.
- UI text is translated with `useI18n().t("English text")` / `translate()` from src/lib/i18n.tsx; Arabic strings live in src/lib/i18n-ar.ts keyed by the English text, and a test fails if a translated string has no Arabic entry. Language is stored in localStorage and applied to <html lang/dir> by a pre-paint script; use logical Tailwind classes (ms/me/ps/pe/start/end, text-start) so RTL works.
- Push notifications use standard Web Push with a dedicated worker (public/push-sw.js, scope /push/) separate from the offline /sw.js; VAPID keys are derived server-side from the VAPID_SEED secret in src/lib/push.server.ts, devices are stored in push_subscriptions (written only via the authenticated savePushSubscription server fn), and only admins can trigger pushAnnouncement.
- Schedule alerts are announcements linked to an event (announcements.event_id, cascade delete); their text is built from the event at display/send time so it follows each student's language and time zone.
- Lesson files attach to schedule events through the event_materials link table (admin-only writes); students open them from the schedule via the same signed URLs as lesson pages.
- File-open stats: students log opens into material_opens (insert only for files attached to that event); admins read them plus the student list from the admin_students() security-definer function, which refuses non-admins.
