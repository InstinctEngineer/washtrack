import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User, Location, UserRole } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";

interface EditUserModalProps {
  user: User;
  userRole: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const EditUserModal = ({
  user,
  userRole,
  open,
  onOpenChange,
  onSuccess,
}: EditUserModalProps) => {
  const { toast } = useToast();
  const { user: currentUser, userRole: currentUserRole } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRoleConfirm, setShowRoleConfirm] = useState(false);
  const [showLocationConfirm, setShowLocationConfirm] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    location_id: user.location_id || "",
    role: userRole as UserRole,
    manager_id: user.manager_id || "",
    is_active: user.is_active,
  });

  const isEditingSelf = currentUser?.id === user.id;
  const isEditingSuperAdmin = userRole === 'super_admin';
  const canEditSuperAdmin = currentUserRole === 'super_admin';

  // Fetch locations
  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as Location[];
    },
  });

  // Fetch potential managers
  const { data: managers } = useQuery({
    queryKey: ["managers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .in("role", ["manager", "admin"])
        .eq("is_active", true)
        .neq("id", user.id); // Cannot select self as manager

      if (error) throw error;
      return data as User[];
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent non-super-admins from editing super-admin users
    if (isEditingSuperAdmin && !canEditSuperAdmin) {
      toast({
        title: "Permission Denied",
        description: "Only Super Admins can edit Super Admin accounts.",
        variant: "destructive",
      });
      return;
    }

    // Check for role change
    if (formData.role !== userRole) {
      if (isEditingSelf && (formData.role !== "admin" && formData.role !== "super_admin")) {
        toast({
          title: "Cannot change own role",
          description: "You cannot demote yourself from your current role.",
          variant: "destructive",
        });
        return;
      }
      setPendingChanges(formData);
      setShowRoleConfirm(true);
      return;
    }

    // Check for location change on own account
    if (isEditingSelf && formData.location_id !== user.location_id) {
      setPendingChanges(formData);
      setShowLocationConfirm(true);
      return;
    }

    await performUpdate(formData);
  };

  const performUpdate = async (data: typeof formData) => {
    setIsSubmitting(true);

    try {
      // Validate
      if (!data.name || !data.email || !data.location_id) {
        toast({
          title: "Validation Error",
          description: "Name, email, and location are required.",
          variant: "destructive",
        });
        return;
      }

      if (
        (data.role === "employee" || data.role === "manager") &&
        !data.manager_id
      ) {
        toast({
          title: "Validation Error",
          description: "Manager is required for employees and managers.",
          variant: "destructive",
        });
        return;
      }

      // Update users table
      const { error: userError } = await supabase
        .from("users")
        .update({
          name: data.name,
          email: data.email,
          location_id: data.location_id || null,
          manager_id:
            data.role === "finance" || data.role === "admin"
              ? null
              : data.manager_id || null,
          is_active: data.is_active,
          role: data.role, // Keep in sync for backward compatibility
        })
        .eq("id", user.id);

      if (userError) throw userError;

      // Update user_roles table if role changed
      if (data.role !== userRole) {
        // Delete old role
        const { error: deleteError } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", user.id);

        if (deleteError) throw deleteError;

        // Insert new role
        const { error: insertError } = await supabase
          .from("user_roles")
          .insert({ user_id: user.id, role: data.role });

        if (insertError) throw insertError;
      }

      toast({
        title: "Success",
        description: "User updated successfully",
      });

      if (data.location_id !== user.location_id) {
        const location = locations?.find((l) => l.id === data.location_id);
        toast({
          title: "Location Changed",
          description: `User's wash entries will now be associated with ${location?.name}`,
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setShowRoleConfirm(false);
      setShowLocationConfirm(false);
      setPendingChanges(null);
    }
  };

  const handleConfirmRole = () => {
    performUpdate(pendingChanges);
  };

  const handleConfirmLocation = () => {
    performUpdate(pendingChanges);
  };

  const oldLocation = locations?.find((l) => l.id === user.location_id);
  const newLocation = locations?.find((l) => l.id === pendingChanges?.location_id);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            {isEditingSelf && (
              <p className="text-sm text-yellow-600">
                ⚠️ You are editing your own account
              </p>
            )}
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employee_id">Employee ID</Label>
              <Input
                id="employee_id"
                value={user.employee_id}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Employee ID cannot be changed after creation
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                maxLength={100}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              {!locations || locations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No locations available. Create locations first.
                </p>
              ) : (
                <Select
                  value={formData.location_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, location_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value as UserRole })
                }
                disabled={isEditingSelf || (isEditingSuperAdmin && !canEditSuperAdmin)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  {currentUserRole === 'super_admin' && (
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {isEditingSelf && (
                <p className="text-xs text-muted-foreground">
                  You cannot change your own role
                </p>
              )}
              {isEditingSuperAdmin && !canEditSuperAdmin && (
                <p className="text-xs text-destructive">
                  Only Super Admins can edit Super Admin accounts
                </p>
              )}
            </div>

            {(formData.role === "employee" || formData.role === "manager") && (
              <div className="space-y-2">
                <Label htmlFor="manager">Manager *</Label>
                {!managers || managers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No managers available. Create a manager first.
                  </p>
                ) : (
                  <Select
                    value={formData.manager_id}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        manager_id: value === "none" ? "" : value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No manager assigned</SelectItem>
                      {managers.map((manager) => (
                        <SelectItem key={manager.id} value={manager.id}>
                          {manager.name} ({manager.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label htmlFor="is_active">
                Active Status: {formData.is_active ? "Active" : "Inactive"}
              </Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showRoleConfirm} onOpenChange={setShowRoleConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Role Change</AlertDialogTitle>
            <AlertDialogDescription>
              Change role from <strong>{userRole}</strong> to{" "}
              <strong>{pendingChanges?.role}</strong>? This affects user
              permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRole}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showLocationConfirm}
        onOpenChange={setShowLocationConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Location Change</AlertDialogTitle>
            <AlertDialogDescription>
              You are changing your own location from{" "}
              <strong>{oldLocation?.name}</strong> to{" "}
              <strong>{newLocation?.name}</strong>. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLocation}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
