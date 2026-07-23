import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { lovable } from '@/integrations/lovable';
import esAndDLogo from '@/assets/es-d-logo.png';


export default function PortalLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [disabledPhone, setDisabledPhone] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const { user, isPortalUser, userRole, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user && isPortalUser) {
      navigate('/portal/dashboard', { replace: true });
    } else if (!authLoading && user && userRole) {
      navigate('/', { replace: true });
    }
  }, [user, isPortalUser, userRole, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      // Call record-portal-login to check 90-day lockout and update last_login_at
      const { data: result, error: recErr } = await supabase.functions.invoke('record-portal-login');
      if (recErr) throw recErr;

      if (result?.status === 'disabled') {
        // Fetch support phone
        const { data: setting } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'portal_support_phone')
          .maybeSingle();
        await supabase.auth.signOut();
        setDisabledPhone(setting?.setting_value ?? null);
        return;
      }
      if (result?.status === 'not_portal') {
        await supabase.auth.signOut();
        setError('This account is not a client portal account.');
        return;
      }
      const onboarded = (result as any)?.onboarding_completed === true;
      const approval = (result as any)?.approval_status as 'pending' | 'approved' | 'denied' | undefined;
      if (!onboarded) { navigate('/portal/onboarding', { replace: true }); return; }
      if (approval === 'denied') {
        await supabase.auth.signOut();
        setError('Your account was not approved. Please contact our office.');
        return;
      }
      if (approval === 'pending') { navigate('/portal/pending', { replace: true }); return; }
      navigate('/portal/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin + '/portal/auth/callback',
      });
      if (result.error) {
        setError(result.error.message || 'Google sign-in failed');
        return;
      }
      if (result.redirected) return;
      // Popup flow returned tokens — go to callback to finish portal handshake
      navigate('/portal/auth/callback', { replace: true });
    } catch (e: any) {
      setError(e?.message || 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#1e3a5f] via-[#2d5a87] to-[#2d8cc4] p-4">
      <Helmet>
        <title>Client Portal Sign In — WashTrack</title>
        <meta name="description" content="Client portal for ES&D Services customers. Sign in to view your facility's wash history and request weekly washes." />
        <link rel="canonical" href="https://washtracking.com/portal/login" />
        <meta property="og:title" content="Client Portal Sign In — WashTrack" />
        <meta property="og:description" content="View your facility's wash history and designate weekly washes." />
        <meta property="og:url" content="https://washtracking.com/portal/login" />
      </Helmet>
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <img
              src={esAndDLogo}
              alt="ES&D Services Inc."
              className="h-14 w-auto object-contain"
            />
          </div>
          <CardTitle className="text-2xl">Client Portal</CardTitle>
          <CardDescription>Sign in to view your wash history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
          </div>
          <form onSubmit={handleLogin} className="space-y-4 mt-4">
            {error && (
              <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Need an account?{' '}
              <Link to="/portal/signup" className="text-primary underline">Request access</Link>
            </div>
            <div className="text-center text-xs text-muted-foreground">
              Employee?{' '}
              <Link to="/login" className="underline">Internal sign in</Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={disabledPhone !== null} onOpenChange={(o) => !o && setDisabledPhone(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Account Disabled</DialogTitle>
            <DialogDescription>
              Your client portal account has been disabled due to 90 days of inactivity.
              Please call our office to have it re-enabled.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-center text-lg font-semibold">
            {disabledPhone || 'Contact our office'}
          </div>
          <DialogFooter>
            <Button onClick={() => setDisabledPhone(null)} className="w-full">OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
