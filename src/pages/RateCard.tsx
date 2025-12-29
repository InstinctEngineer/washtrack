import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { hasRoleOrHigher } from '@/lib/roleUtils';
import { UserRole } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, ChevronDown, Trash2 } from 'lucide-react';

interface RateConfig {
  id: string;
  client_id: string;
  location_id: string;
  work_type_id: string;
  frequency: string | null;
  rate: number | null;
  needs_rate_review: boolean;
  is_active: boolean;
  created_at: string;
  client: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  work_type: { id: string; name: string; rate_type: string } | null;
}

const FREQUENCY_OPTIONS = [
  { value: '', label: 'None (Hourly work)' },
  { value: '1x/week', label: '1x/week' },
  { value: '2x/week', label: '2x/week' },
  { value: '3x/week', label: '3x/week' },
  { value: 'Daily', label: 'Daily' },
  { value: 'Weekly', label: 'Weekly' },
  { value: 'Bi-weekly', label: 'Bi-weekly' },
  { value: 'Monthly', label: 'Monthly' },
];

const RateCard = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = hasRoleOrHigher(userRole as UserRole, 'admin' as UserRole);
  const isFinanceOrHigher = hasRoleOrHigher(userRole as UserRole, 'finance' as UserRole);

  const [isOpen, setIsOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<RateConfig | null>(null);

  // Filters
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterWorkType, setFilterWorkType] = useState<string>('all');
  const [showNeedsReview, setShowNeedsReview] = useState(false);

  // Form state
  const [formClientId, setFormClientId] = useState('');
  const [formLocationId, setFormLocationId] = useState('');
  const [formWorkTypeId, setFormWorkTypeId] = useState('');
  const [formFrequency, setFormFrequency] = useState('');
  const [formRate, setFormRate] = useState('');

  // Inline edit state
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [editingRateValue, setEditingRateValue] = useState('');

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch locations (filtered by selected client in filters)
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', filterClient],
    queryFn: async () => {
      let query = supabase
        .from('locations')
        .select('id, name, client_id')
        .eq('is_active', true)
        .order('name');
      if (filterClient !== 'all') {
        query = query.eq('client_id', filterClient);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch form locations (filtered by form client)
  const { data: formLocations = [] } = useQuery({
    queryKey: ['locations-form', formClientId],
    queryFn: async () => {
      if (!formClientId) return [];
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .eq('client_id', formClientId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!formClientId,
  });

  // Fetch work types
  const { data: workTypes = [] } = useQuery({
    queryKey: ['work-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_types')
        .select('id, name, rate_type')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch rate configs
  const { data: rateConfigs = [], isLoading } = useQuery({
    queryKey: ['rate-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rate_configs')
        .select(`
          *,
          client:clients(id, name),
          location:locations(id, name),
          work_type:work_types(id, name, rate_type)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as RateConfig[];
    },
  });

  // Filter rate configs
  const filteredConfigs = rateConfigs.filter(rc => {
    if (filterClient !== 'all' && rc.client_id !== filterClient) return false;
    if (filterLocation !== 'all' && rc.location_id !== filterLocation) return false;
    if (filterWorkType !== 'all' && rc.work_type_id !== filterWorkType) return false;
    if (showNeedsReview && !rc.needs_rate_review) return false;
    return true;
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      // Check for duplicate
      let query = supabase
        .from('rate_configs')
        .select('id')
        .eq('client_id', formClientId)
        .eq('location_id', formLocationId)
        .eq('work_type_id', formWorkTypeId);
      
      if (formFrequency) {
        query = query.eq('frequency', formFrequency);
      } else {
        query = query.is('frequency', null);
      }
      
      const { data: existing } = await query.maybeSingle();
      
      if (existing) {
        throw new Error('A rate configuration with this combination already exists');
      }

      const rateValue = formRate.trim() === '' ? null : parseFloat(formRate);
      
      const { error } = await supabase
        .from('rate_configs')
        .insert({
          client_id: formClientId,
          location_id: formLocationId,
          work_type_id: formWorkTypeId,
          frequency: formFrequency || null,
          rate: rateValue,
          needs_rate_review: rateValue === null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-configs'] });
      toast({ title: 'Rate configuration created successfully' });
      closeModal();
    },
    onError: (error) => {
      toast({
        title: 'Error creating rate configuration',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update rate inline mutation
  const updateRateMutation = useMutation({
    mutationFn: async ({ id, rate }: { id: string; rate: number | null }) => {
      const { error } = await supabase
        .from('rate_configs')
        .update({
          rate,
          needs_rate_review: rate === null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-configs'] });
      toast({ title: 'Rate updated' });
      setEditingRateId(null);
    },
    onError: (error) => {
      toast({
        title: 'Error updating rate',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('rate_configs')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-configs'] });
      toast({ title: 'Status updated' });
    },
    onError: (error) => {
      toast({
        title: 'Error updating status',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('rate_configs')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-configs'] });
      toast({ title: 'Rate configuration deleted successfully' });
      setDeleteItem(null);
    },
    onError: (error) => {
      toast({
        title: 'Error deleting rate configuration',
        description: error.message.includes('violates foreign key')
          ? 'Cannot delete: This rate configuration has work items attached'
          : error.message,
        variant: 'destructive',
      });
    },
  });

  const openCreateModal = () => {
    setFormClientId('');
    setFormLocationId('');
    setFormWorkTypeId('');
    setFormFrequency('');
    setFormRate('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setFormClientId('');
    setFormLocationId('');
    setFormWorkTypeId('');
    setFormFrequency('');
    setFormRate('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClientId || !formLocationId || !formWorkTypeId) {
      toast({
        title: 'Missing required fields',
        description: 'Client, Location, and Work Type are required',
        variant: 'destructive',
      });
      return;
    }
    createMutation.mutate();
  };

  const startEditingRate = (rc: RateConfig) => {
    setEditingRateId(rc.id);
    setEditingRateValue(rc.rate?.toString() || '');
  };

  const saveRate = (id: string) => {
    const rateValue = editingRateValue.trim() === '' ? null : parseFloat(editingRateValue);
    updateRateMutation.mutate({ id, rate: rateValue });
  };

  const selectedWorkType = workTypes.find(wt => wt.id === formWorkTypeId);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Rate Card</h1>
            <p className="text-muted-foreground">
              Configure rates for client/location/work type combinations.
            </p>
          </div>
          {isAdmin && (
            <Button onClick={openCreateModal}>
              <Plus className="mr-2 h-4 w-4" />
              Add Rate
            </Button>
          )}
        </div>

        <Card>
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CardHeader className="cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  Rate Configurations
                  <Badge variant="secondary">{filteredConfigs.length}</Badge>
                </CardTitle>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                  </Button>
                </CollapsibleTrigger>
              </div>
              <div className="flex flex-wrap items-center gap-4 pt-2" onClick={(e) => e.stopPropagation()}>
                <Select value={filterClient} onValueChange={(v) => { setFilterClient(v); setFilterLocation('all'); }}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterLocation} onValueChange={setFilterLocation}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterWorkType} onValueChange={setFilterWorkType}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Work Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Work Types</SelectItem>
                    {workTypes.map(wt => (
                      <SelectItem key={wt.id} value={wt.id}>{wt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="needs-review"
                    checked={showNeedsReview}
                    onCheckedChange={(checked) => setShowNeedsReview(!!checked)}
                  />
                  <Label htmlFor="needs-review" className="text-sm font-normal cursor-pointer">
                    Needs review only
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredConfigs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No rate configurations found. Create one to get started.
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Client</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Work Type</TableHead>
                          <TableHead>Frequency</TableHead>
                          <TableHead>Rate</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Active</TableHead>
                          {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredConfigs.map((rc) => (
                          <TableRow key={rc.id}>
                            <TableCell className="font-medium">{rc.client?.name || 'Unknown'}</TableCell>
                            <TableCell>{rc.location?.name || 'Unknown'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {rc.work_type?.name || 'Unknown'}
                              </Badge>
                            </TableCell>
                            <TableCell>{rc.frequency || '—'}</TableCell>
                            <TableCell>
                              {editingRateId === rc.id ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editingRateValue}
                                  onChange={(e) => setEditingRateValue(e.target.value)}
                                  onBlur={() => saveRate(rc.id)}
                                  onKeyDown={(e) => e.key === 'Enter' && saveRate(rc.id)}
                                  className="w-24 h-8"
                                  autoFocus
                                />
                              ) : (
                                <span
                                  className={`cursor-pointer hover:underline ${isFinanceOrHigher ? '' : 'cursor-default'}`}
                                  onClick={() => isFinanceOrHigher && startEditingRate(rc)}
                                >
                                  {rc.rate !== null ? `$${rc.rate.toFixed(2)}` : '—'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {rc.needs_rate_review ? (
                                <Badge variant="destructive">Needs Review</Badge>
                              ) : (
                                <Badge variant="secondary">OK</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={rc.is_active}
                                onCheckedChange={(checked) => 
                                  isAdmin && toggleActiveMutation.mutate({ id: rc.id, is_active: checked })
                                }
                                disabled={!isAdmin || toggleActiveMutation.isPending}
                              />
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteItem(rc)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>

      {/* Add Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Rate Configuration</DialogTitle>
            <DialogDescription>
              Create a new rate for a client/location/work type combination.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client">Client *</Label>
              <Select value={formClientId} onValueChange={(v) => { setFormClientId(v); setFormLocationId(''); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Select value={formLocationId} onValueChange={setFormLocationId} disabled={!formClientId}>
                <SelectTrigger>
                  <SelectValue placeholder={formClientId ? "Select location" : "Select client first"} />
                </SelectTrigger>
                <SelectContent>
                  {formLocations.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="work-type">Work Type *</Label>
              <Select value={formWorkTypeId} onValueChange={setFormWorkTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select work type" />
                </SelectTrigger>
                <SelectContent>
                  {workTypes.map(wt => (
                    <SelectItem key={wt.id} value={wt.id}>
                      {wt.name} ({wt.rate_type === 'per_unit' ? 'Per Unit' : 'Hourly'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedWorkType?.rate_type === 'per_unit' && (
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency</Label>
                <Select value={formFrequency} onValueChange={setFormFrequency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map(f => (
                      <SelectItem key={f.value || 'none'} value={f.value || 'none'}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="rate">Rate ($)</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                min="0"
                value={formRate}
                onChange={(e) => setFormRate(e.target.value)}
                placeholder="Leave blank to flag for review"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rate Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this rate configuration? This cannot be undone.
              If work items are attached, deletion will fail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default RateCard;
