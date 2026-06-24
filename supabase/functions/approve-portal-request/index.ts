import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const schema = z.object({
  request_id: z.string().uuid(),
  decision: z.enum(['approved', 'denied']),
  review_note: z.string().max(500).optional().nullable(),
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const reviewer = userData.user;

    // Verify reviewer is finance+
    const { data: roles } = await admin
      .from('user_roles').select('role').eq('user_id', reviewer.id);
    const allowed = ['finance', 'admin', 'super_admin'];
    if (!roles || !roles.some((r) => allowed.includes(r.role))) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { request_id, decision, review_note } = schema.parse(body);

    const { data: request, error: reqErr } = await admin
      .from('client_portal_access_requests')
      .select('id, portal_user_id, location_id, status')
      .eq('id', request_id)
      .maybeSingle();
    if (reqErr || !request) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (request.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'already_reviewed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (decision === 'approved') {
      const { error: grantErr } = await admin
        .from('client_portal_location_access')
        .upsert({
          portal_user_id: request.portal_user_id,
          location_id: request.location_id,
          granted_by: reviewer.id,
        }, { onConflict: 'portal_user_id,location_id' });
      if (grantErr) {
        return new Response(JSON.stringify({ error: grantErr.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    await admin
      .from('client_portal_access_requests')
      .update({
        status: decision,
        reviewed_by: reviewer.id,
        reviewed_at: new Date().toISOString(),
        review_note: review_note ?? null,
      })
      .eq('id', request_id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
