import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const u = userData.user;
    const email = u.email ?? '';
    if (!email) {
      return new Response(JSON.stringify({ error: 'no_email' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Refuse if email already belongs to an internal employee
    const { data: internalUser } = await admin
      .from('users').select('id').eq('email', email).maybeSingle();
    if (internalUser) {
      return new Response(JSON.stringify({ status: 'employee_conflict' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert portal user
    const { data: existing } = await admin
      .from('client_portal_users')
      .select('id, is_active')
      .eq('auth_user_id', u.id)
      .maybeSingle();

    if (!existing) {
      const meta = (u.user_metadata ?? {}) as Record<string, any>;
      const first_name = meta.given_name ?? null;
      const last_name = meta.family_name ?? null;
      const display_name =
        meta.display_name || meta.name || meta.full_name ||
        [first_name, last_name].filter(Boolean).join(' ') ||
        email.split('@')[0];

      const { error: insertErr } = await admin.from('client_portal_users').insert({
        auth_user_id: u.id,
        email,
        display_name,
        first_name,
        last_name,
        is_active: true,
        onboarding_completed: false,
        approval_status: 'pending',
        last_login_at: new Date().toISOString(),
      });
      if (insertErr) {
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ status: 'created' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ status: 'existing' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
