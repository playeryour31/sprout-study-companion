import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ar } from "./i18n-ar";
import { translate } from "./i18n";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "ui" ? [] : files(p);
    return /\.tsx?$/.test(f) && !f.endsWith(".test.ts") ? [p] : [];
  });
}

const literal = String.raw`("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')`;

describe("Arabic translations", () => {
  it("falls back to English and fills placeholders", () => {
    expect(translate("Not a real key", undefined, "ar")).toBe("Not a real key");
    expect(translate("Step {n}", { n: 2 }, "ar")).toBe("خطوة 2");
    expect(translate("Step {n}", { n: 2 }, "en")).toBe("Step 2");
  });

  it("has an Arabic version of every UI string the app translates", () => {
    const missing = new Set<string>();
    let found = 0;
    const single = new RegExp(String.raw`\b(?:t|tr|translate)\(\s*` + literal, "g");
    const plural = new RegExp(String.raw`\btn\([^,]+,\s*` + literal + String.raw`,\s*` + literal, "g");
    for (const f of files(join(__dirname, ".."))) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(single)) {
        const key = (0, eval)(m[1]!) as string;
        found++;
        if (!(key in ar) && key !== "Studia") missing.add(key);
      }
      for (const m of src.matchAll(plural)) {
        for (const lit of [m[1]!, m[2]!]) {
          const key = (0, eval)(lit) as string;
          if (!(key in ar)) missing.add(key);
        }
      }
    }
    expect(found).toBeGreaterThan(150);
    expect([...missing]).toEqual([]);
  });
});
