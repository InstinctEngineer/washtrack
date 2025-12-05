import { useState, useMemo, useEffect } from 'react';
import { Location, User } from '@/types/database';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Edit, Eye, Power, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface LocationTableProps {
  locations: Location[];
  loading: boolean;
  onEdit: (location: Location) => void;
  onDeactivate: (location: Location) => void;
  onViewDetails: (location: Location) => void;
}

interface LocationStats {
  [key: string]: {
    vehicleCount: number;
    employeeCount: number;
    managerName?: string;
  };
}

export const LocationTable = ({
  locations,
  loading,
  onEdit,
  onDeactivate,
  onViewDetails,
}: LocationTableProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortField, setSortField] = useState<'name' | 'employees' | 'vehicles'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [stats, setStats] = useState<LocationStats>({});
  const [deactivateDialog, setDeactivateDialog] = useState<{ open: boolean; location: Location | null }>({
    open: false,
    location: null,
  });
  const [isTableOpen, setIsTableOpen] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [vehiclesRes, usersRes, managersRes] = await Promise.all([
          supabase.from('vehicles').select('id, home_location_id, is_active'),
          supabase.from('users').select('id, location_id, is_active'),
          supabase.from('users').select('id, name').eq('role', 'manager'),
        ]);

        const newStats: LocationStats = {};

        locations.forEach((location) => {
          const vehicleCount = vehiclesRes.data?.filter(
            (v) => v.home_location_id === location.id && v.is_active
          ).length || 0;

          const employeeCount = usersRes.data?.filter(
            (u) => u.location_id === location.id && u.is_active
          ).length || 0;

          const manager = managersRes.data?.find((m) => m.id === location.manager_user_id);

          newStats[location.id] = {
            vehicleCount,
            employeeCount,
            managerName: manager?.name,
          };
        });

        setStats(newStats);
      } catch (error) {
        console.error('Error fetching location stats:', error);
      }
    };

    if (locations.length > 0) {
      fetchStats();
    }
  }, [locations]);

  const filteredAndSortedLocations = useMemo(() => {
    let filtered = locations.filter((location) => {
      const matchesSearch =
        location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        location.address?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && location.is_active) ||
        (statusFilter === 'inactive' && !location.is_active);

      return matchesSearch && matchesStatus;
    });

    filtered.sort((a, b) => {
      let comparison = 0;

      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'employees') {
        comparison = (stats[a.id]?.employeeCount || 0) - (stats[b.id]?.employeeCount || 0);
      } else if (sortField === 'vehicles') {
        comparison = (stats[a.id]?.vehicleCount || 0) - (stats[b.id]?.vehicleCount || 0);
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [locations, searchTerm, statusFilter, sortField, sortDirection, stats]);

  const handleSort = (field: 'name' | 'employees' | 'vehicles') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDeactivateClick = (location: Location) => {
    setDeactivateDialog({ open: true, location });
  };

  const handleDeactivateConfirm = () => {
    if (deactivateDialog.location) {
      onDeactivate(deactivateDialog.location);
    }
    setDeactivateDialog({ open: false, location: null });
  };

  if (loading) {
    return <div className="text-center py-8">Loading locations...</div>;
  }

  return (
    <Card>
      <Collapsible open={isTableOpen} onOpenChange={setIsTableOpen}>
        <CardHeader className="cursor-pointer" onClick={() => setIsTableOpen(!isTableOpen)}>
          <div className="flex items-center gap-2">
            <ChevronDown className={cn("h-5 w-5 transition-transform", !isTableOpen && "-rotate-90")} />
            <div>
              <CardTitle>Locations</CardTitle>
              <CardDescription>{locations.length} location{locations.length !== 1 ? 's' : ''}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-center">
              <Input
                placeholder="Search by name or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('name')}
              >
                Location Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Assigned Manager</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('vehicles')}
              >
                Active Vehicles {sortField === 'vehicles' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('employees')}
              >
                Active Employees {sortField === 'employees' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedLocations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No locations found
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedLocations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell>
                    <button
                      onClick={() => onViewDetails(location)}
                      className="font-medium hover:underline text-primary"
                    >
                      {location.name}
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {location.address || '-'}
                  </TableCell>
                  <TableCell>
                    {stats[location.id]?.managerName || (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>{stats[location.id]?.vehicleCount || 0}</TableCell>
                  <TableCell>{stats[location.id]?.employeeCount || 0}</TableCell>
                  <TableCell>
                    <Badge variant={location.is_active ? 'default' : 'secondary'}>
                      {location.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onViewDetails(location)}
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(location)}
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeactivateClick(location)}
                        title={location.is_active ? 'Deactivate' : 'Activate'}
                      >
                        <Power
                          className={`h-4 w-4 ${location.is_active ? 'text-destructive' : 'text-green-600'}`}
                        />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deactivateDialog.open} onOpenChange={(open) => setDeactivateDialog({ open, location: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deactivateDialog.location?.is_active ? 'Deactivate' : 'Activate'} Location
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateDialog.location?.is_active ? (
                <>
                  Are you sure you want to deactivate "{deactivateDialog.location?.name}"?
                  {stats[deactivateDialog.location?.id]?.employeeCount > 0 && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                      Warning: {stats[deactivateDialog.location?.id]?.employeeCount} active employee(s) are
                      assigned to this location.
                    </div>
                  )}
                </>
              ) : (
                `Are you sure you want to activate "${deactivateDialog.location?.name}"?`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivateConfirm}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
