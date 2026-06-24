import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Client Portal</CardTitle>
          <CardDescription>Sign in to view your wash history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {googleLoading ? 'Opening Google…' : 'Continue with Google'}
            </Button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex-1 border-t" />
              <span>or</span>
              <div className="flex-1 border-t" />
            </div>
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
