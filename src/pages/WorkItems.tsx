import { useState } from 'react';
import { Link } from 'react-router-dom';
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
import { Textarea } from '@/components/ui/textarea';
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
import { Loader2, Plus, Search, ChevronDown, Pencil, Trash2, Upload, ArrowRight } from 'lucide-react';
import { CSVImportModal } from '@/components/CSVImportModal';

interface WorkItem {
  id: string;
  rate_config_id: string;
  identifier: string;
  is_active: boolean;
  created_at: string;
  rate_config: {
    id: string;
    client_id: string;
    location_id: string;
    work_type_id: string;
    frequency: string | null;
    rate: number | null;
    needs_rate_review: boolean;
    is_active: boolean;
    client: { id: string; name: string } | null;
    location: { id: string; name: string } | null;
    work_type: { id: string; name: string; rate_type: string } | null;
  } | null;
}

interface RateConfigOption {
  id: string;
  client_id: string;
  location_id: string;
  work_type_id: string;
  frequency: string | null;
  rate: number | null;
  client: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  work_type: { id: string; name: string; rate_type: string } | null;
}

const WorkItems = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = hasRoleOrHigher(userRole as UserRole, 'admin' as UserRole);

  const [isOpen, setIsOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<WorkItem | null>(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  // Filters
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterWorkType, setFilterWorkType] = useState<string>('all');

  // Form state
  const [formClientId, setFormClientId] = useState('');
  const [formLocationId, setFormLocationId] = useState('');
  const [formWorkTypeId, setFormWorkTypeId] = useState('');
  const [formFrequency, setFormFrequency] = useState('');
  const [formRateConfigId, setFormRateConfigId] = useState('');
  const [formIdentifier, setFormIdentifier] = useState('');
  const [formBulkMode, setFormBulkMode] = useState(false);
  const [formBulkIdentifiers, setFormBulkIdentifiers] = useState('');

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

  // Fetch all locations for filters
  const { data: allLocations = [] } = useQuery({
    queryKey: ['all-locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, client_id')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Filter locations by selected client
  const filteredLocations = filterClient !== 'all' 
    ? allLocations.filter(l => l.client_id === filterClient)
    : allLocations;

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

  // Fetch all rate configs for selection
  const { data: rateConfigs = [] } = useQuery({
    queryKey: ['rate-configs-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rate_configs')
        .select(`
          id, client_id, location_id, work_type_id, frequency, rate,
          client:clients(id, name),
          location:locations(id, name),
          work_type:work_types(id, name, rate_type)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as RateConfigOption[];
    },
  });

  // Fetch work items
  const { data: workItems = [], isLoading } = useQuery({
    queryKey: ['work-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_items')
        .select(`
          *,
          rate_config:rate_configs(
            id, client_id, location_id, work_type_id, frequency, rate, needs_rate_review, is_active,
            client:clients(id, name),
            location:locations(id, name),
            work_type:work_types(id, name, rate_type)
          )
        `)
        .order('identifier');
      if (error) throw error;
      return data as WorkItem[];
    },
  });

  // Filter work items
  const filteredItems = workItems.filter(item => {
    const rc = item.rate_config;
    if (!rc) return false;
    if (filterClient !== 'all' && rc.client_id !== filterClient) return false;
    if (filterLocation !== 'all' && rc.location_id !== filterLocation) return false;
    if (filterWorkType !== 'all' && rc.work_type_id !== filterWorkType) return false;
    if (search && !item.identifier.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Get available rate configs based on form selections
  const availableRateConfigs = rateConfigs.filter(rc => {
    if (formClientId && rc.client_id !== formClientId) return false;
    if (formLocationId && rc.location_id !== formLocationId) return false;
    if (formWorkTypeId && rc.work_type_id !== formWorkTypeId) return false;
    return true;
  });

  // Get unique form locations based on selected client
  const formLocations = formClientId
    ? allLocations.filter(l => l.client_id === formClientId)
    : [];

  // Get unique work types from available rate configs
  const availableWorkTypes = formLocationId
    ? [...new Set(rateConfigs.filter(rc => rc.location_id === formLocationId).map(rc => rc.work_type_id))]
    : [];

  // Get frequencies for selected work type
  const availableFrequencies = formWorkTypeId && formLocationId
    ? rateConfigs
        .filter(rc => rc.location_id === formLocationId && rc.work_type_id === formWorkTypeId)
        .map(rc => rc.frequency)
    : [];

  // Find selected rate config
  const selectedRateConfig = rateConfigs.find(rc => {
    if (formRateConfigId) return rc.id === formRateConfigId;
    if (formLocationId && formWorkTypeId) {
      return rc.location_id === formLocationId && 
             rc.work_type_id === formWorkTypeId &&
             rc.frequency === (formFrequency || null);
    }
    return false;
  });

  // Check if no rate configs exist
  const noRateConfigs = rateConfigs.length === 0;

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRateConfig) throw new Error('Please select a rate configuration');
      
      const identifiers = formBulkMode
        ? formBulkIdentifiers.split('\n').map(s => s.trim()).filter(s => s.length > 0)
        : [formIdentifier.trim()];
      
      if (identifiers.length === 0) throw new Error('At least one identifier is required');

      const { error } = await supabase
        .from('work_items')
        .insert(identifiers.map(id => ({
          rate_config_id: selectedRateConfig.id,
          identifier: id,
        })));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      toast({ title: formBulkMode ? 'Work items created successfully' : 'Work item created successfully' });
      closeModal();
    },
    onError: (error) => {
      toast({
        title: 'Error creating work item',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingItem) return;
      const { error } = await supabase
        .from('work_items')
        .update({ identifier: formIdentifier.trim() })
        .eq('id', editingItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      toast({ title: 'Work item updated successfully' });
      closeModal();
    },
    onError: (error) => {
      toast({
        title: 'Error updating work item',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('work_items')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
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
        .from('work_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      toast({ title: 'Work item deleted successfully' });
      setDeleteItem(null);
    },
    onError: (error) => {
      toast({
        title: 'Error deleting work item',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const openCreateModal = () => {
    setEditingItem(null);
    setFormClientId('');
    setFormLocationId('');
    setFormWorkTypeId('');
    setFormFrequency('');
    setFormRateConfigId('');
    setFormIdentifier('');
    setFormBulkMode(false);
    setFormBulkIdentifiers('');
    setModalOpen(true);
  };

  const openEditModal = (item: WorkItem) => {
    setEditingItem(item);
    setFormIdentifier(item.identifier);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingItem(null);
    setFormClientId('');
    setFormLocationId('');
    setFormWorkTypeId('');
    setFormFrequency('');
    setFormRateConfigId('');
    setFormIdentifier('');
    setFormBulkMode(false);
    setFormBulkIdentifiers('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      if (!formIdentifier.trim()) {
        toast({ title: 'Identifier is required', variant: 'destructive' });
        return;
      }
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Work Items</h1>
            <p className="text-muted-foreground">
              Manage individual assets like trucks, equipment, or service units.
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCsvModalOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </Button>
              <Button onClick={openCreateModal}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>
          )}
        </div>

        <Card>
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CardHeader className="cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  Work Items
                  <Badge variant="secondary">{filteredItems.length}</Badge>
                </CardTitle>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                  </Button>
                </CollapsibleTrigger>
              </div>
              <div className="flex flex-wrap items-center gap-4 pt-2" onClick={(e) => e.stopPropagation()}>
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search identifiers..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
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
                    {filteredLocations.map(l => (
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
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : noRateConfigs ? (
                  <div className="text-center py-12 space-y-4">
                    <p className="text-muted-foreground">
                      No rate configurations found. Create rates in the Rate Card first.
                    </p>
                    <Button asChild variant="outline">
                      <Link to="/admin/rates">
                        Go to Rate Card
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {search || filterClient !== 'all' || filterLocation !== 'all' || filterWorkType !== 'all'
                      ? 'No work items match your filters'
                      : 'No work items found. Create one to get started.'}
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Identifier</TableHead>
                          <TableHead>Work Type</TableHead>
                          <TableHead>Frequency</TableHead>
                          <TableHead>Rate</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Active</TableHead>
                          {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredItems.map((item) => {
                          const rc = item.rate_config;
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.identifier}</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {rc?.work_type?.name || 'Unknown'}
                                </Badge>
                              </TableCell>
                              <TableCell>{rc?.frequency || '—'}</TableCell>
                              <TableCell>
                                {rc?.rate !== null ? `$${rc.rate.toFixed(2)}` : (
                                  <Badge variant="destructive">Needs Review</Badge>
                                )}
                              </TableCell>
                              <TableCell>{rc?.client?.name || 'Unknown'}</TableCell>
                              <TableCell>{rc?.location?.name || 'Unknown'}</TableCell>
                              <TableCell>
                                <Switch
                                  checked={item.is_active}
                                  onCheckedChange={(checked) => 
                                    isAdmin && toggleActiveMutation.mutate({ id: item.id, is_active: checked })
                                  }
                                  disabled={!isAdmin || toggleActiveMutation.isPending}
                                />
                              </TableCell>
                              {isAdmin && (
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => openEditModal(item)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setDeleteItem(item)}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Work Item' : 'Add Work Item'}</DialogTitle>
            <DialogDescription>
              {editingItem 
                ? 'Update the work item identifier.'
                : 'Select a rate configuration and add one or more identifiers.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {editingItem ? (
              <>
                <div className="space-y-2">
                  <Label>Rate Configuration</Label>
                  <p className="text-sm text-muted-foreground">
                    {editingItem.rate_config?.client?.name} → {editingItem.rate_config?.location?.name} → {editingItem.rate_config?.work_type?.name}
                    {editingItem.rate_config?.frequency && ` (${editingItem.rate_config.frequency})`}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="identifier">Identifier *</Label>
                  <Input
                    id="identifier"
                    value={formIdentifier}
                    onChange={(e) => setFormIdentifier(e.target.value)}
                    placeholder="e.g., T-101, License Plate, Asset Tag"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Select value={formClientId} onValueChange={(v) => { setFormClientId(v); setFormLocationId(''); setFormWorkTypeId(''); setFormFrequency(''); }}>
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
                  <Label>Location *</Label>
                  <Select 
                    value={formLocationId} 
                    onValueChange={(v) => { setFormLocationId(v); setFormWorkTypeId(''); setFormFrequency(''); }}
                    disabled={!formClientId}
                  >
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
                  <Label>Work Type *</Label>
                  <Select 
                    value={formWorkTypeId} 
                    onValueChange={(v) => { setFormWorkTypeId(v); setFormFrequency(''); }}
                    disabled={!formLocationId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formLocationId ? "Select work type" : "Select location first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {workTypes
                        .filter(wt => availableWorkTypes.includes(wt.id))
                        .map(wt => (
                          <SelectItem key={wt.id} value={wt.id}>{wt.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {formLocationId && availableWorkTypes.length === 0 && (
                    <p className="text-sm text-destructive">
                      No rate configurations exist for this location.{' '}
                      <Link to="/admin/rates" className="underline">Create one first</Link>.
                    </p>
                  )}
                </div>
                {formWorkTypeId && availableFrequencies.length > 1 && (
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select value={formFrequency} onValueChange={setFormFrequency}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFrequencies.map((f, i) => (
                          <SelectItem key={f || 'none' + i} value={f || 'none'}>
                            {f || 'None'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {selectedRateConfig && (
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm font-medium">Selected Rate Configuration</p>
                    <p className="text-sm text-muted-foreground">
                      Rate: {selectedRateConfig.rate !== null ? `$${selectedRateConfig.rate.toFixed(2)}` : 'Needs Review'}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Switch
                    id="bulk-mode"
                    checked={formBulkMode}
                    onCheckedChange={setFormBulkMode}
                  />
                  <Label htmlFor="bulk-mode" className="font-normal">Bulk add (multiple identifiers)</Label>
                </div>
                {formBulkMode ? (
                  <div className="space-y-2">
                    <Label htmlFor="bulk-identifiers">Identifiers (one per line) *</Label>
                    <Textarea
                      id="bulk-identifiers"
                      value={formBulkIdentifiers}
                      onChange={(e) => setFormBulkIdentifiers(e.target.value)}
                      placeholder="T-101&#10;T-102&#10;T-103"
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      {formBulkIdentifiers.split('\n').filter(s => s.trim()).length} identifier(s)
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="identifier">Identifier *</Label>
                    <Input
                      id="identifier"
                      value={formIdentifier}
                      onChange={(e) => setFormIdentifier(e.target.value)}
                      placeholder="e.g., T-101, License Plate, Asset Tag"
                    />
                  </div>
                )}
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingItem ? 'Save Changes' : formBulkMode ? 'Create Items' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Work Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteItem?.identifier}"? This cannot be undone.
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

      {/* CSV Import Modal */}
      <CSVImportModal
        open={csvModalOpen}
        onOpenChange={setCsvModalOpen}
      />
    </Layout>
  );
};

export default WorkItems;
