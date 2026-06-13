// Supabase Edge Function: falu-admin
// Admin-only user management for the Falu Mängelprotokoll.
// Verifies the caller is an admin (app_metadata.role === "admin"), then uses the
// service-role key (server-side only) to list / create / delete users.
//
// Deploy:  supabase functions deploy falu-admin
// (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are injected automatically.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Nicht angemeldet." }, 401);

    // Verify the caller and that they are an admin.
    const caller = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uErr } = await caller.auth.getUser(token);
    if (uErr || !user) return json({ error: "Ungültige Sitzung." }, 401);

    const admin = createClient(url, service);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // "names" is available to ANY authenticated user (powers the technician dropdown).
    if (action === "names") {
      const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;
      return json({
        names: data.users
          .map((u) => ({ name: ((u.user_metadata as Record<string, string> | undefined)?.name) || "", email: u.email }))
          .filter((u) => u.email),
      });
    }

    // All remaining actions require an admin.
    const role = (user.app_metadata as Record<string, unknown> | undefined)?.role;
    if (role !== "admin") return json({ error: "Nur Administrator:innen." }, 403);

    if (action === "list") {
      const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;
      return json({
        users: data.users.map((u) => ({
          id: u.id,
          email: u.email,
          name: ((u.user_metadata as Record<string, string> | undefined)?.name) || "",
          role: (u.app_metadata as Record<string, unknown> | undefined)?.role || "user",
          created_at: u.created_at,
        })),
      });
    }

    if (action === "create") {
      const { email, password, makeAdmin, name } = body;
      if (!email || !password) return json({ error: "E-Mail und Passwort erforderlich." }, 400);
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: name || "" },
        app_metadata: { role: makeAdmin ? "admin" : "user" },
      });
      if (error) throw error;
      return json({ user: { id: data.user.id, email: data.user.email } });
    }

    if (action === "rename") {
      const { id, name } = body;
      if (!id) return json({ error: "id erforderlich." }, 400);
      const { error } = await admin.auth.admin.updateUserById(id, { user_metadata: { name: name || "" } });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "delete") {
      const { id } = body;
      if (!id) return json({ error: "id erforderlich." }, 400);
      if (id === user.id) return json({ error: "Sie können sich nicht selbst löschen." }, 400);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Unbekannte Aktion." }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
