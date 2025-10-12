import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Location, UserRole } from "@/types/database";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Copy } from "lucide-react";

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const CreateUserModal = ({
  open,
  onOpenChange,
  onSuccess,
}: CreateUserModalProps) => {
  const { toast } = useToast();
  const { userRole } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [generatedEmail, setGeneratedEmail] = useState("");

  const [formData, setFormData] = useState({
    employee_id: "",
    name: "",
    email: "",
    location_id: "",
    role: "employee" as UserRole,
    manager_id: "",
  });

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
        .eq("is_active", true);

      if (error) throw error;
      return data;
    },
  });

  const generatePassword = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate
      if (
        !formData.employee_id ||
        !formData.name ||
        !formData.email ||
        !formData.location_id
      ) {
        toast({
          title: "Validation Error",
          description: "All required fields must be filled.",
          variant: "destructive",
        });
        return;
      }

      if (
        (formData.role === "employee" || formData.role === "manager") &&
        !formData.manager_id
      ) {
        toast({
          title: "Validation Error",
          description: "Manager is required for employees and managers.",
          variant: "destructive",
        });
        return;
      }

      // Validate employee ID format (alphanumeric only)
      if (!/^[a-zA-Z0-9]+$/.test(formData.employee_id)) {
        toast({
          title: "Validation Error",
          description: "Employee ID must be alphanumeric only.",
          variant: "destructive",
        });
        return;
      }

      // Check for duplicate employee ID
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("employee_id", formData.employee_id)
        .single();

      if (existingUser) {
        toast({
          title: "Duplicate Employee ID",
          description: "This employee ID is already in use.",
          variant: "destructive",
        });
        return;
      }

      // Check for duplicate email
      const { data: existingEmail } = await supabase
        .from("users")
        .select("id")
        .eq("email", formData.email)
        .single();

      if (existingEmail) {
        toast({
          title: "Email Already In Use",
          description: "This email is already registered.",
          variant: "destructive",
        });
        return;
      }

      const tempPassword = generatePassword();

      // Get current session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("You must be logged in to create users");
      }

      // Call edge function to create user with admin privileges
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            employee_id: formData.employee_id,
            name: formData.name,
            email: formData.email,
            location_id: formData.location_id || null,
            role: formData.role,
            manager_id: formData.role === "finance" || formData.role === "admin" || formData.role === "super_admin"
              ? null
              : formData.manager_id || null,
            password: tempPassword
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create user");
      }

      setGeneratedPassword(tempPassword);
      setGeneratedEmail(formData.email);
      setShowPasswordDialog(true);

      // Reset form
      setFormData({
        employee_id: "",
        name: "",
        email: "",
        location_id: "",
        role: "employee",
        manager_id: "",
      });

      onSuccess();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(generatedPassword);
    toast({
      title: "Copied",
      description: "Password copied to clipboard",
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employee_id">Employee ID *</Label>
              <Input
                id="employee_id"
                value={formData.employee_id}
                onChange={(e) =>
                  setFormData({ ...formData, employee_id: e.target.value })
                }
                placeholder="e.g., EMP001"
                required
              />
              <p className="text-xs text-muted-foreground">
                Alphanumeric only, must be unique
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
                <p className="text-sm text-destructive">
                  Please create locations first
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
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  {userRole === 'super_admin' && (
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {(formData.role === "employee" || formData.role === "manager") && (
              <div className="space-y-2">
                <Label htmlFor="manager">Manager *</Label>
                {!managers || managers.length === 0 ? (
                  <p className="text-sm text-destructive">
                    No managers available. Create a manager first.
                  </p>
                ) : (
                  <Select
                    value={formData.manager_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, manager_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager..." />
                    </SelectTrigger>
                    <SelectContent>
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

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create User"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>User Created Successfully</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                User <strong>{generatedEmail}</strong> has been created.
              </p>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-semibold mb-2">Temporary Password:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background p-2 rounded border">
                    {generatedPassword}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyPassword}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                ⚠️ User must change password on first login. Make sure to save
                this password - it won't be shown again.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowPasswordDialog(false)}>
              Done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
