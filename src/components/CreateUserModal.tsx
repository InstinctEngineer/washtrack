import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Location, UserRole } from "@/types/database";
import { getAssignableRoles } from "@/lib/roleUtils";
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
import { Check, AlertTriangle, Loader2, Send } from "lucide-react";

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialData?: {
    name?: string;
    email?: string;
    locations?: { location_id: string; is_primary: boolean }[];
    role?: UserRole;
    manager_id?: string;
  };
}

export const CreateUserModal = ({
  open,
  onOpenChange,
  onSuccess,
  initialData,
}: CreateUserModalProps) => {
  const { toast } = useToast();
  const { userRole } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState("");
  const [generatedName, setGeneratedName] = useState("");
  const [emailSent, setEmailSent] = useState<boolean | null>(null);
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [resending, setResending] = useState(false);

  const getInitialFormData = () => ({
    name: initialData?.name || "",
    email: initialData?.email ? "" : "", // Don't copy email - must be unique
    password: "",
    locations: initialData?.locations || [],
    role: initialData?.role || "employee" as UserRole,
    manager_id: initialData?.manager_id || "",
  });

  const [formData, setFormData] = useState(getInitialFormData());

  // Reset form when modal opens with new initialData
  useEffect(() => {
    if (open) {
      setFormData(getInitialFormData());
    }
  }, [open, initialData]);

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
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const special = "!@#$%^&*";
    const all = upper + lower + numbers + special;
    
    // Ensure at least one of each required type
    let password = 
      upper.charAt(Math.floor(Math.random() * upper.length)) +
      lower.charAt(Math.floor(Math.random() * lower.length)) +
      numbers.charAt(Math.floor(Math.random() * numbers.length));
    
    // Fill the rest randomly
    for (let i = 0; i < 9; i++) {
      password += all.charAt(Math.floor(Math.random() * all.length));
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const validatePassword = (password: string) => {
    if (password.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter";
    if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter";
    if (!/[0-9]/.test(password)) return "Password must contain a number";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate
      if (
        !formData.name ||
        !formData.email ||
        !formData.password ||
        formData.locations.length === 0
      ) {
        toast({
          title: "Validation Error",
          description: "All required fields must be filled, including password and at least one location.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const passwordError = validatePassword(formData.password);
      if (passwordError) {
        toast({
          title: "Invalid Password",
          description: passwordError,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Ensure at least one location is marked as primary
      if (!formData.locations.some(loc => loc.is_primary)) {
        toast({
          title: "Validation Error",
          description: "Please mark one location as primary.",
          variant: "destructive",
        });
        setIsSubmitting(false);
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
        setIsSubmitting(false);
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
        setIsSubmitting(false);
        return;
      }

      // Use the password from the form

      // Get current session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("You must be logged in to create users");
      }

      // Call edge function to create user with admin privileges
      // Employee ID will be auto-generated by the server
      const primaryLocation = formData.locations.find(loc => loc.is_primary);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            location_id: primaryLocation?.location_id || null,
            role: formData.role,
            manager_id: formData.role === "finance" || formData.role === "admin" || formData.role === "super_admin"
              ? null
              : formData.manager_id || null,
            password: formData.password
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create user");
      }

      // Insert location assignments
      const { error: locationError } = await supabase
        .from("user_locations")
        .insert(
          formData.locations.map(loc => ({
            user_id: result.user.id,
            location_id: loc.location_id,
            is_primary: loc.is_primary,
          }))
        );

      if (locationError) throw locationError;

      setGeneratedEmail(formData.email);
      setGeneratedName(formData.name);
      setEmailSent(result.email_sent ?? false);
      setEmailError(result.email_error);
      setShowPasswordDialog(true);

      // Reset form
      setFormData({
        name: "",
        email: "",
        password: "",
        locations: [],
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

  const resendInvite = async () => {
    if (!generatedEmail) return;
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-welcome-email", {
        body: { email: generatedEmail, name: generatedName },
      });
      if (error) throw error;
      if (data?.success) {
        setEmailSent(true);
        setEmailError(undefined);
        toast({ title: "Invite sent", description: `Email sent to ${generatedEmail}` });
      } else {
        setEmailSent(false);
        setEmailError(data?.error);
        toast({
          title: "Email failed",
          description: data?.error || "Unable to send invite",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      setEmailSent(false);
      setEmailError(e?.message);
      toast({
        title: "Email failed",
        description: e?.message || "Unable to send invite",
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
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
              <Label htmlFor="password">Password *</Label>
              <div className="flex gap-2">
                <Input
                  id="password"
                  type="text"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="Enter password or generate one"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFormData({ ...formData, password: generatePassword() })}
                >
                  Generate
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Must be 8+ characters with uppercase, lowercase, and number
              </p>
            </div>

            <div className="space-y-2">
              <Label>Locations * (select at least one as primary)</Label>
              {!locations || locations.length === 0 ? (
                <p className="text-sm text-destructive">
                  Please create locations first
                </p>
              ) : (
                <div className="border rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
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
                              // If this is the first/only location, make it primary
                              const newLocations = [
                                ...formData.locations,
                                { location_id: location.id, is_primary: formData.locations.length === 0 },
                              ];
                              setFormData({
                                ...formData,
                                locations: newLocations,
                              });
                            } else {
                              const newLocations = formData.locations.filter(
                                (l) => l.location_id !== location.id
                              );
                              // If removing the primary and there's still one left, make that one primary
                              const wasPrimary = formData.locations.find(l => l.location_id === location.id)?.is_primary;
                              if (wasPrimary && newLocations.length === 1) {
                                newLocations[0].is_primary = true;
                              }
                              setFormData({
                                ...formData,
                                locations: newLocations,
                              });
                            }
                          }}
                          className="h-4 w-4"
                        />
                        <Label
                          htmlFor={`location-${location.id}`}
                          className="flex-1 cursor-pointer"
                        >
                          {location.name}
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
                  {getAssignableRoles(userRole as UserRole).map((role) => (
                    <SelectItem key={role} value={role} className="capitalize">
                      {role.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {userRole === 'finance' && (
                <p className="text-xs text-muted-foreground">
                  As a Finance user, you can create employees, managers, and finance users.
                </p>
              )}
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

            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Employee ID will be automatically generated upon creation
              </p>
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
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              User Created Successfully
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  User <strong>{generatedEmail}</strong> has been created.
                </p>

                {/* Welcome email status */}
                <div className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${emailSent ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900' : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900'}`}>
                  <div className="flex items-center gap-2 text-sm">
                    {emailSent ? (
                      <>
                        <Check className="h-4 w-4 text-green-600" />
                        <span>Welcome email sent to {generatedEmail}</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <span>
                          Welcome email failed{emailError ? `: ${emailError}` : ''}
                        </span>
                      </>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={resendInvite}
                    disabled={resending}
                  >
                    {resending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3 mr-1" />
                    )}
                    Resend invite
                  </Button>
                </div>
                
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:justify-end">
            <AlertDialogAction onClick={() => setShowPasswordDialog(false)}>
              Done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
