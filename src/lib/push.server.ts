// Server-only Web Push helpers. The VAPID key pair is derived from the VAPID_SEED secret,
// so the private key never exists anywhere except inside this server code.
import { p256 } from "@noble/curves/nist.js";
import { buildPushHTTPRequest } from "@pushforge/builder";
import { ar } from "./i18n-ar";

type Lang = "ar" | "en";

function b64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function vapidKeys() {
  const seed = process.env["VAPID_SEED"];
  if (!seed) throw new Error("Push notifications are not configured.");
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`studia-vapid:${seed}`)));
  const pub = p256.getPublicKey(d, false); // 0x04 || x || y
  const x = pub.slice(1, 33);
  const y = pub.slice(33, 65);
  return {
    publicKey: b64url(pub),
    privateJWK: { kty: "EC", crv: "P-256", x: b64url(x), y: b64url(y), d: b64url(d), ext: true } as JsonWebKey,
  };
}

export async function getVapidPublicKey() {
  return (await vapidKeys()).publicKey;
}

function tr(lang: Lang, text: string, vars?: Record<string, string | number>) {
  let out = lang === "ar" ? (ar[text] ?? text) : text;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

export type NoticeSource = {
  title: string;
  body: string;
  event: { type: string; title: string; starts_at: string; location: string } | null;
};

/** The notification text a student sees, in their language and time zone. */
export function pushText(n: NoticeSource, lang: Lang, timeZone: string) {
  if (!n.event) return { title: n.title, body: n.body, url: "/notifications" };
  let when: string;
  try {
    when = new Date(n.event.starts_at).toLocaleString(lang === "ar" ? "ar-EG-u-nu-latn" : "en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    });
  } catch {
    when = new Date(n.event.starts_at).toISOString().slice(0, 16).replace("T", " ");
  }
  const title = tr(lang, "New {type}: {title}", { type: tr(lang, n.event.type), title: n.event.title });
  const body = [when, n.event.location, n.body].filter(Boolean).join(" · ");
  return { title, body, url: "/schedule" };
}

export type StoredSubscription = { id: string; endpoint: string; p256dh: string; auth: string; lang: string; time_zone: string };

/** Sends one notice to every subscription. Returns ids of subscriptions the push service says are gone. */
export async function sendToAll(n: NoticeSource, subs: StoredSubscription[]) {
  const { privateJWK } = await vapidKeys();
  const gone: string[] = [];
  let sent = 0;
  for (let i = 0; i < subs.length; i += 25) {
    const batch = subs.slice(i, i + 25);
    const results = await Promise.allSettled(
      batch.map(async (s) => {
        const lang: Lang = s.lang === "en" ? "en" : "ar";
        const text = pushText(n, lang, s.time_zone || "Africa/Cairo");
        const req = await buildPushHTTPRequest({
          privateJWK,
          subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          message: {
            payload: { ...text, lang, dir: lang === "ar" ? "rtl" : "ltr" },
            adminContact: "mailto:notifications@studia.app",
            options: { ttl: 60 * 60 * 24, urgency: "high" },
          },
        });
        const res = await fetch(req.endpoint, { method: "POST", headers: req.headers, body: req.body });
        if (res.status === 404 || res.status === 410) gone.push(s.id);
        else if (!res.ok) console.error(`Push failed [${res.status}]: ${await res.text()}`);
        else sent++;
      }),
    );
    for (const r of results) if (r.status === "rejected") console.error("Push error:", r.reason);
  }
  return { sent, gone };
}
