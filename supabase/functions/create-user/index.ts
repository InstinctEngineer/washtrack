import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate employee ID in format YYMMXXX (e.g., 2512001)
async function generateEmployeeId(supabaseAdmin: any): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // Last 2 digits of year
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Month with leading zero
  const prefix = `${year}${month}`;
  
  console.log(`Generating employee ID with prefix: ${prefix}`);
  
  // Query for the highest existing employee ID with this prefix
  const { data: existingUsers, error } = await supabaseAdmin
    .from('users')
    .select('employee_id')
    .like('employee_id', `${prefix}%`)
    .order('employee_id', { ascending: false })
    .limit(1);
  
  if (error) {
    console.error('Error querying existing employee IDs:', error);
    throw new Error('Failed to generate employee ID');
  }
  
  let nextNumber = 0;
  
  if (existingUsers && existingUsers.length > 0) {
    const lastId = existingUsers[0].employee_id;
    // Extract the last 3 digits and increment
    const lastNumber = parseInt(lastId.slice(-3), 10);
    nextNumber = lastNumber + 1;
    
    if (nextNumber > 999) {
      throw new Error('Maximum employee IDs for this month reached (999)');
    }
  }
  
  const employeeId = `${prefix}${nextNumber.toString().padStart(3, '0')}`;
  console.log(`Generated employee ID: ${employeeId}`);
  
  return employeeId;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Create regular client to verify caller's permissions
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    // Verify the caller is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if caller has admin or super_admin role
    const { data: callerRoles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (roleError || !callerRoles) {
      console.error('Error fetching caller roles:', roleError);
      return new Response(
        JSON.stringify({ error: 'Permission check failed' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if caller has finance, admin, or super_admin role
    const hasPermission = callerRoles.some(r => 
      r.role === 'finance' || r.role === 'admin' || r.role === 'super_admin'
    );
    
    if (!hasPermission) {
      console.error('User does not have sufficient privileges');
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Requires finance, admin, or super_admin role.' }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get caller's highest role level for hierarchy check
    const roleHierarchy: Record<string, number> = {
      employee: 1,
      manager: 2,
      finance: 3,
      admin: 4,
      super_admin: 5
    };
    
    let callerHighestRoleName = 'employee';
    let callerHighestLevel = 1;
    for (const r of callerRoles) {
      const level = roleHierarchy[r.role] || 0;
      if (level > callerHighestLevel) {
        callerHighestRoleName = r.role;
        callerHighestLevel = level;
      }
    }

    console.log('Caller highest role:', callerHighestRoleName);

    // Parse request body
    const requestBody = await req.json();

    // Validate input using Zod (employee_id is now auto-generated, not required)
    const createUserSchema = z.object({
      name: z.string()
        .min(1, 'Name required')
        .max(100, 'Name too long')
        .trim(),
      email: z.string()
        .email('Invalid email format')
        .max(255, 'Email too long'),
      password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password too long')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
      role: z.enum(['employee', 'manager', 'finance', 'admin', 'super_admin']),
      location_id: z.string().uuid().optional().nullable(),
      manager_id: z.string().uuid().optional().nullable(),
    });

    const validatedData = createUserSchema.parse(requestBody);
    const { name, email, location_id, role, manager_id, password } = validatedData;

    // Validate that the requested role is not higher than caller's role
    const requestedRoleLevel = roleHierarchy[role] || 0;
    if (requestedRoleLevel > callerHighestLevel) {
      console.error('Attempted to create user with higher role than caller');
      return new Response(
        JSON.stringify({ error: `Cannot create user with ${role} role. You can only create users with roles at or below your own level (${callerHighestRoleName}).` }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate employee ID
    const employee_id = await generateEmployeeId(supabaseAdmin);

    console.log('Creating user with email:', email, 'and employee_id:', employee_id);

    // Check for existing auth user with this email and handle orphaned users
    const { data: { users: existingAuthUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (!listError && existingAuthUsers) {
      const existingAuthUser = existingAuthUsers.find(u => u.email === email);
      
      if (existingAuthUser) {
        // Check if they exist in public.users table
        const { data: existingProfileUser } = await supabaseAdmin
          .from('users')
          .select('id, name, email, employee_id, is_active')
          .eq('email', email)
          .maybeSingle();
        
        if (!existingProfileUser) {
          // Orphaned auth user - delete and continue with creation
          console.log('Found orphaned auth user, cleaning up:', existingAuthUser.id);
          const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(existingAuthUser.id);
          
          if (deleteError) {
            console.error('Failed to delete orphaned auth user:', deleteError);
            return new Response(
              JSON.stringify({ error: 'Failed to clean up orphaned user record. Please contact support.' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          console.log('Successfully deleted orphaned auth user');
        } else {
          // User exists in both tables - return helpful error
          console.log('User already exists in both auth and users table');
          return new Response(
            JSON.stringify({ 
              error: `A user with email ${email} already exists.`,
              existingUser: {
                id: existingProfileUser.id,
                name: existingProfileUser.name,
                employee_id: existingProfileUser.employee_id,
                is_active: existingProfileUser.is_active
              }
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Create auth user using admin client (bypasses signup restrictions)
    const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name,
        employee_id,
        password_reset_required: true // Force password change on first login
      }
    });

    if (authCreateError) {
      console.error('Error creating auth user:', authCreateError);
      return new Response(
        JSON.stringify({ error: authCreateError.message }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!authData.user) {
      console.error('No user returned from auth creation');
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Auth user created successfully:', authData.user.id);

    // Insert into users table using admin client
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        employee_id,
        name,
        email,
        location_id: location_id || null,
        manager_id: manager_id || null,
        role,
        is_active: true,
        must_change_password: true // Force password change on first login
      });

    if (userError) {
      console.error('Error inserting into users table:', userError);
      // Clean up auth user if users table insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: userError.message }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User record created successfully');

    // Insert into user_roles table using admin client
    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role
      });

    if (roleInsertError) {
      console.error('Error inserting into user_roles table:', roleInsertError);
      // Clean up user and auth records
      await supabaseAdmin.from('users').delete().eq('id', authData.user.id);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: roleInsertError.message }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User role assigned successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email,
          employee_id: employee_id
        }
      }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in create-user function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
