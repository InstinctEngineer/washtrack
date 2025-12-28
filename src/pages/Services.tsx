import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Plus, Pencil, Trash2, Loader2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AddServiceModal } from '@/components/AddServiceModal';
import { EditServiceModal } from '@/components/EditServiceModal';
import { CSVImportModal } from '@/components/CSVImportModal';

interface WorkItemWithJoins {
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

const Services = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [showNeedsReviewOnly, setShowNeedsReviewOnly] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkItemWithJoins | null>(null);
  const [deleteItem, setDeleteItem] = useState<WorkItemWithJoins | null>(null);
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [editingRateValue, setEditingRateValue] = useState<string>('');

  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

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

  // Fetch locations filtered by client
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', selectedClientId],
    queryFn: async () => {
      let query = supabase
        .from('locations')
        .select('id, name, client_id')
        .eq('is_active', true)
        .order('name');
      
      if (selectedClientId !== 'all') {
        query = query.eq('client_id', selectedClientId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch work items with joins through rate_configs
  const { data: workItems = [], isLoading } = useQuery({
    queryKey: ['work-items', selectedClientId, selectedLocationId, showNeedsReviewOnly],
    queryFn: async () => {
      let query = supabase
        .from('work_items')
        .select(`
          *,
          rate_config:rate_configs(
            id,
            client_id,
            location_id,
            work_type_id,
            frequency,
            rate,
            needs_rate_review,
            is_active,
            client:clients(id, name),
            location:locations(id, name),
            work_type:work_types(id, name, rate_type)
          )
        `)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      
      // Filter in JS for nested fields
      let filtered = (data as WorkItemWithJoins[]) || [];
      
      if (selectedClientId !== 'all') {
        filtered = filtered.filter(item => item.rate_config?.client_id === selectedClientId);
      }
      if (selectedLocationId !== 'all') {
        filtered = filtered.filter(item => item.rate_config?.location_id === selectedLocationId);
      }
      if (showNeedsReviewOnly) {
        filtered = filtered.filter(item => 
          item.rate_config?.rate === null || item.rate_config?.needs_rate_review
        );
      }
      
      return filtered;
    },
  });

  // Update rate mutation (updates rate_config)
  const updateRateMutation = useMutation({
    mutationFn: async ({ rateConfigId, rate }: { rateConfigId: string; rate: number | null }) => {
      const { error } = await supabase
        .from('rate_configs')
        .update({ 
          rate, 
          needs_rate_review: rate === null 
        })
        .eq('id', rateConfigId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      toast({ title: 'Rate updated successfully' });
      setEditingRateId(null);
    },
    onError: (error) => {
      toast({ title: 'Error updating rate', description: error.message, variant: 'destructive' });
    },
  });

  // Toggle active mutation (on work_item)
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('work_items')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      toast({ title: 'Service status updated' });
    },
    onError: (error) => {
      toast({ title: 'Error updating status', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Service deleted successfully' });
      setDeleteItem(null);
    },
    onError: (error) => {
      toast({ title: 'Error deleting service', description: error.message, variant: 'destructive' });
    },
  });

  const handleRateEdit = (item: WorkItemWithJoins) => {
    setEditingRateId(item.rate_config?.id || null);
    setEditingRateValue(item.rate_config?.rate?.toString() || '');
  };

  const handleRateSave = (rateConfigId: string) => {
    const rate = editingRateValue.trim() === '' ? null : parseFloat(editingRateValue);
    updateRateMutation.mutate({ rateConfigId, rate });
  };

  const handleClientChange = (value: string) => {
    setSelectedClientId(value);
    setSelectedLocationId('all');
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Services & Rates</h1>
            <p className="text-muted-foreground">
              Manage work items, work types, and pricing
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImportModalOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </Button>
              <Button onClick={() => setAddModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Service
              </Button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center p-4 bg-card rounded-lg border">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-muted-foreground">Client</label>
            <Select value={selectedClientId} onValueChange={handleClientChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-muted-foreground">Location</label>
            <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 pt-6">
            <Checkbox
              id="needs-review"
              checked={showNeedsReviewOnly}
              onCheckedChange={(checked) => setShowNeedsReviewOnly(!!checked)}
            />
            <label htmlFor="needs-review" className="text-sm cursor-pointer">
              Show needs review only
            </label>
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : workItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <p>No services found</p>
              {isAdmin && (
                <Button variant="link" onClick={() => setAddModalOpen(true)}>
                  Add your first service
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Identifier</TableHead>
                  <TableHead>Work Type</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Rate Type</TableHead>
                  <TableHead>Active</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {workItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.rate_config?.client?.name || '—'}
                    </TableCell>
                    <TableCell>{item.rate_config?.location?.name || '—'}</TableCell>
                    <TableCell>{item.identifier || '—'}</TableCell>
                    <TableCell>{item.rate_config?.work_type?.name || '—'}</TableCell>
                    <TableCell>{item.rate_config?.frequency || '—'}</TableCell>
                    <TableCell>
                      {editingRateId === item.rate_config?.id && isAdmin ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editingRateValue}
                          onChange={(e) => setEditingRateValue(e.target.value)}
                          onBlur={() => item.rate_config && handleRateSave(item.rate_config.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && item.rate_config) handleRateSave(item.rate_config.id);
                            if (e.key === 'Escape') setEditingRateId(null);
                          }}
                          className="w-24 h-8"
                          autoFocus
                        />
                      ) : item.rate_config?.rate !== null && item.rate_config?.rate !== undefined ? (
                        <span
                          className={isAdmin ? 'cursor-pointer hover:underline' : ''}
                          onClick={() => isAdmin && handleRateEdit(item)}
                        >
                          ${item.rate_config.rate.toFixed(2)}
                        </span>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-amber-50 text-amber-700 border-amber-200 cursor-pointer"
                          onClick={() => isAdmin && handleRateEdit(item)}
                        >
                          Needs Review
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {item.rate_config?.work_type?.rate_type === 'per_unit' ? 'Per Unit' : 'Hourly'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={item.is_active}
                        onCheckedChange={(checked) => 
                          isAdmin && toggleActiveMutation.mutate({ id: item.id, isActive: checked })
                        }
                        disabled={!isAdmin}
                      />
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingItem(item)}
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
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* CSV Import Modal */}
      <CSVImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
      />

      {/* Add Service Modal */}
      <AddServiceModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        clients={clients}
      />

      {/* Edit Service Modal */}
      {editingItem && (
        <EditServiceModal
          open={!!editingItem}
          onOpenChange={(open) => !open && setEditingItem(null)}
          item={editingItem}
          clients={clients}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this service? This action cannot be undone.
              {deleteItem && (
                <span className="block mt-2 font-medium">
                  {deleteItem.rate_config?.work_type?.name || 'Unknown'} - {deleteItem.identifier || 'No identifier'}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default Services;
