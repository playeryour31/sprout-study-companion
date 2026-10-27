import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { GatewayError } from "./study-plan.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

export type InsightTurn = { role: "user" | "assistant"; content: string };

/** Answers an admin's question about file-open engagement, grounded only in the given dataset. */
export async function answerFileInsights(dataset: string, history: InsightTurn[], lang: "ar" | "en"): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new GatewayError(401, "AI is not configured for this app yet.");

  let gatewayError: GatewayError | null = null;
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (url, init) => {
      const res = await fetch(url, init);
      if (!res.ok) {
        const body = await res.clone().text();
        console.error(`AI Gateway error [${res.status}]: ${body}`);
        let msg = body;
        try {
          const j = JSON.parse(body);
          msg = j?.error?.message ?? j?.message ?? body;
        } catch {}
        gatewayError = new GatewayError(res.status, msg || `Request failed (${res.status})`);
      }
      return res;
    },
  });

  const result = streamText({
    model: provider.responses(MODEL),
    maxRetries: 0,
    instructions:
      "You are a learning-analytics assistant for a school admin. You analyse how students engage with lesson files attached to schedule items. " +
      "Answer ONLY from the dataset below; never invent students, files or numbers. If the data can't answer the question, say so and suggest what to track. " +
      "Be concrete: cite counts and percentages, name students and files when relevant. " +
      "Structure answers in Markdown: '## Summary' (2-4 bullets), '## What stands out' (patterns: low-engagement items, students who never open files, late openers vs early), and '## Recommendations' (3-5 actionable steps the admin can take this week, e.g. who to follow up with, when to send reminders, which files to re-share). Keep it under 350 words unless asked for more. " +
      (lang === "ar" ? "Write everything in clear, simple Arabic, including headings ('## الملخص', '## أبرز الملاحظات', '## توصيات عملية')." : "Write in English.") +
      `\n\nDATASET (generated ${new Date().toISOString()}):\n${dataset}`,
    messages: history,
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  } as Parameters<typeof streamText>[0]);

  let text = "";
  try {
    text = await result.text;
  } catch (e) {
    if (gatewayError) throw gatewayError;
    throw e;
  }
  if (gatewayError) throw gatewayError;
  if (!text.trim()) throw new GatewayError(422, "The AI couldn't answer this question.");
  return text;
}
