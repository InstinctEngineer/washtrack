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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Search, ChevronDown, Pencil, Trash2 } from 'lucide-react';

interface WorkType {
  id: string;
  name: string;
  rate_type: string;
  is_active: boolean;
  created_at: string;
}

const WorkTypes = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManageWorkTypes = hasRoleOrHigher(userRole as UserRole, 'finance' as UserRole);

  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkType | null>(null);
  const [deleteItem, setDeleteItem] = useState<WorkType | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formRateType, setFormRateType] = useState<'per_unit' | 'hourly'>('per_unit');

  // Fetch work types
  const { data: workTypes = [], isLoading } = useQuery({
    queryKey: ['work-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_types')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as WorkType[];
    },
  });

  // Filter by search
  const filteredWorkTypes = workTypes.filter(wt =>
    wt.name.toLowerCase().includes(search.toLowerCase())
  );

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('work_types')
        .insert({
          name: formName.trim(),
          rate_type: formRateType,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-types'] });
      toast({ title: 'Work type created successfully' });
      closeModal();
    },
    onError: (error) => {
      toast({
        title: 'Error creating work type',
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
        .from('work_types')
        .update({
          name: formName.trim(),
          rate_type: formRateType,
        })
        .eq('id', editingItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-types'] });
      toast({ title: 'Work type updated successfully' });
      closeModal();
    },
    onError: (error) => {
      toast({
        title: 'Error updating work type',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('work_types')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-types'] });
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
        .from('work_types')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-types'] });
      toast({ title: 'Work type deleted successfully' });
      setDeleteItem(null);
    },
    onError: (error) => {
      toast({
        title: 'Error deleting work type',
        description: error.message.includes('violates foreign key')
          ? 'Cannot delete: This work type is used in rate configurations'
          : error.message,
        variant: 'destructive',
      });
    },
  });

  const openCreateModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormRateType('per_unit');
    setModalOpen(true);
  };

  const openEditModal = (item: WorkType) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormRateType(item.rate_type as 'per_unit' | 'hourly');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingItem(null);
    setFormName('');
    setFormRateType('per_unit');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast({
        title: 'Name is required',
        variant: 'destructive',
      });
      return;
    }
    if (editingItem) {
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
            <h1 className="text-3xl font-bold tracking-tight">Work Types</h1>
            <p className="text-muted-foreground">
              Manage predefined work types like Box Truck, Sprinter, Pressure Washing, etc.
            </p>
          </div>
          {canManageWorkTypes && (
            <Button onClick={openCreateModal}>
              <Plus className="mr-2 h-4 w-4" />
              Add Work Type
            </Button>
          )}
        </div>

        <Card>
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CardHeader className="cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  Work Types
                  <Badge variant="secondary">{filteredWorkTypes.length}</Badge>
                </CardTitle>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                  </Button>
                </CollapsibleTrigger>
              </div>
              <div className="flex items-center gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search work types..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredWorkTypes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {search ? 'No work types match your search' : 'No work types found. Create one to get started.'}
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Rate Type</TableHead>
                          <TableHead>Active</TableHead>
                          {canManageWorkTypes && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredWorkTypes.map((wt) => (
                          <TableRow key={wt.id}>
                            <TableCell className="font-medium">{wt.name}</TableCell>
                            <TableCell>
                              <Badge variant={wt.rate_type === 'per_unit' ? 'default' : 'secondary'}>
                                {wt.rate_type === 'per_unit' ? 'Per Unit' : 'Hourly'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={wt.is_active}
                                onCheckedChange={(checked) => 
                                  canManageWorkTypes && toggleActiveMutation.mutate({ id: wt.id, is_active: checked })
                                }
                                disabled={!canManageWorkTypes || toggleActiveMutation.isPending}
                              />
                            </TableCell>
                            {canManageWorkTypes && (
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditModal(wt)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeleteItem(wt)}
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
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Work Type' : 'Add Work Type'}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Update the work type details.' : 'Create a new work type.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Box Truck, Sprinter, Pressure Washing"
              />
            </div>
            <div className="space-y-2">
              <Label>Rate Type *</Label>
              <RadioGroup
                value={formRateType}
                onValueChange={(value) => setFormRateType(value as 'per_unit' | 'hourly')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="per_unit" id="per_unit" />
                  <Label htmlFor="per_unit" className="font-normal">Per Unit</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hourly" id="hourly" />
                  <Label htmlFor="hourly" className="font-normal">Hourly</Label>
                </div>
              </RadioGroup>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingItem ? 'Save Changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Work Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteItem?.name}"? This cannot be undone.
              If this work type is used in rate configurations, deletion will fail.
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

export default WorkTypes;
