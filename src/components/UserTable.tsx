import { useState } from "react";
import { User, UserRole } from "@/types/database";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Edit, Search, KeyRound, ChevronDown, Copy, Mail, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { EditUserModal } from "@/components/EditUserModal";
import { Skeleton } from "@/components/ui/skeleton";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import { supabase } from "@/integrations/supabase/client";
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

interface UserTableProps {
  users: (User & {
    location?: { name: string } | null;
    manager?: { name: string } | null;
    locations?: Array<{ name: string; is_primary: boolean }>;
    credentials_shared_at?: string | null;
    must_change_password?: boolean;
  })[];
  roleMap: Map<string, string>;
  isLoading: boolean;
  onRefresh: () => void;
  onCopyUser?: (user: User) => void;
  roleFilter: string;
  setRoleFilter: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  currentUserRole?: string | null;
}

const roleColors: Record<UserRole, string> = {
  employee: "bg-gray-500",
  manager: "bg-blue-500",
  finance: "bg-green-500",
  admin: "bg-red-500",
  super_admin: "bg-purple-500",
};

export const UserTable = ({
  users,
  roleMap,
  isLoading,
  onRefresh,
  onCopyUser,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  currentUserRole,
}: UserTableProps) => {
  const { toast } = useToast();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isTableOpen, setIsTableOpen] = useState(true);
  const [resendingFor, setResendingFor] = useState<string | null>(null);
  const [resettingFor, setResettingFor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isSuperAdmin = currentUserRole === "super_admin";

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: deleteTarget.id },
      });
      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error || "Failed to delete user");
      }
      toast({
        title: "User deleted",
        description: `${deleteTarget.name} has been permanently removed.`,
      });
      setDeleteTarget(null);
      onRefresh();
    } catch (err: any) {
      console.error("delete-user error:", err);
      toast({
        title: "Failed to delete user",
        description: err.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const sendAccountEmail = async (
    user: User,
    mode: "welcome" | "reset",
  ) => {
    if (!user.email) {
      toast({ title: "No email on file", variant: "destructive" });
      return;
    }
    const setter = mode === "reset" ? setResettingFor : setResendingFor;
    setter(user.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-welcome-email", {
        body: { email: user.email, name: user.name, mode },
      });
      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error || "Failed to send email");
      }
      toast({
        title: mode === "reset" ? "Password reset email sent" : "Setup email resent",
        description: `Sent to ${user.email}.`,
      });
    } catch (err: any) {
      console.error("send-welcome-email error:", err);
      toast({
        title: "Failed to send email",
        description: err.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setter(null);
    }
  };

  const { sortedData: sortedUsers, sortColumn, sortDirection, handleSort } = useTableSort(users, {
    getValue: (u, col) => {
      switch (col) {
        case "employee_id": return u.employee_id || "";
        case "name": return u.name;
        case "email": return u.email || "";
        case "location": return (u.locations && u.locations[0]?.name) || "";
        case "role": return roleMap.get(u.id) || u.role;
        case "manager": return u.manager?.name || "";
        case "is_active": return u.is_active;
        default: return "";
      }
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <Card>
      <Collapsible open={isTableOpen} onOpenChange={setIsTableOpen}>
        <CardHeader className="cursor-pointer" onClick={() => setIsTableOpen(!isTableOpen)}>
          <div className="flex items-center gap-2">
            <ChevronDown className={cn("h-5 w-5 transition-transform", !isTableOpen && "-rotate-90")} />
            <div>
              <CardTitle>Users</CardTitle>
              <CardDescription>{users.length} user{users.length !== 1 ? 's' : ''}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or employee ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead column="employee_id" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Employee ID</SortableTableHead>
              <SortableTableHead column="name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Name</SortableTableHead>
              <SortableTableHead column="email" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Email</SortableTableHead>
              <SortableTableHead column="location" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Location</SortableTableHead>
              <SortableTableHead column="role" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Role</SortableTableHead>
              <SortableTableHead column="manager" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Manager</SortableTableHead>
              <SortableTableHead column="is_active" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Status</SortableTableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              sortedUsers.map((user) => {
                const userRole = (roleMap.get(user.id) || user.role) as UserRole;
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.employee_id}</TableCell>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {user.locations && user.locations.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.locations.map((loc, idx) => (
                            <Badge
                              key={idx}
                              variant={loc.is_primary ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {loc.name}
                              {loc.is_primary && " (Primary)"}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Not Assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={roleColors[userRole]}>
                        {userRole}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.manager?.name || (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={user.is_active ? "default" : "secondary"}>
                          {user.is_active ? "Active" : "Inactive"}
                        </Badge>
                        {user.must_change_password && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-orange-600 border-orange-300 hover:bg-orange-50 gap-1"
                            onClick={() => sendAccountEmail(user, "welcome")}
                            disabled={resendingFor === user.id}
                            title="Resend account setup email"
                          >
                            {resendingFor === user.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Mail className="h-3 w-3" />
                            )}
                            Resend Email
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingUser(user)}
                          title="Edit user"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onCopyUser?.(user)}
                          title="Copy user"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => sendAccountEmail(user, "reset")}
                          disabled={resettingFor === user.id}
                          title="Send password reset email"
                        >
                          {resettingFor === user.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <KeyRound className="h-4 w-4" />
                          )}
                        </Button>
                        {isSuperAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(user)}
                            title="Permanently delete user"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          userRole={roleMap.get(editingUser.id) || editingUser.role}
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
          onSuccess={() => {
            setEditingUser(null);
            onRefresh();
          }}
        />
      )}

          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
