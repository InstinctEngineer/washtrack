import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { UserTable } from "@/components/UserTable";
import { CreateUserModal } from "@/components/CreateUserModal";
import { User } from "@/types/database";

const Users = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select(`
          *,
          location:locations!users_location_id_fkey(name),
          manager:users!users_manager_id_fkey(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Supabase returns manager as array, we need to transform it
      const transformedData = data?.map(user => ({
        ...user,
        location: user.location && !Array.isArray(user.location) ? user.location : null,
        manager: user.manager && Array.isArray(user.manager) && user.manager.length > 0 
          ? user.manager[0] 
          : null
      }));
      
      return transformedData as (User & { 
        location?: { name: string } | null;
        manager?: { name: string } | null;
      })[];
    },
  });

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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground">
              View and edit user accounts
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Showing {userCount} users
            </p>
          </div>
          <Button onClick={() => setCreateModalOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Create New User
          </Button>
        </div>

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
