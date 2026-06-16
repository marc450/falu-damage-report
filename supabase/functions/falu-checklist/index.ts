import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-client-info,apikey,authorization",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const action = url.searchParams.get("action");

  if (!token) return json({ error: "Missing token" }, 400);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // GET: fetch checklist data for the customer fill page
  if (req.method === "GET") {
    const { data, error } = await sb
      .from("falu_checklists")
      .select("id,customer_name,site,scheduled_date,items,status")
      .eq("customer_token", token)
      .single();
    if (error || !data) return json({ error: "Not found" }, 404);
    return json(data);
  }

  // POST ?action=sign-upload: generate a signed upload URL for a media file.
  // The client uploads the file directly to Supabase Storage using this URL,
  // so large videos never pass through the edge function.
  if (req.method === "POST" && action === "sign-upload") {
    const item = url.searchParams.get("item") || "x";
    const ext = url.searchParams.get("ext") || "bin";

    // Validate token and check the checklist hasn't already been submitted.
    const { data: row } = await sb
      .from("falu_checklists")
      .select("id,status")
      .eq("customer_token", token)
      .single();
    if (!row) return json({ error: "Not found" }, 404);
    if (row.status === "submitted") return json({ error: "Already submitted" }, 400);

    const path = `${token}/${item}/${Date.now()}.${ext}`;
    const { data, error } = await sb.storage
      .from("falu-checklist-media")
      .createSignedUploadUrl(path);
    if (error || !data) return json({ error: error?.message ?? "Failed to create upload URL" }, 500);
    return json({ signedUrl: data.signedUrl, path });
  }

  // PATCH: customer submits the completed checklist
  if (req.method === "PATCH") {
    let body: { items?: unknown };
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

    const { error } = await sb
      .from("falu_checklists")
      .update({
        items: body.items,
        status: "submitted",
        updated_at: new Date().toISOString(),
      })
      .eq("customer_token", token)
      .eq("status", "pending"); // prevents double-submission

    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
});
