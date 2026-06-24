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
    const uid = userData.user.id;

    const { data: portal } = await admin
      .from('client_portal_users')
      .select('id, is_active, last_login_at, created_at, disabled_reason, approval_status, onboarding_completed')
      .eq('auth_user_id', uid)
      .maybeSingle();

    if (!portal) {
      return new Response(JSON.stringify({ status: 'not_portal' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
    const referenceTime = portal.last_login_at ?? portal.created_at;
    const stale = referenceTime && (Date.now() - new Date(referenceTime).getTime() > NINETY_DAYS_MS);

    if (!portal.is_active || stale) {
      // Auto-disable if not yet
      if (portal.is_active) {
        await admin
          .from('client_portal_users')
          .update({ is_active: false, disabled_reason: 'inactivity_90d' })
          .eq('id', portal.id);
      }
      // Revoke all sessions for this user
      try { await admin.auth.admin.signOut(uid); } catch (_) { /* ignore */ }
      return new Response(JSON.stringify({ status: 'disabled', reason: 'inactivity_90d' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await admin
      .from('client_portal_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', portal.id);

    return new Response(JSON.stringify({
      status: 'ok',
      approval_status: portal.approval_status,
      onboarding_completed: portal.onboarding_completed,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
