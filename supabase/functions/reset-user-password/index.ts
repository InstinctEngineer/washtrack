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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if caller has admin or super_admin role
    const { data: callerRoles, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (roleError || !callerRoles || callerRoles.length === 0) {
      throw new Error("Admin access required");
    }

    const isCallerAdmin = callerRoles.some(r => r.role === 'admin');
    const isCallerSuperAdmin = callerRoles.some(r => r.role === 'super_admin');

    if (!isCallerAdmin && !isCallerSuperAdmin) {
      throw new Error("Admin access required");
    }

    const { userId, newPassword } = await req.json();

    if (!userId) {
      throw new Error("User ID is required");
    }

    if (!newPassword || newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    // Validate password complexity
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
    if (!passwordRegex.test(newPassword)) {
      throw new Error("Password must contain uppercase, lowercase, and number");
    }

    // Check if target user is a super_admin
    const { data: targetRoles, error: targetRoleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (targetRoleError) {
      throw new Error("Failed to verify target user permissions");
    }

    const isTargetSuperAdmin = targetRoles?.some(r => r.role === 'super_admin');

    // Block non-super-admins from resetting super-admin passwords
    if (isTargetSuperAdmin && !isCallerSuperAdmin) {
      throw new Error("Only Super Admins can reset Super Admin passwords");
    }

    const { data: targetAuthUser, error: targetAuthError } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (targetAuthError || !targetAuthUser?.user) {
      throw new Error("User login account was not found");
    }

    // Update user password and set metadata to require password change
    const existingMetadata = targetAuthUser.user.user_metadata ?? {};
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { 
        password: newPassword,
        user_metadata: {
          ...existingMetadata,
          password_reset_required: true
        }
      }
    );

    if (error) {
      console.error("Error resetting password:", error);
      throw error;
    }

    const { error: profileError } = await supabaseAdmin
      .from("users")
      .update({
        must_change_password: true,
        failed_login_attempts: 0,
        account_locked_until: null,
      })
      .eq("id", userId);

    if (profileError) {
      console.error("Error updating password reset flags:", profileError);
      throw new Error("Password was set, but failed to mark account for password change");
    }

    console.log("Temporary password set successfully", {
      target_user_id: userId,
      reset_by: user.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password reset successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in reset-user-password function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
