import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public: the VAPID public key browsers need to subscribe. Contains nothing secret. */
export const getPushPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  const { getVapidPublicKey } = await import("./push.server");
  return { publicKey: await getVapidPublicKey() };
});

const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Saves this device for the signed-in student. A device moves to whoever signed in on it last. */
export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string; p256dh: string; auth: string; lang: string; timeZone: string }) => {
    const endpoint = text(input?.endpoint, 1000);
    if (!/^https:\/\//.test(endpoint)) throw new Error("Invalid subscription.");
    const p256dh = text(input?.p256dh, 200);
    const auth = text(input?.auth, 100);
    if (!p256dh || !auth) throw new Error("Invalid subscription.");
    const lang = input?.lang === "en" ? "en" : "ar";
    const timeZone = text(input?.timeZone, 64) || "Africa/Cairo";
    return { endpoint, p256dh, auth, lang, timeZone };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        lang: data.lang,
        time_zone: data.timeZone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (error) {
      console.error("Saving push subscription failed:", error.message);
      throw new Error("Couldn't turn on notifications. Please try again.");
    }
    return { ok: true };
  });

/** Admin only: push one announcement to every subscribed device. */
export const pushAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { announcementId: string }) => {
    const announcementId = text(input?.announcementId, 40);
    if (!/^[0-9a-f-]{36}$/i.test(announcementId)) throw new Error("Invalid announcement.");
    return { announcementId };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Admins only");
    const { data: n, error } = await context.supabase
      .from("announcements")
      .select("title, body, event:events(type, title, starts_at, location)")
      .eq("id", data.announcementId)
      .maybeSingle();
    if (error || !n) throw new Error("Invalid announcement.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs, error: subsError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, lang, time_zone");
    if (subsError) {
      console.error("Loading push subscriptions failed:", subsError.message);
      return { sent: 0 };
    }
    const { sendToAll } = await import("./push.server");
    const event = Array.isArray(n.event) ? (n.event[0] ?? null) : n.event;
    const { sent, gone } = await sendToAll({ title: n.title, body: n.body, event }, subs ?? []);
    if (gone.length) await supabaseAdmin.from("push_subscriptions").delete().in("id", gone);
    return { sent };
  });
