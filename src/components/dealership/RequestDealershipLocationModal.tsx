import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Search, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { findSimilarMatches } from '@/lib/fuzzyMatch';

interface MatchCandidate {
  id: string;
  name: string;
  client_id?: string;
  client_name?: string;
  kind: 'client' | 'location';
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}

export function RequestDealershipLocationModal({ open, onOpenChange, onSubmitted }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [acknowledgedNone, setAcknowledgedNone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [clientName, setClientName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [notes, setNotes] = useState('');

  // Reset when opened
  useEffect(() => {
    if (open) {
      setStep(1);
      setSearch('');
      setCandidates([]);
      setAcknowledgedNone(false);
      setClientName('');
      setLocationName('');
      setAddress('');
      setCity('');
      setState('');
      setNotes('');
    }
  }, [open]);

  // Load all dealership clients + their locations once when modal opens
  const [allClients, setAllClients] = useState<{ id: string; name: string }[]>([]);
  const [allLocations, setAllLocations] = useState<{ id: string; name: string; client_id: string; client_name: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, business_type')
        .eq('business_type', 'dealership');
      const cArr = (clients || []).map((c: any) => ({ id: c.id, name: c.name }));
      setAllClients(cArr);

      if (cArr.length > 0) {
        const { data: locs } = await supabase
          .from('locations')
          .select('id, name, client_id, client:clients!inner(name, business_type)')
          .eq('client.business_type', 'dealership');
        setAllLocations(
          (locs || []).map((l: any) => ({
            id: l.id,
            name: l.name,
            client_id: l.client_id,
            client_name: l.client?.name || '',
          }))
        );
      }
    })();
  }, [open]);

  // Run fuzzy search on every keystroke
  useEffect(() => {
    if (search.trim().length < 3) {
      setCandidates([]);
      return;
    }
    setLoadingCandidates(true);
    const clientMatches = findSimilarMatches(search, allClients, 0.5, 5).map((m) => ({
      id: m.item.id,
      name: m.item.name,
      kind: 'client' as const,
    }));
    const locMatches = findSimilarMatches(
      search,
      allLocations.map((l) => ({ id: l.id, name: `${l.client_name} — ${l.name}` })),
      0.5,
      5
    ).map((m) => {
      const loc = allLocations.find((l) => l.id === m.item.id)!;
      return {
        id: loc.id,
        name: loc.name,
        client_id: loc.client_id,
        client_name: loc.client_name,
        kind: 'location' as const,
      };
    });
    setCandidates([...locMatches, ...clientMatches]);
    setLoadingCandidates(false);
  }, [search, allClients, allLocations]);

  const canProceedToStep2 = search.trim().length >= 3 && (candidates.length === 0 || acknowledgedNone);

  const handleSubmit = async () => {
    if (!user) return;
    if (!clientName.trim() || !locationName.trim()) {
      toast.error('Dealership name and lot name are required');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('dealership_location_requests' as any).insert({
        requested_by: user.id,
        proposed_client_name: clientName.trim(),
        proposed_location_name: locationName.trim(),
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        notes: notes.trim() || null,
      });
      if (error) throw error;
      toast.success('Request submitted — office will review and assign you when approved');
      onSubmitted?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request new dealership location</DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'First search to make sure it doesn\'t already exist.'
              : 'Tell the office about this dealership lot.'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="dealer-search">Dealership name</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="dealer-search"
                  className="pl-8"
                  placeholder="Type at least 3 letters…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            {search.trim().length < 3 ? (
              <p className="text-sm text-muted-foreground">Start typing to search existing dealerships.</p>
            ) : loadingCandidates ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : candidates.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Possible matches — pick one if it's yours:</p>
                {candidates.map((c) => (
                  <div
                    key={`${c.kind}-${c.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div>
                      <div className="font-medium">
                        {c.kind === 'location' ? `${c.client_name} — ${c.name}` : c.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Already exists — ask your manager to assign you
                      </div>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    id="ack-none"
                    checked={acknowledgedNone}
                    onCheckedChange={(v) => setAcknowledgedNone(v === true)}
                  />
                  <Label htmlFor="ack-none" className="cursor-pointer text-sm">
                    None of these match — I need to request a new one
                  </Label>
                </div>
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No matches found. You can request this as a new dealership.
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                disabled={!canProceedToStep2}
                onClick={() => {
                  setClientName(search.trim());
                  setStep(2);
                }}
              >
                Continue
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="client-name">Dealership name *</Label>
              <Input id="client-name" value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-name">Lot / location name *</Label>
              <Input
                id="loc-name"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="e.g., Bloomington Lot"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addr">Address</Label>
              <Input id="addr" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" value={state} onChange={(e) => setState(e.target.value)} maxLength={2} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit request
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}