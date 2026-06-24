import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const schema = z.object({
  portal_user_id: z.string().uuid(),
  action: z.enum(['approve', 'deny']),
  note: z.string().max(500).optional().nullable(),
});

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

    // Caller must be finance+
    const { data: roleCheck } = await admin.rpc('has_role_or_higher', {
      _user_id: uid, _required_role: 'finance',
    });
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { portal_user_id, action } = schema.parse(body);

    const update: Record<string, unknown> =
      action === 'approve'
        ? {
            approval_status: 'approved',
            approved_by: uid,
            approved_at: new Date().toISOString(),
            is_active: true,
            disabled_reason: null,
          }
        : {
            approval_status: 'denied',
            approved_by: uid,
            approved_at: new Date().toISOString(),
            is_active: false,
            disabled_reason: 'denied',
          };

    const { data: target } = await admin
      .from('client_portal_users')
      .select('auth_user_id')
      .eq('id', portal_user_id)
      .maybeSingle();

    const { error: upErr } = await admin
      .from('client_portal_users')
      .update(update)
      .eq('id', portal_user_id);
    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If denying, revoke sessions
    if (action === 'deny' && target?.auth_user_id) {
      try { await admin.auth.admin.signOut(target.auth_user_id); } catch (_) { /* ignore */ }
    }

    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
