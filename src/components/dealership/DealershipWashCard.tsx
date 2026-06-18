import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Car, Loader2, Plus, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { resolveDealershipRate } from '@/lib/dealershipRates';
import { RequestDealershipLocationModal } from './RequestDealershipLocationModal';

interface DealershipLocOption {
  id: string;
  name: string;
  client_id: string;
  client_name: string;
}

const LAST_USED_KEY = 'wt:lastDealershipLocation';

export function DealershipWashCard() {
  const { user, userLocations } = useAuth();
  const [options, setOptions] = useState<DealershipLocOption[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [count, setCount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [rate, setRate] = useState<number>(5.25);
  const [submitting, setSubmitting] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [recent, setRecent] = useState<any[]>([]);

  // Load assigned dealership locations
  useEffect(() => {
    (async () => {
      if (!userLocations || userLocations.length === 0) {
        setLoadingOpts(false);
        return;
      }
      const { data } = await supabase
        .from('locations')
        .select('id, name, client_id, client:clients!inner(name, business_type)')
        .in('id', userLocations)
        .eq('is_active', true)
        .eq('client.business_type', 'dealership');

      const opts: DealershipLocOption[] = (data || []).map((l: any) => ({
        id: l.id,
        name: l.name,
        client_id: l.client_id,
        client_name: l.client?.name || '',
      }));
      // Sort: last-used first, then alpha by combined label
      const lastUsed = localStorage.getItem(`${LAST_USED_KEY}:${user?.id}`);
      opts.sort((a, b) => {
        if (a.id === lastUsed) return -1;
        if (b.id === lastUsed) return 1;
        return `${a.client_name} ${a.name}`.localeCompare(`${b.client_name} ${b.name}`);
      });
      setOptions(opts);
      if (opts.length > 0 && !selectedId) {
        setSelectedId(opts[0].id);
      }
      setLoadingOpts(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocations, user?.id]);

  // Resolve rate when location changes
  useEffect(() => {
    const opt = options.find((o) => o.id === selectedId);
    if (!opt) return;
    resolveDealershipRate(opt.client_id, opt.id).then(setRate);
  }, [selectedId, options]);

  // Fetch recent entries for this user/location
  const fetchRecent = async () => {
    if (!user || !selectedId) return;
    const { data } = await supabase
      .from('dealership_wash_batches' as any)
      .select('id, work_date, vehicle_count, rate_applied, notes, location_id')
      .eq('location_id', selectedId)
      .order('work_date', { ascending: false })
      .limit(10);
    setRecent((data as any[]) || []);
  };
  useEffect(() => {
    fetchRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selectedOpt = useMemo(() => options.find((o) => o.id === selectedId), [selectedId, options]);

  const parsedCount = useMemo(() => {
    const n = parseInt(count, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [count]);

  const total = useMemo(() => parsedCount * rate, [parsedCount, rate]);

  const handleSubmit = async () => {
    if (!user || !selectedOpt) return;
    if (parsedCount <= 0) {
      toast.error('Enter a vehicle count greater than 0');
      return;
    }
    setSubmitting(true);
    try {
      // Upsert by unique (location, employee, date)
      const { error } = await supabase.from('dealership_wash_batches' as any).upsert(
        {
          client_id: selectedOpt.client_id,
          location_id: selectedOpt.id,
          employee_id: user.id,
          work_date: date,
          vehicle_count: parsedCount,
          rate_applied: rate,
          notes: notes.trim() || null,
        },
        { onConflict: 'location_id,employee_id,work_date' }
      );
      if (error) throw error;
      localStorage.setItem(`${LAST_USED_KEY}:${user.id}`, selectedOpt.id);
      toast.success(`Logged ${parsedCount} vehicles — $${total.toFixed(2)}`);
      setCount('');
      setNotes('');
      fetchRecent();
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingOpts) return null;
  // Don't render if user has no dealership assignments
  if (options.length === 0) return null;

  return (
    <>
      <Card className="border-blue-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Log Dealership Wash
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Location</Label>
            {options.length === 1 ? (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium">
                {options[0].client_name} — {options[0].name}
              </div>
            ) : (
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.client_name} — {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => setRequestOpen(true)}
            >
              <Plus className="h-3 w-3 mr-1" /> Wrong lot? Request a new dealership location
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="d-date">Date</Label>
              <Input
                id="d-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-count">Vehicles washed</Label>
              <Input
                id="d-count"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={count}
                onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))}
                placeholder="47"
              />
            </div>
          </div>

          <div className="rounded-md bg-muted/40 p-3 text-sm">
            <span className="text-muted-foreground">Total at $</span>
            <span className="font-mono">{rate.toFixed(2)}</span>
            <span className="text-muted-foreground"> × {parsedCount} = </span>
            <span className="font-bold text-lg">${total.toFixed(2)}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="d-notes">Notes (optional)</Label>
            <Textarea
              id="d-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Weather, special conditions, etc."
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || parsedCount <= 0}
            className="w-full h-12 text-base font-semibold bg-blue-700 hover:bg-blue-800 text-white"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…</>
            ) : (
              <><Send className="h-4 w-4 mr-2" /> Submit wash entry</>
            )}
          </Button>

          {recent.length > 0 && (
            <div className="pt-2 border-t">
              <div className="text-xs font-semibold text-muted-foreground mb-2">Recent at this location</div>
              <div className="space-y-1">
                {recent.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex justify-between text-sm">
                    <span>{format(new Date(r.work_date + 'T00:00:00'), 'MMM d')}</span>
                    <span className="font-mono">
                      {r.vehicle_count} × ${Number(r.rate_applied).toFixed(2)} = ${(r.vehicle_count * Number(r.rate_applied)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <RequestDealershipLocationModal
        open={requestOpen}
        onOpenChange={setRequestOpen}
      />
    </>
  );
}