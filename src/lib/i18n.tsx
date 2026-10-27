import { Languages } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { ar } from "./i18n-ar";

export type Lang = "ar" | "en";
export const LANG_KEY = "studia-lang";
export const DEFAULT_LANG: Lang = "ar";

// Runs before paint so the page opens in the right direction; Arabic is the default.
export const langScript = `try{var l=localStorage.getItem("${LANG_KEY}")==="en"?"en":"ar";var h=document.documentElement;h.lang=l;h.dir=l==="ar"?"rtl":"ltr"}catch(e){}`;

let current: Lang = DEFAULT_LANG;
let loaded = false;
const listeners = new Set<() => void>();

function read(): Lang {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      current = localStorage.getItem(LANG_KEY) === "en" ? "en" : "ar";
    } catch {
      /* storage blocked */
    }
  }
  return current;
}

export function getLang(): Lang {
  return read();
}

export function setLang(lang: Lang) {
  current = lang;
  loaded = true;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* storage blocked */
  }
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

type Vars = Record<string, string | number>;

/** Translate an English UI string into the given language, filling {placeholders}. */
export function translate(text: string, vars?: Vars, lang: Lang = read()): string {
  let out = lang === "ar" ? (ar[text] ?? text) : text;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

/** Date/number locale for the language; Arabic keeps Western digits so numbers match the rest of the UI. */
export const localeFor = (lang: Lang) => (lang === "ar" ? "ar-EG-u-nu-latn" : "en-US");

export function useI18n() {
  const lang = useSyncExternalStore(subscribe, read, () => DEFAULT_LANG);
  const t = (text: string, vars?: Vars) => translate(text, vars, lang);
  /** Pick the singular or plural English key, then translate. */
  const tn = (n: number, one: string, many: string) => translate(n === 1 ? one : many, { n }, lang);
  return { lang, t, tn, locale: localeFor(lang), dir: lang === "ar" ? ("rtl" as const) : ("ltr" as const), setLang };
}

export function LanguageToggle({ className }: { className?: string }) {
  const { lang } = useI18n();
  const next: Lang = lang === "ar" ? "en" : "ar";
  return (
    <button
      onClick={() => setLang(next)}
      aria-label={next === "en" ? "Switch to English" : "التبديل إلى العربية"}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors hover:bg-secondary",
        className,
      )}
    >
      <Languages className="h-4 w-4" />
      {next === "en" ? "English" : "العربية"}
    </button>
  );
}
