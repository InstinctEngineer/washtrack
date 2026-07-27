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

type VerifyState = "idle" | "verifying" | "ready" | "invalid";

export const ChangePassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verifyState, setVerifyState] = useState<VerifyState>("idle");
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  // If the URL carries a recovery token_hash (from the emailed reset link),
  // exchange it for a session via verifyOtp. This flow survives email
  // link-scanners — a passive GET does not consume it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type");

    if (!tokenHash) {
      setVerifyState("ready");
      return;
    }

    setVerifyState("verifying");
    (async () => {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: (type as any) || "recovery",
      });
      if (error) {
        console.error("verifyOtp error:", error);
        setVerifyState("invalid");
        toast({
          title: "Reset link invalid or expired",
          description: "Please request a new password reset email.",
          variant: "destructive",
        });
        return;
      }
      // Strip the token from the URL so it isn't retried or bookmarked.
      window.history.replaceState({}, "", window.location.pathname);
      setVerifyState("ready");
    })();
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
      if (currentUser) {
        const { error: flagUpdateError } = await supabase
          .from('users')
          .update({ must_change_password: false })
          .eq('id', currentUser.id);

        if (flagUpdateError) {
          console.error('Error updating must_change_password flag:', flagUpdateError);
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.newPassword,
        data: { password_reset_required: false }
      });

      if (updateError) throw updateError;

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">Change Your Password</CardTitle>
          <CardDescription className="text-center">
            {verifyState === "verifying"
              ? "Verifying your reset link…"
              : verifyState === "invalid"
              ? "This reset link is invalid or has expired. Please request a new one."
              : "Set a new password to continue."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {verifyState === "verifying" ? (
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