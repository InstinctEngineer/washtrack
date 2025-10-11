import { useState, useEffect } from 'react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Location, User } from '@/types/database';
import { toast } from '@/hooks/use-toast';

interface EditLocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: Location;
  onSuccess: () => void;
}

export const EditLocationModal = ({
  open,
  onOpenChange,
  location,
  onSuccess,
}: EditLocationModalProps) => {
  const [loading, setLoading] = useState(false);
  const [managers, setManagers] = useState<User[]>([]);
  const [oldManagerName, setOldManagerName] = useState<string>('');
  const [newManagerName, setNewManagerName] = useState<string>('');
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: location.name,
    address: location.address || '',
    manager_user_id: location.manager_user_id || '',
    is_active: location.is_active,
  });

  useEffect(() => {
    const fetchManagers = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('role', 'manager')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        setManagers((data || []) as User[]);

        // Get old manager name
        if (location.manager_user_id) {
          const oldManager = data?.find((m) => m.id === location.manager_user_id);
          setOldManagerName(oldManager?.name || 'Unknown');
        }
      } catch (error) {
        console.error('Error fetching managers:', error);
      }
    };

    if (open) {
      setFormData({
        name: location.name,
        address: location.address || '',
        manager_user_id: location.manager_user_id || '',
        is_active: location.is_active,
      });
      fetchManagers();
    }
  }, [open, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if manager changed
    if (formData.manager_user_id !== (location.manager_user_id || '')) {
      const newManager = managers.find((m) => m.id === formData.manager_user_id);
      setNewManagerName(newManager?.name || 'None');
      setConfirmDialog(true);
      return;
    }

    await saveLocation();
  };

  const saveLocation = async () => {
    setLoading(true);

    try {
      // Validate
      if (!formData.name.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Location name is required',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      if (formData.name.length > 100) {
        toast({
          title: 'Validation Error',
          description: 'Location name must be less than 100 characters',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      if (formData.address && formData.address.length > 250) {
        toast({
          title: 'Validation Error',
          description: 'Address must be less than 250 characters',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Check for duplicate name (excluding current location)
      if (formData.name.trim() !== location.name) {
        const { data: existing } = await supabase
          .from('locations')
          .select('id')
          .ilike('name', formData.name.trim())
          .neq('id', location.id)
          .maybeSingle();

        if (existing) {
          toast({
            title: 'Duplicate Location',
            description: 'A location with this name already exists',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
      }

      // Update location
      const { error } = await supabase
        .from('locations')
        .update({
          name: formData.name.trim(),
          address: formData.address.trim() || null,
          manager_user_id: formData.manager_user_id || null,
          is_active: formData.is_active,
        })
        .eq('id', location.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Location "${formData.name}" updated successfully`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating location:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update location',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Location</DialogTitle>
              <DialogDescription>
                Update location information and manager assignment.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Location Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Main Street Depot"
                  maxLength={100}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="123 Main St, City, State ZIP"
                  maxLength={250}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="manager">Assign Manager</Label>
                <Select
                  value={formData.manager_user_id || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, manager_user_id: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a manager (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.name} ({manager.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked === true })
                  }
                />
                <Label htmlFor="active" className="cursor-pointer">
                  Active (employees can log washes at this location)
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDialog} onOpenChange={setConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Manager Change</AlertDialogTitle>
            <AlertDialogDescription>
              Reassign manager from{' '}
              <span className="font-semibold">{oldManagerName || 'None'}</span> to{' '}
              <span className="font-semibold">{newManagerName}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDialog(false);
                saveLocation();
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
