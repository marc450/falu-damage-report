// Supabase Edge Function: falu-rewrite
// Rewrites a field technician's rough notes (any language) into clear English
// full text for the defect report. Any authenticated FALU user may call it.
// The Anthropic API key is kept server-side (set: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const MODEL = "claude-opus-4-8";
const SYSTEM = `You rewrite a field service technician's rough notes into clear, professional English for a machine defect report (Mängelprotokoll). The input may be in German, English, or any mix.

Rules:
- Translate to English and fix grammar, spelling, and phrasing.
- Preserve ALL technical detail: part names, component names, measurements, numbers, positions, model/serial designations. Do not invent or omit information.
- Keep it concise — a complete sentence or two, in a neutral technical tone.
- Terminology: this is cotton/textile machinery. Use "cotton", "cotton sliver", and "fleece" for the fiber material — never "wadding", "batting", or "wool". German→English: "Watteschnur" → "cotton sliver"; "Faserband" → "cotton sliver"; "Watte" → "cotton"; "Vlies" → "fleece".
- Output ONLY the rewritten English text. No preamble, no quotation marks, no explanations, no notes about what you changed.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "KI ist nicht konfiguriert (ANTHROPIC_API_KEY fehlt)." }, 500);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Nicht angemeldet." }, 401);
    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await caller.auth.getUser(token);
    if (uErr || !user) return json({ error: "Ungültige Sitzung." }, 401);

    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return json({ error: "Kein Text." }, 400);
    if (text.length > 4000) return json({ error: "Text zu lang." }, 400);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        thinking: { type: "disabled" },
        system: SYSTEM,
        messages: [{ role: "user", content: text }],
      }),
    });
    const j = await r.json();
    if (!r.ok) return json({ error: (j?.error?.message) || ("Anthropic " + r.status) }, 502);
    const out = (j.content || []).filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text).join("").trim();
    if (!out) return json({ error: "Leere Antwort." }, 502);
    return json({ text: out });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
