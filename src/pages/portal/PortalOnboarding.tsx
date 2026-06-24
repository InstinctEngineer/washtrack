import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';

const schema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(100),
  last_name: z.string().trim().min(1, 'Last name is required').max(100),
  work_location: z.string().trim().min(1, 'Work location is required').max(200),
});

export default function PortalOnboarding() {
  const navigate = useNavigate();
  const { refreshUserProfile, signOut } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [work, setWork] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const next = () => {
    setError('');
    if (step === 1) {
      if (!first.trim() || !last.trim()) { setError('Please enter both first and last name.'); return; }
      setStep(2);
    } else if (step === 2) {
      if (!work.trim()) { setError('Please enter your work location.'); return; }
      setStep(3);
    }
  };

  const submit = async () => {
    setError('');
    const parsed = schema.safeParse({ first_name: first, last_name: last, work_location: work });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setSubmitting(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('submit-portal-onboarding', {
        body: parsed.data,
      });
      if (fnErr) throw fnErr;
      if ((data as any)?.error) throw new Error((data as any).error);
      await refreshUserProfile();
      toast({ title: 'Thanks!', description: 'Your account is now pending approval.' });
      navigate('/portal/pending', { replace: true });
    } catch (e: any) {
      setError(e?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#1e3a5f] via-[#2d5a87] to-[#2d8cc4] p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome — let's set up your account</CardTitle>
          <CardDescription>Step {step} of 3</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="first">First name</Label>
                <Input id="first" value={first} onChange={(e) => setFirst(e.target.value)} maxLength={100} autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last">Last name</Label>
                <Input id="last" value={last} onChange={(e) => setLast(e.target.value)} maxLength={100} />
              </div>
              <Button className="w-full" onClick={next}>Continue</Button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="work">Where do you work?</Label>
                <Input
                  id="work"
                  value={work}
                  onChange={(e) => setWork(e.target.value)}
                  maxLength={200}
                  autoFocus
                  placeholder="e.g., Acme Dealership – 123 Main St"
                />
                <p className="text-xs text-muted-foreground">
                  Company name and/or address — we'll use this to match you to the right locations.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                <Button className="flex-1" onClick={next}>Continue</Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="rounded-md border p-3 text-sm space-y-2">
                <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{first} {last}</span></div>
                <div><span className="text-muted-foreground">Work location:</span> <span className="font-medium">{work}</span></div>
              </div>
              <p className="text-xs text-muted-foreground">
                After you submit, your account will be reviewed by our team. You'll be able to request access to locations once approved.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)} disabled={submitting}>Back</Button>
                <Button className="flex-1" onClick={submit} disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit'}
                </Button>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={async () => { await signOut(); navigate('/portal/login', { replace: true }); }}
            className="w-full text-xs text-muted-foreground underline mt-2"
          >
            Sign out
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
