import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { User } from '@/types/database';
import { toast } from '@/hooks/use-toast';

interface CreateLocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const CreateLocationModal = ({
  open,
  onOpenChange,
  onSuccess,
}: CreateLocationModalProps) => {
  const [loading, setLoading] = useState(false);
  const [managers, setManagers] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    manager_user_id: '',
    is_active: true,
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
      } catch (error) {
        console.error('Error fetching managers:', error);
      }
    };

    if (open) {
      fetchManagers();
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate required fields
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

      // Check for duplicate name
      const { data: existing } = await supabase
        .from('locations')
        .select('id')
        .ilike('name', formData.name.trim())
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

      // Create location
      const { error } = await supabase.from('locations').insert([
        {
          name: formData.name.trim(),
          address: formData.address.trim() || null,
          manager_user_id: formData.manager_user_id || null,
          is_active: formData.is_active,
        },
      ]);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Location "${formData.name}" created successfully`,
      });

      // Reset form
      setFormData({
        name: '',
        address: '',
        manager_user_id: '',
        is_active: true,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating location:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create location',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Location</DialogTitle>
            <DialogDescription>
              Create a new wash location. All fields except name are optional.
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
              {managers.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No managers available. Create manager users first.
                </p>
              )}
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
              {loading ? 'Creating...' : 'Create Location'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
