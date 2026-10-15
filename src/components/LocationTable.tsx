import { useState, useMemo, useEffect } from 'react';
import { Location, Client } from '@/types/database';
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
import { useTableSort } from '@/hooks/useTableSort';
import { SortableTableHead } from '@/components/SortableTableHead';
import { TableToolbar } from "@/components/TableToolbar";

interface LocationTableProps {
  locations: Location[];
  loading: boolean;
  onEdit: (location: Location) => void;
  onDeactivate: (location: Location) => void;
  onViewDetails: (location: Location) => void;
}

interface LocationStats {
  [key: string]: {
    employeeCount: number;
    clientName?: string;
  };
}

export const LocationTable = ({
  locations,
  loading,
  onEdit,
  onDeactivate,
  onViewDetails,
}: LocationTableProps) => {
  const [clientFilter, setClientFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [stats, setStats] = useState<LocationStats>({});
  const [clients, setClients] = useState<Client[]>([]);
  const [deactivateDialog, setDeactivateDialog] = useState<{ open: boolean; location: Location | null }>({
    open: false,
    location: null,
  });
  const [isTableOpen, setIsTableOpen] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, clientsRes] = await Promise.all([
          supabase.from('users').select('id, location_id, is_active'),
          supabase.from('clients').select('*'),
        ]);

        setClients(clientsRes.data || []);

        const newStats: LocationStats = {};

        locations.forEach((location) => {
          const employeeCount = usersRes.data?.filter(
            (u) => u.location_id === location.id && u.is_active
          ).length || 0;

          const client = clientsRes.data?.find((c) => c.id === location.client_id);

          newStats[location.id] = {
            employeeCount,
            clientName: client?.name,
          };
        });

        setStats(newStats);
      } catch (error) {
        console.error('Error fetching location stats:', error);
      }
    };

    if (locations.length > 0) {
      fetchData();
    }
  }, [locations]);

  const filteredLocations = useMemo(() => {
    return locations.filter((location) => {
      const clientName = stats[location.id]?.clientName;
      const matchesQuery = !searchTerm || [
        location.name, 
        location.address,
        clientName
      ].some(val => val?.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = 
        statusFilter === "all" || 
        (statusFilter === "active" && location.is_active) || 
        (statusFilter === "inactive" && !location.is_active);

      const matchesClient = clientFilter === "all" || location.client_id === clientFilter;

      return matchesQuery && matchesStatus && matchesClient;
    });
  }, [locations, searchTerm, statusFilter, clientFilter, stats]);

  const { sortedData: filteredAndSortedLocations, sortColumn, sortDirection, handleSort } = useTableSort(
    filteredLocations,
    {
      initialColumn: 'name',
      getValue: (loc, col) => {
        switch (col) {
          case 'name': return loc.name;
          case 'client': return stats[loc.id]?.clientName || '';
          case 'address': return loc.address || '';
          case 'employees': return stats[loc.id]?.employeeCount || 0;
          case 'is_active': return loc.is_active;
          default: return '';
        }
      },
    }
  );

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
