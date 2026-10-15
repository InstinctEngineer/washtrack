import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { hasRoleOrHigher } from '@/lib/roleUtils';
import { UserRole } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, ChevronDown, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { TableToolbar, matchesSearch } from "@/components/TableToolbar";

interface RateConfig {
  id: string;
  client_id: string;
  location_id: string;
  work_type_id: string;
  frequency: string | null;
  rate: number | null;
  needs_rate_review: boolean;
  is_active: boolean;
  created_at: string;
  client: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  work_type: { id: string; name: string; rate_type: string } | null;
}

const FREQUENCY_OPTIONS = [
  { value: '', label: 'None (Hourly work)' },
  { value: '1x/week', label: '1x/week' },
  { value: '2x/week', label: '2x/week' },
  { value: '3x/week', label: '3x/week' },
  { value: 'Daily', label: 'Daily' },
  { value: 'Weekly', label: 'Weekly' },
  { value: 'Bi-weekly', label: 'Bi-weekly' },
  { value: 'Monthly', label: 'Monthly' },
];

const RateCard = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = hasRoleOrHigher(userRole as UserRole, 'admin' as UserRole);
  const isFinanceOrHigher = hasRoleOrHigher(userRole as UserRole, 'finance' as UserRole);

  const [isOpen, setIsOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<RateConfig | null>(null);
  const [search, setSearch] = useState("");

  // Filters
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterWorkType, setFilterWorkType] = useState<string>('all');
  const [showNeedsReview, setShowNeedsReview] = useState(false);

  // Sorting
  type SortColumn = 'client' | 'location' | 'work_type' | 'frequency' | 'rate' | 'status' | null;
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Form state
  const [formClientId, setFormClientId] = useState('');
  const [formLocationId, setFormLocationId] = useState('');
  const [formWorkTypeId, setFormWorkTypeId] = useState('');
  const [formFrequency, setFormFrequency] = useState('');
  const [formRate, setFormRate] = useState('');

  // Inline edit state
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [editingRateValue, setEditingRateValue] = useState('');

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch locations (filtered by selected client in filters)
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', filterClient],
    queryFn: async () => {
      let query = supabase
        .from('locations')
        .select('id, name, client_id')
        .eq('is_active', true)
        .order('name');
      if (filterClient !== 'all') {
        query = query.eq('client_id', filterClient);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch form locations (filtered by form client)
  const { data: formLocations = [] } = useQuery({
    queryKey: ['locations-form', formClientId],
    queryFn: async () => {
      if (!formClientId) return [];
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .eq('client_id', formClientId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!formClientId,
  });

  // Fetch work types
  const { data: workTypes = [] } = useQuery({
    queryKey: ['work-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_types')
        .select('id, name, rate_type')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch rate configs
  const { data: rateConfigs = [], isLoading } = useQuery({
    queryKey: ['rate-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rate_configs')
        .select(`
          *,
          client:clients(id, name),
          location:locations(id, name),
          work_type:work_types(id, name, rate_type)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as RateConfig[];
    },
  });

  // Filter rate configs
