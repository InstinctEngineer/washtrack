import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { UserPlus, RefreshCw } from "lucide-react";
import { UserTable } from "@/components/UserTable";
import { CreateUserModal } from "@/components/CreateUserModal";
import { User } from "@/types/database";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RolePermissionsInfo } from "@/components/RolePermissionsInfo";

const Users = () => {
  const { user: currentUser, userRole } = useAuth();
  const { toast } = useToast();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: users, isLoading, error, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      console.log("Fetching users...");
      
      // Fetch users first
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      console.log("Users query result:", { data: usersData, error: usersError });

      if (usersError) {
        console.error("Error fetching users:", usersError);
        throw usersError;
      }

      if (!usersData || usersData.length === 0) {
        return [];
      }

      // Fetch locations
      const { data: locationsData } = await supabase
        .from("locations")
        .select("id, name");

      // Fetch all users again for manager names (to avoid RLS recursion issues)
      const { data: managersData } = await supabase
        .from("users")
        .select("id, name");

      // Create lookup maps
      const locationMap = new Map(locationsData?.map(l => [l.id, l.name]) || []);
      const managerMap = new Map(managersData?.map(m => [m.id, m.name]) || []);

      // Transform data with manual joins
      const transformedData = usersData.map(user => ({
        ...user,
        location: user.location_id ? { name: locationMap.get(user.location_id) || "Unknown" } : null,
        manager: user.manager_id ? { name: managerMap.get(user.manager_id) || "Unknown" } : null
      }));
      
      console.log("Transformed users:", transformedData);
      
      return transformedData as (User & { 
        location?: { name: string } | null;
        manager?: { name: string } | null;
      })[];
    },
  });

  const handleSyncCurrentUser = async () => {
    if (!currentUser) {
      toast({
        title: "Error",
        description: "No authenticated user found",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);

    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("id", currentUser.id)
        .single();

      if (existingUser) {
        toast({
          title: "User Already Exists",
          description: "Your user record already exists in the system.",
        });
        refetch();
        return;
      }

      // Get user metadata from auth
      const { data: authUser } = await supabase.auth.getUser();
      const userMetadata = authUser.user?.user_metadata || {};
      const email = authUser.user?.email || "";
      const name = userMetadata.name || email.split("@")[0];

      // Create user record
      const { error: insertError } = await supabase.from("users").insert({
        id: currentUser.id,
        email: email,
        name: name,
        employee_id: currentUser.id.substring(0, 8).toUpperCase(),
        role: "admin",
        is_active: true,
        location_id: null,
        manager_id: null,
      });

      if (insertError) throw insertError;

      // Create user_roles entry
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: currentUser.id,
        role: "admin",
      });

      if (roleError) throw roleError;

      toast({
        title: "Success",
        description: "Your user record has been created successfully.",
      });

      refetch();
    } catch (error: any) {
      console.error("Error syncing user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to sync user",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Get user roles from user_roles table
  const { data: userRoles } = useQuery({
    queryKey: ["user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (error) throw error;
      return data;
    },
  });

  // Create a map of user_id to role
  const roleMap = new Map(
    userRoles?.map((ur) => [ur.user_id, ur.role]) || []
  );

  // Filter users
  const filteredUsers = users?.filter((user) => {
    const userRole = roleMap.get(user.id) || user.role;
    
    // Role filter
    if (roleFilter !== "all" && userRole !== roleFilter) return false;

    // Status filter
    if (statusFilter === "active" && !user.is_active) return false;
    if (statusFilter === "inactive" && user.is_active) return false;

    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.employee_id.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const userCount = filteredUsers?.length || 0;

  const showSyncBanner = !isLoading && (!users || users.length === 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground">
              View and edit user accounts
            </p>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-sm text-muted-foreground">
                Showing {userCount} users
              </p>
              <RolePermissionsInfo currentUserRole={userRole} />
            </div>
          </div>
          <Button onClick={() => setCreateModalOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Create New User
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error Loading Users</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : "Failed to load users. Check console for details."}
            </AlertDescription>
          </Alert>
        )}

        {showSyncBanner && (
          <Alert>
            <AlertTitle>No User Records Found</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>
                The users table is empty. Initialize the system by syncing your current user account.
              </span>
              <Button
                onClick={handleSyncCurrentUser}
                disabled={isSyncing}
                size="sm"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync Current User
                  </>
                )}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <UserTable
          users={filteredUsers || []}
          roleMap={roleMap}
          isLoading={isLoading}
          onRefresh={refetch}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />

        <CreateUserModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          onSuccess={refetch}
        />
      </div>
    </Layout>
  );
};

export default Users;
