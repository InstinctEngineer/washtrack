import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

export default function PortalAuthCallback() {
  const navigate = useNavigate();
  const [disabledPhone, setDisabledPhone] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Wait briefly for the session to be hydrated by the OAuth helper
      let session = (await supabase.auth.getSession()).data.session;
      for (let i = 0; i < 10 && !session; i++) {
        await new Promise((r) => setTimeout(r, 200));
        session = (await supabase.auth.getSession()).data.session;
      }
      if (!session) {
        navigate('/portal/login', { replace: true });
        return;
      }

      // Ensure / create portal user row
      const { data: ensure, error: ensureErr } =
        await supabase.functions.invoke('ensure-portal-user');
      if (cancelled) return;
      if (ensureErr) {
        toast({ title: 'Sign-in failed', description: ensureErr.message, variant: 'destructive' });
        await supabase.auth.signOut();
        navigate('/portal/login', { replace: true });
        return;
      }
      if ((ensure as any)?.status === 'employee_conflict') {
        await supabase.auth.signOut();
        toast({
          title: 'Use internal sign-in',
          description: 'This email is registered as an employee.',
          variant: 'destructive',
        });
        navigate('/login', { replace: true });
        return;
      }

      // 90-day check
      const { data: rec, error: recErr } =
        await supabase.functions.invoke('record-portal-login');
      if (cancelled) return;
      if (recErr) {
        toast({ title: 'Sign-in failed', description: recErr.message, variant: 'destructive' });
        await supabase.auth.signOut();
        navigate('/portal/login', { replace: true });
        return;
      }
      if ((rec as any)?.status === 'disabled') {
        const { data: setting } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'portal_support_phone')
          .maybeSingle();
        await supabase.auth.signOut();
        setDisabledPhone(setting?.setting_value ?? null);
        return;
      }

      // Route based on whether they have any approved locations yet
      const { data: locs } = await supabase.rpc('get_portal_my_locations');
      if (cancelled) return;
      if (!locs || (locs as any[]).length === 0) {
        navigate('/portal/request-access', { replace: true });
      } else {
        navigate('/portal/dashboard', { replace: true });
      }
    };

    run();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#1e3a5f] via-[#2d5a87] to-[#2d8cc4]">
      <div className="text-white text-center">
        <div className="h-10 w-10 mx-auto mb-4 animate-spin rounded-full border-4 border-white border-t-transparent" />
        <p>Finishing sign-in…</p>
      </div>

      <Dialog open={disabledPhone !== null} onOpenChange={(o) => {
        if (!o) { setDisabledPhone(null); navigate('/portal/login', { replace: true }); }
      }}>
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
            <Button className="w-full" onClick={() => { setDisabledPhone(null); navigate('/portal/login', { replace: true }); }}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
