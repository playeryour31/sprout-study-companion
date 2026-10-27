// Browser side of phone/desktop push notifications. Uses its own worker (/push-sw.js)
// so it never interferes with the offline worker.
import { getPushPublicKey, savePushSubscription } from "./push.functions";

const PUSH_SW = "/push-sw.js";
const PUSH_SCOPE = "/push/";

export type PushStatus = "loading" | "on" | "off" | "denied" | "unsupported" | "iframe" | "ios-install";

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

function keyBytes(b64: string) {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration(PUSH_SCOPE);
  if (existing?.active?.scriptURL.endsWith(PUSH_SW)) return existing;
  const reg = await navigator.serviceWorker.register(PUSH_SW, { scope: PUSH_SCOPE });
  if (reg.active) return reg;
  await new Promise<void>((resolve) => {
    const sw = reg.installing ?? reg.waiting;
    if (!sw) return resolve();
    sw.addEventListener("statechange", () => sw.state === "activated" && resolve());
    setTimeout(resolve, 5000);
  });
  return reg;
}

async function save(sub: PushSubscription, lang: string) {
  const json = sub.toJSON();
  await savePushSubscription({
    data: {
      endpoint: sub.endpoint,
      p256dh: json.keys?.["p256dh"] ?? "",
      auth: json.keys?.["auth"] ?? "",
      lang,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Cairo",
    },
  });
}

export async function getPushStatus(): Promise<PushStatus> {
  if (window.self !== window.top) return "iframe";
  if (isIOS() && !isStandalone()) return "ios-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  const reg = await navigator.serviceWorker.getRegistration(PUSH_SCOPE);
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

/** Must run from a tap/click: browsers only show the permission prompt after a user action. */
export async function enablePush(lang: string): Promise<PushStatus> {
  const status = await getPushStatus();
  if (status === "iframe" || status === "ios-install" || status === "unsupported" || status === "denied") return status;
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const reg = await registration();
  const { publicKey } = await getPushPublicKey();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  await save(sub, lang);
  return "on";
}

/** Keeps this device linked to the signed-in student and their current language. */
export async function refreshPush(lang: string) {
  try {
    if ((await getPushStatus()) !== "on") return;
    const reg = await navigator.serviceWorker.getRegistration(PUSH_SCOPE);
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await save(sub, lang);
  } catch {
    /* best effort */
  }
}
