import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const schema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  display_name: z.string().min(1).max(120).trim(),
  company_name: z.string().max(160).optional().nullable(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await req.json();
    const { email, password, display_name, company_name } = schema.parse(body);

    // Refuse if email already belongs to an internal employee
    const { data: internalUser } = await admin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (internalUser) {
      return new Response(
        JSON.stringify({ error: 'This email is already in use. Please contact our office.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check existing auth user for this email
    const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingAuth = listed?.users?.find((u) => u.email === email);
    if (existingAuth) {
      const { data: existingPortal } = await admin
        .from('client_portal_users')
        .select('id')
        .eq('auth_user_id', existingAuth.id)
        .maybeSingle();
      if (existingPortal) {
        return new Response(
          JSON.stringify({ error: 'An account with this email already exists. Please sign in.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Orphaned auth user — clean up
      await admin.auth.admin.deleteUser(existingAuth.id);
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { portal_user: true, display_name, company_name: company_name ?? null },
    });
    if (createErr || !created.user) {
      return new Response(
        JSON.stringify({ error: createErr?.message ?? 'Failed to create account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: insertErr } = await admin.from('client_portal_users').insert({
      auth_user_id: created.user.id,
      email,
      display_name,
      company_name: company_name ?? null,
      is_active: true,
      last_login_at: new Date().toISOString(),
    });
    if (insertErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return new Response(
        JSON.stringify({ error: insertErr.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
