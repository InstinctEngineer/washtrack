import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GENERIC = "We couldn't create an account with this email. Please contact our office.";

const schema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
});

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Determine whether the caller is internal staff (manager or above).
  let isStaff = false;
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (token) {
      const { data } = await admin.auth.getUser(token);
      if (data?.user) {
        const { data: ok } = await admin.rpc('has_role_or_higher', { _user_id: data.user.id, _required_role: 'manager' });
        isStaff = !!ok;
      }
    }
  } catch { /* treat as public */ }

  const fail = (status: number, staffMessage: string, publicMessage = GENERIC) =>
    json({ error: isStaff ? staffMessage : publicMessage }, status);

  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail(400, 'Enter a valid email and a password of at least 8 characters.', 'Enter a valid email and a password of at least 8 characters.');
    }
    const { email, password } = parsed.data;

    const { data: internalUser } = await admin
      .from('users')
      .select('name, employee_id, is_active')
      .ilike('email', email)
      .maybeSingle();
    if (internalUser) {
      return fail(409,
        `This email already belongs to an internal employee account (${internalUser.name}, Employee ID ${internalUser.employee_id}, ${internalUser.is_active ? 'active' : 'inactive'}). One email can't be both an employee and a portal user. Change or remove the employee account's email in User Management first, then try again.`);
    }

    const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingAuth = listed?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (existingAuth) {
      const { data: existingPortal } = await admin
        .from('client_portal_users').select('id').eq('auth_user_id', existingAuth.id).maybeSingle();
      if (existingPortal) {
        return fail(409, 'A client portal account with this email already exists. Find it on the Portal Users page.',
          'An account with this email already exists. Please sign in.');
      }
      await admin.auth.admin.deleteUser(existingAuth.id);
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { portal_user: true },
    });
    if (createErr || !created.user) {
      console.error('createUser failed', createErr);
      return fail(400, `Account could not be created: ${createErr?.message ?? 'unknown error'}`);
    }

    const { error: insertErr } = await admin.from('client_portal_users').insert({
      auth_user_id: created.user.id, email, display_name: email.split('@')[0],
      is_active: true, onboarding_completed: false, approval_status: 'pending',
      last_login_at: new Date().toISOString(),
    });
    if (insertErr) {
      console.error('portal insert failed', insertErr);
      await admin.auth.admin.deleteUser(created.user.id);
      return fail(400, `Portal profile could not be saved: ${insertErr.message}`);
    }

    return json({ success: true }, 200);
  } catch (e) {
    console.error('create-portal-user error', e);
    return fail(500, `Unexpected error: ${e instanceof Error ? e.message : 'unknown'}`);
  }
});
