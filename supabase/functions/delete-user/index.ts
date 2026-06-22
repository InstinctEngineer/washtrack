import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only super_admin can delete users
    const { data: isSuper, error: roleErr } = await supabaseAdmin.rpc("is_super_admin", {
      _user_id: user.id,
    });
    if (roleErr || !isSuper) {
      return new Response(
        JSON.stringify({ error: "Only super admins can delete users." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { user_id } = await req.json();
    if (!user_id || typeof user_id !== "string") {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user_id === user.id) {
      return new Response(
        JSON.stringify({ error: "You cannot delete your own account." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`Super admin ${user.id} deleting user ${user_id}`);

    // Clean dependent rows. Ignore errors on tables that may not have rows.
    const tables: Array<{ table: string; col: string }> = [
      { table: "user_roles", col: "user_id" },
      { table: "user_locations", col: "user_id" },
      { table: "message_reads", col: "user_id" },
      { table: "message_replies", col: "user_id" },
      { table: "user_message_views", col: "user_id" },
      { table: "error_report_replies", col: "user_id" },
      { table: "error_reports", col: "reported_by" },
      { table: "activity_logs", col: "user_id" },
    ];

    for (const t of tables) {
      const { error } = await supabaseAdmin.from(t.table).delete().eq(t.col, user_id);
      if (error) console.error(`delete from ${t.table} failed:`, error.message);
    }

    // Employee comments (either party)
    await supabaseAdmin.from("employee_comments").delete().eq("employee_id", user_id);
    await supabaseAdmin.from("employee_comments").delete().eq("recipient_id", user_id);

    // Remove from public.users
    const { error: userDelErr } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", user_id);
    if (userDelErr) {
      console.error("Failed to delete from users table:", userDelErr);
      return new Response(
        JSON.stringify({ error: `Failed to delete user record: ${userDelErr.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Delete auth user
    const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (authDelErr) {
      console.error("Failed to delete auth user:", authDelErr);
      return new Response(
        JSON.stringify({ error: `Failed to delete auth account: ${authDelErr.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("delete-user error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});