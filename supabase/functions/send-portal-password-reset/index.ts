import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");

    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    // Caller must be finance, admin, or super_admin
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const allowed = new Set(["finance", "admin", "super_admin"]);
    const hasAccess = (callerRoles || []).some((r: any) => allowed.has(r.role));
    if (!hasAccess) throw new Error("Finance access or higher required");

    const { portal_user_id } = await req.json();
    if (!portal_user_id) throw new Error("portal_user_id is required");

    // Look up the portal user's auth account
    const { data: portalUser, error: puErr } = await admin
      .from("client_portal_users")
      .select("auth_user_id, email")
      .eq("id", portal_user_id)
      .maybeSingle();
    if (puErr || !portalUser) throw new Error("Portal user not found");

    // Fetch identities to detect google-only accounts
    const { data: authData, error: getErr } =
      await admin.auth.admin.getUserById(portalUser.auth_user_id);
    if (getErr || !authData?.user) throw new Error("Auth user not found");

    const identities = authData.user.identities || [];
    const hasEmailIdentity = identities.some(
      (i: any) => i.provider === "email",
    );
    if (!hasEmailIdentity) {
      throw new Error(
        "This portal user signed in with Google. Password resets aren't available for Google-authenticated accounts.",
      );
    }

    // Trigger the standard recovery email flow (uses auth-email-hook template)
    const publicClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const appUrl = Deno.env.get("APP_URL") || "https://washtracking.com";
    const { error: resetErr } = await publicClient.auth.resetPasswordForEmail(
      portalUser.email,
      { redirectTo: `${appUrl}/change-password` },
    );
    if (resetErr) throw resetErr;

    return new Response(
      JSON.stringify({ success: true, email: portalUser.email }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("send-portal-password-reset error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});