import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, Loader2 } from "lucide-react";
import { logAuthEvent } from "@/lib/activityLogger";

type VerifyState = "checking" | "verifying" | "ready" | "invalid" | "signed_out";

const getRecoveryParams = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const error = searchParams.get("error") || hashParams.get("error");
  const errorCode = searchParams.get("error_code") || hashParams.get("error_code");
  const errorDescription = searchParams.get("error_description") || hashParams.get("error_description");
  const tokenHash = searchParams.get("token_hash") || hashParams.get("token_hash");
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  const type = searchParams.get("type") || hashParams.get("type") || "recovery";

  return {
    error,
    errorCode,
    errorDescription,
    tokenHash,
    accessToken,
    refreshToken,
    type,
    hasRecoveryLink: Boolean(tokenHash || (accessToken && refreshToken) || error || errorCode),
  };
};

export const ChangePassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verifyState, setVerifyState] = useState<VerifyState>("checking");
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  // Establish a trusted session before allowing password updates. Supports both
  // the token_hash reset links we now send and older hash-token recovery links.
  useEffect(() => {
    let isMounted = true;
    const recoveryParams = getRecoveryParams();

    const setSafeVerifyState = (state: VerifyState) => {
      if (isMounted) setVerifyState(state);
    };

    const showInvalidLinkToast = (description = "Please request a new password reset email.") => {
      toast({
        title: "Reset link invalid or expired",
        description,
        variant: "destructive",
      });
    };

    console.info("Password reset link state", {
      hasTokenHash: Boolean(recoveryParams.tokenHash),
      hasHashSession: Boolean(recoveryParams.accessToken && recoveryParams.refreshToken),
      hasError: Boolean(recoveryParams.error || recoveryParams.errorCode),
      type: recoveryParams.type,
    });

    (async () => {
      if (recoveryParams.error || recoveryParams.errorCode) {
        console.warn("Password reset link returned an error", {
          error: recoveryParams.error,
          errorCode: recoveryParams.errorCode,
          errorDescription: recoveryParams.errorDescription,
        });
        setSafeVerifyState("invalid");
        showInvalidLinkToast(recoveryParams.errorDescription || undefined);
        return;
      }

      if (recoveryParams.tokenHash) {
        setSafeVerifyState("verifying");
        const { error } = await supabase.auth.verifyOtp({
          token_hash: recoveryParams.tokenHash,
          type: "recovery",
        });

        if (error) {
          console.error("Password reset verifyOtp error:", error.message);
          setSafeVerifyState("invalid");
          showInvalidLinkToast();
          return;
        }

        console.info("Password reset token_hash verified");
        window.history.replaceState({}, "", window.location.pathname);
        setSafeVerifyState("ready");
        return;
      }

      if (recoveryParams.accessToken && recoveryParams.refreshToken) {
        setSafeVerifyState("verifying");
        const { error } = await supabase.auth.setSession({
          access_token: recoveryParams.accessToken,
          refresh_token: recoveryParams.refreshToken,
        });

        if (error) {
          console.error("Password reset setSession error:", error.message);
          setSafeVerifyState("invalid");
          showInvalidLinkToast();
          return;
        }

        console.info("Password reset hash session established");
        window.history.replaceState({}, "", window.location.pathname);
        setSafeVerifyState("ready");
        return;
      }

      const { data: { user: currentUser }, error } = await supabase.auth.getUser();
      if (error || !currentUser) {
        console.warn("Password change opened without a recovery link or signed-in user");
        setSafeVerifyState("signed_out");
        return;
      }

      setSafeVerifyState("ready");
    })();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please ensure both passwords are identical",
        variant: "destructive",
      });
      return;
    }

    if (formData.newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        throw new Error("Reset session missing. Please request a new password reset email.");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.newPassword,
        data: { password_reset_required: false }
      });

      if (updateError) throw updateError;

      const { error: flagUpdateError } = await supabase
        .from('users')
        .update({ must_change_password: false })
        .eq('id', currentUser.id);

      if (flagUpdateError) {
        console.error('Error updating must_change_password flag:', flagUpdateError);
      }

      logAuthEvent('auth_password_change', { user_id: currentUser?.id, email: currentUser?.email });

      toast({
        title: "Password Updated",
        description: "Your password has been successfully changed",
      });

      navigate("/", { replace: true });
    } catch (error: any) {
      console.error("Error changing password:", error);
      logAuthEvent('auth_error', { error: error.message, context: 'password_change' });
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formDisabled = verifyState !== "ready" || isSubmitting;

  const description = (() => {
    if (verifyState === "checking") return "Checking your password reset session…";
    if (verifyState === "verifying") return "Verifying your reset link…";
    if (verifyState === "invalid") return "This reset link is invalid or has expired. Please request a new one.";
    if (verifyState === "signed_out") return "Please use the link from your password reset email to continue.";
    return "Set a new password to continue.";
  })();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">Change Your Password</CardTitle>
          <CardDescription className="text-center">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {verifyState === "checking" || verifyState === "verifying" ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, newPassword: e.target.value })
                  }
                  placeholder="Enter your new password"
                  required
                  minLength={6}
                  disabled={formDisabled}
                />
                <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  placeholder="Confirm your new password"
                  required
                  minLength={6}
                  disabled={formDisabled}
                />
              </div>

              <Button type="submit" className="w-full" disabled={formDisabled}>
                {isSubmitting ? "Updating..." : "Update Password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};