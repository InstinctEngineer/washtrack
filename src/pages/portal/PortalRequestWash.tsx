import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PortalShell } from '@/components/PortalShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2, Star, ArrowLeft } from 'lucide-react';

interface WorkItemRow {
  work_item_id: string;
  identifier: string;
  work_type_name: string;
  is_requested: boolean;
  requested_at: string | null;
}

function currentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = (day + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMon);
  return format(monday, 'yyyy-MM-dd');
}

export default function PortalRequestWash() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<WorkItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [locName, setLocName] = useState('');
  const [clientName, setClientName] = useState('');
  const [cancelTarget, setCancelTarget] = useState<WorkItemRow | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const weekStart = useMemo(() => currentWeekStart(), []);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [metaRes, itemsRes] = await Promise.all([
      supabase.rpc('get_portal_my_locations'),
      supabase.rpc('get_portal_location_work_items', { p_location_id: id }),
    ]);
    const me = (metaRes.data as any[])?.find((l) => l.location_id === id);
    if (me) { setLocName(me.location_name); setClientName(me.client_name); }
    setItems(((itemsRes.data as WorkItemRow[]) || []));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const g: Record<string, WorkItemRow[]> = {};
    items
      .filter((i) => !q || i.identifier.toLowerCase().includes(q) || i.work_type_name.toLowerCase().includes(q))
      .forEach((i) => {
        if (!g[i.work_type_name]) g[i.work_type_name] = [];
        g[i.work_type_name].push(i);
      });
    return g;
  }, [items, search]);

  const toggle = (workItemId: string, disabled: boolean) => {
    if (disabled) {
      const row = items.find((i) => i.work_item_id === workItemId);
      if (row) setCancelTarget(row);
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(workItemId)) next.delete(workItemId); else next.add(workItemId);
      return next;
    });
  };

  const confirmCancel = async () => {
    if (!user || !id || !cancelTarget) return;
    setCancelling(true);
    try {
      const { data: pu, error: puErr } = await supabase
        .from('client_portal_users')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (puErr || !pu?.id) throw new Error('Portal account not found');

      const { error: delErr } = await supabase
        .from('wash_requests' as any)
        .delete()
        .eq('work_item_id', cancelTarget.work_item_id)
        .eq('requested_for_week', weekStart)
        .eq('portal_user_id', pu.id)
        .is('fulfilled_at', null);
      if (delErr) throw delErr;

      const body =
        `Wash request cancelled by ${clientName} (${locName}) for the week of ${weekStart}:\n\n` +
        `• ${cancelTarget.work_type_name} — ${cancelTarget.identifier}`;
      await supabase.from('employee_comments').insert({
        employee_id: user.id,
        location_id: id,
        comment_text: body,
        week_start_date: weekStart,
      } as any);

      toast.success('Wash request removed');
      setCancelTarget(null);
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to cancel request');
    } finally {
      setCancelling(false);
    }
  };

  const submit = async () => {
    if (!user || !id) return;
    if (selected.size === 0) {
      toast.error('Select at least one vehicle to request');
      return;
    }
    setSaving(true);
    try {
      // Look up the portal user id
      const { data: pu, error: puErr } = await supabase
        .from('client_portal_users')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (puErr || !pu?.id) throw new Error('Portal account not found');

      const rows = Array.from(selected).map((wid) => ({
        location_id: id,
        work_item_id: wid,
        portal_user_id: pu.id,
        requested_for_week: weekStart,
      }));

      const { error: insErr } = await supabase
        .from('wash_requests' as any)
        .upsert(rows, { onConflict: 'work_item_id,requested_for_week', ignoreDuplicates: true });
      if (insErr) throw insErr;

      // Build the notification message body
      const requestedItems = items.filter((i) => selected.has(i.work_item_id));
      const lines = requestedItems.map((i) => `• ${i.work_type_name} — ${i.identifier}`).join('\n');
      const body =
        `Wash request from ${clientName} (${locName}) for the week of ${weekStart}:\n\n` +
        `${lines}\n\n` +
        (note.trim() ? `Notes: ${note.trim()}\n\n` : '') +
        `These units are marked with a gold star on the employee dashboard until washed.`;

      const { error: msgErr } = await supabase.from('employee_comments').insert({
        employee_id: user.id,
        location_id: id,
        comment_text: body,
        week_start_date: weekStart,
      } as any);
      if (msgErr) console.warn('message insert failed', msgErr);

      toast.success(`Requested ${selected.size} vehicle${selected.size === 1 ? '' : 's'} for this week`);
      setSelected(new Set());
      setNote('');
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalShell title="Request Washes">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">{clientName}{locName ? ` — ${locName}` : ''}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Week of {weekStart}</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to={`/portal/locations/${id}`}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search by vehicle number or type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading vehicles…
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No vehicles found for this location.</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([type, rows]) => (
                <div key={type}>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {type} <span className="text-xs">({rows.length})</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {rows.map((r) => {
                      const already = r.is_requested;
                      const isSel = selected.has(r.work_item_id);
                      return (
                        <button
                          key={r.work_item_id}
                          type="button"
                          onClick={() => toggle(r.work_item_id, already)}
                          title={already ? 'Click to cancel this request' : undefined}
                          className={
                            'relative flex items-center gap-2 rounded-md border-2 px-3 py-3 text-left transition ' +
                            (already
                              ? 'border-amber-400/70 bg-amber-50 dark:bg-amber-500/10 hover:border-amber-500 cursor-pointer'
                              : isSel
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/60')
                          }
                        >
                          {already ? (
                            <Star className="h-4 w-4 fill-amber-400 text-amber-500 shrink-0" />
                          ) : (
                            <Checkbox checked={isSel} className="pointer-events-none" />
                          )}
                          <span className="font-mono font-semibold truncate">{r.identifier}</span>
                          {already && (
                            <Badge variant="outline" className="ml-auto text-[10px] border-amber-500/50 text-amber-700 dark:text-amber-300">
                              Requested
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything the wash crew should know…"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t">
            <div className="text-sm text-muted-foreground">
              {selected.size} selected
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate(`/portal/locations/${id}`)}>Cancel</Button>
              <Button onClick={submit} disabled={saving || selected.size === 0}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</> : `Request ${selected.size || ''} wash${selected.size === 1 ? '' : 'es'}`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && !cancelling && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove wash request?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget
                ? `Cancel the wash request for ${cancelTarget.work_type_name} — ${cancelTarget.identifier} for the week of ${weekStart}?`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep request</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmCancel(); }} disabled={cancelling}>
              {cancelling ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Removing…</> : 'Remove request'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PortalShell>
  );
}