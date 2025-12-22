import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User, Location, UserRole, UserLocation } from "@/types/database";
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
    employee_id: user.employee_id,
    locations: [] as { location_id: string; is_primary: boolean }[],
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
        .order("location_code");

      if (error) throw error;
      return data as Location[];
    },
  });

  // Fetch user's current locations
  const { data: userLocations } = useQuery({
    queryKey: ["user-locations", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_locations")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      return data as UserLocation[];
    },
  });

  // Update form data when user locations are loaded
  useEffect(() => {
    if (userLocations && userLocations.length > 0) {
      setFormData(prev => ({
        ...prev,
        locations: userLocations.map(ul => ({
          location_id: ul.location_id,
          is_primary: ul.is_primary,
        })),
      }));
    }
  }, [userLocations]);

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
    const originalLocationIds = userLocations?.map(ul => ul.location_id).sort() || [];
    const newLocationIds = formData.locations.map(l => l.location_id).sort();
    const locationsChanged = JSON.stringify(originalLocationIds) !== JSON.stringify(newLocationIds);
    
    if (isEditingSelf && locationsChanged) {
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
      if (!data.name || !data.email || data.locations.length === 0) {
        toast({
          title: "Validation Error",
          description: "Name, email, and at least one location are required.",
          variant: "destructive",
        });
        return;
      }

      // Ensure at least one location is marked as primary
      if (!data.locations.some(loc => loc.is_primary)) {
        toast({
          title: "Validation Error",
          description: "Please mark one location as primary.",
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

      // Update users table (keep primary location for backward compatibility)
      const primaryLocation = data.locations.find(loc => loc.is_primary);
      const updateData: any = {
        name: data.name,
        email: data.email,
        location_id: primaryLocation?.location_id || null,
        manager_id:
          data.role === "finance" || data.role === "admin" || data.role === "super_admin"
            ? null
            : data.manager_id || null,
        is_active: data.is_active,
        role: data.role, // Keep in sync for backward compatibility
      };

      // Only allow super_admin to update employee_id
      if (currentUserRole === 'super_admin' && data.employee_id !== user.employee_id) {
        updateData.employee_id = data.employee_id;
      }

      const { error: userError } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", user.id);

      if (userError) throw userError;

      // Delete existing location assignments
      const { error: deleteLocationError } = await supabase
        .from("user_locations")
        .delete()
        .eq("user_id", user.id);

      if (deleteLocationError) throw deleteLocationError;

      // Insert new location assignments
      const { error: insertLocationError } = await supabase
        .from("user_locations")
        .insert(
          data.locations.map(loc => ({
            user_id: user.id,
            location_id: loc.location_id,
            is_primary: loc.is_primary,
          }))
        );

      if (insertLocationError) throw insertLocationError;

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

  const oldLocations = userLocations?.map(ul => 
    locations?.find(l => l.id === ul.location_id)?.name
  ).filter(Boolean).join(", ") || "None";
  const newLocations = pendingChanges?.locations.map((loc: any) => 
    locations?.find(l => l.id === loc.location_id)?.name
  ).filter(Boolean).join(", ") || "None";

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
                value={formData.employee_id}
                onChange={(e) =>
                  setFormData({ ...formData, employee_id: e.target.value })
                }
                disabled={currentUserRole !== 'super_admin'}
                className={currentUserRole !== 'super_admin' ? "bg-muted" : ""}
              />
              <p className="text-xs text-muted-foreground">
                {currentUserRole === 'super_admin' 
                  ? "Only Super Admins can edit Employee ID"
                  : "Employee ID cannot be changed (Super Admin only)"}
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
              <Label>Locations * (select at least one as primary)</Label>
              {!locations || locations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No locations available. Create locations first.
                </p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  {/* Select All checkbox */}
                  <div className="flex items-center gap-3 p-3 bg-muted/50 border-b">
                    <input
                      type="checkbox"
                      id="select-all-locations"
                      checked={locations.length > 0 && formData.locations.length === locations.length}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate = formData.locations.length > 0 && formData.locations.length < locations.length;
                        }
                      }}
                      onChange={(e) => {
                        if (e.target.checked) {
                          // Select all locations, keep existing primary or set first as primary
                          const currentPrimary = formData.locations.find(l => l.is_primary);
                          setFormData({
                            ...formData,
                            locations: locations.map((loc, index) => ({
                              location_id: loc.id,
                              is_primary: currentPrimary 
                                ? loc.id === currentPrimary.location_id 
                                : index === 0,
                            })),
                          });
                        } else {
                          // Deselect all locations
                          setFormData({
                            ...formData,
                            locations: [],
                          });
                        }
                      }}
                      className="h-4 w-4"
                    />
                    <Label
                      htmlFor="select-all-locations"
                      className="flex-1 cursor-pointer font-medium"
                    >
                      Select All ({formData.locations.length}/{locations.length})
                    </Label>
                  </div>
                  
                  {/* Location list */}
                  <div className="p-4 space-y-2 max-h-52 overflow-y-auto">
                    {locations.map((location) => {
                      const isSelected = formData.locations.some(
                        (l) => l.location_id === location.id
                      );
                      const isPrimary = formData.locations.find(
                        (l) => l.location_id === location.id
                      )?.is_primary;

                      return (
                        <div key={location.id} className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id={`location-${location.id}`}
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  locations: [
                                    ...formData.locations,
                                    { location_id: location.id, is_primary: false },
                                  ],
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  locations: formData.locations.filter(
                                    (l) => l.location_id !== location.id
                                  ),
                                });
                              }
                            }}
                            className="h-4 w-4"
                          />
                          <Label
                            htmlFor={`location-${location.id}`}
                            className="flex-1 cursor-pointer"
                          >
                            {location.location_code ? `${location.location_code} - ${location.name}` : location.name}
                          </Label>
                          {isSelected && (
                            <Button
                              type="button"
                              size="sm"
                              variant={isPrimary ? "default" : "outline"}
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  locations: formData.locations.map((l) => ({
                                    ...l,
                                    is_primary: l.location_id === location.id,
                                  })),
                                });
                              }}
                            >
                              {isPrimary ? "Primary" : "Set as Primary"}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
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
              You are changing your own locations from{" "}
              <strong>{oldLocations}</strong> to{" "}
              <strong>{newLocations}</strong>. Are you sure?
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
