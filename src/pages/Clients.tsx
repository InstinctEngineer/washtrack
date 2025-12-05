import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Building2, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Client {
  id: string;
  client_name: string;
  client_code: string;
  legal_business_name?: string;
  industry?: string;
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
  billing_contact_name?: string;
  billing_contact_email?: string;
  billing_contact_phone?: string;
  billing_address?: string;
  billing_city?: string;
  billing_state?: string;
  billing_zip?: string;
  billing_country?: string;
  payment_terms?: string;
  is_active: boolean;
  notes?: string;
}

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<Partial<Client>>({
    is_active: true,
    payment_terms: 'net_30',
    billing_country: 'USA',
  });
  const [sortColumn, setSortColumn] = useState<string>('client_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('client_name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.client_name || !formData.client_code) {
      toast.error('Client name and code are required');
      return;
    }

    try {
      const { error } = await supabase.from('clients').insert([formData as any]);

      if (error) throw error;

      toast.success('Client created successfully');
      setShowCreateDialog(false);
      setFormData({ is_active: true, payment_terms: 'net_30', billing_country: 'USA' });
      fetchClients();
    } catch (error: any) {
      console.error('Error creating client:', error);
      toast.error(error.message || 'Failed to create client');
    }
  };

  const handleUpdate = async () => {
    if (!selectedClient) return;

    try {
      const { error } = await supabase
        .from('clients')
        .update(formData)
        .eq('id', selectedClient.id);

      if (error) throw error;

      toast.success('Client updated successfully');
      setShowEditDialog(false);
      setSelectedClient(null);
      setFormData({ is_active: true, payment_terms: 'net_30', billing_country: 'USA' });
      fetchClients();
    } catch (error: any) {
      console.error('Error updating client:', error);
      toast.error(error.message || 'Failed to update client');
    }
  };

  const handleDelete = async (client: Client) => {
    if (!confirm(`Are you sure you want to delete ${client.client_name}?`)) return;

    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);

      if (error) throw error;

      toast.success('Client deleted successfully');
      fetchClients();
    } catch (error: any) {
      console.error('Error deleting client:', error);
      toast.error(error.message || 'Failed to delete client');
    }
  };

  const openEditDialog = (client: Client) => {
    setSelectedClient(client);
    setFormData(client);
    setShowEditDialog(true);
  };

  const filteredClients = clients.filter(client =>
    client.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.client_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (client.primary_contact_name?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedClients = useMemo(() => {
    return [...filteredClients].sort((a, b) => {
      const aValue = a[sortColumn as keyof Client];
      const bValue = b[sortColumn as keyof Client];

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1;

      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }, [filteredClients, sortColumn, sortDirection]);

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Client Management</h1>
            <p className="text-muted-foreground">Manage your client accounts and billing information</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Client
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Clients</CardTitle>
                <CardDescription>
                  {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''}
                </CardDescription>
              </div>
              <div className="w-64">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No clients found</p>
                <Button onClick={() => setShowCreateDialog(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Client
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort('client_name')}
                    >
                      <div className="flex items-center">Client Name{getSortIcon('client_name')}</div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort('client_code')}
                    >
                      <div className="flex items-center">Code{getSortIcon('client_code')}</div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort('primary_contact_name')}
                    >
                      <div className="flex items-center">Contact{getSortIcon('primary_contact_name')}</div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort('primary_contact_phone')}
                    >
                      <div className="flex items-center">Phone{getSortIcon('primary_contact_phone')}</div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort('primary_contact_email')}
                    >
                      <div className="flex items-center">Email{getSortIcon('primary_contact_email')}</div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort('is_active')}
                    >
                      <div className="flex items-center">Status{getSortIcon('is_active')}</div>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.client_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{client.client_code}</Badge>
                      </TableCell>
                      <TableCell>{client.primary_contact_name || '-'}</TableCell>
                      <TableCell>{client.primary_contact_phone || '-'}</TableCell>
                      <TableCell>{client.primary_contact_email || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={client.is_active ? 'default' : 'secondary'}>
                          {client.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(client)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(client)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setShowEditDialog(false);
            setSelectedClient(null);
            setFormData({ is_active: true, payment_terms: 'net_30', billing_country: 'USA' });
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{showEditDialog ? 'Edit Client' : 'Create New Client'}</DialogTitle>
              <DialogDescription>
                {showEditDialog ? 'Update client information' : 'Add a new client to the system'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="font-semibold">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="client_name">Client Name *</Label>
                    <Input
                      id="client_name"
                      value={formData.client_name || ''}
                      onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                      placeholder="ABC Company"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client_code">Client Code *</Label>
                    <Input
                      id="client_code"
                      value={formData.client_code || ''}
                      onChange={(e) => setFormData({ ...formData, client_code: e.target.value.toUpperCase() })}
                      placeholder="ABC123"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="legal_business_name">Legal Business Name</Label>
                    <Input
                      id="legal_business_name"
                      value={formData.legal_business_name || ''}
                      onChange={(e) => setFormData({ ...formData, legal_business_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Input
                      id="industry"
                      value={formData.industry || ''}
                      onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Primary Contact */}
              <div className="space-y-4">
                <h3 className="font-semibold">Primary Contact</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="primary_contact_name">Name</Label>
                    <Input
                      id="primary_contact_name"
                      value={formData.primary_contact_name || ''}
                      onChange={(e) => setFormData({ ...formData, primary_contact_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="primary_contact_email">Email</Label>
                    <Input
                      id="primary_contact_email"
                      type="email"
                      value={formData.primary_contact_email || ''}
                      onChange={(e) => setFormData({ ...formData, primary_contact_email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="primary_contact_phone">Phone</Label>
                    <Input
                      id="primary_contact_phone"
                      value={formData.primary_contact_phone || ''}
                      onChange={(e) => setFormData({ ...formData, primary_contact_phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Billing Contact */}
              <div className="space-y-4">
                <h3 className="font-semibold">Billing Contact</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="billing_contact_name">Name</Label>
                    <Input
                      id="billing_contact_name"
                      value={formData.billing_contact_name || ''}
                      onChange={(e) => setFormData({ ...formData, billing_contact_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_contact_email">Email</Label>
                    <Input
                      id="billing_contact_email"
                      type="email"
                      value={formData.billing_contact_email || ''}
                      onChange={(e) => setFormData({ ...formData, billing_contact_email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_contact_phone">Phone</Label>
                    <Input
                      id="billing_contact_phone"
                      value={formData.billing_contact_phone || ''}
                      onChange={(e) => setFormData({ ...formData, billing_contact_phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Billing Address */}
              <div className="space-y-4">
                <h3 className="font-semibold">Billing Address</h3>
                <div className="space-y-2">
                  <Label htmlFor="billing_address">Street Address</Label>
                  <Input
                    id="billing_address"
                    value={formData.billing_address || ''}
                    onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="billing_city">City</Label>
                    <Input
                      id="billing_city"
                      value={formData.billing_city || ''}
                      onChange={(e) => setFormData({ ...formData, billing_city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_state">State</Label>
                    <Input
                      id="billing_state"
                      value={formData.billing_state || ''}
                      onChange={(e) => setFormData({ ...formData, billing_state: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_zip">ZIP</Label>
                    <Input
                      id="billing_zip"
                      value={formData.billing_zip || ''}
                      onChange={(e) => setFormData({ ...formData, billing_zip: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Settings */}
              <div className="space-y-4">
                <h3 className="font-semibold">Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="payment_terms">Payment Terms</Label>
                    <Select
                      value={formData.payment_terms}
                      onValueChange={(value) => setFormData({ ...formData, payment_terms: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="net_30">Net 30</SelectItem>
                        <SelectItem value="net_15">Net 15</SelectItem>
                        <SelectItem value="net_60">Net 60</SelectItem>
                        <SelectItem value="due_on_receipt">Due on Receipt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="is_active">Status</Label>
                    <Select
                      value={formData.is_active ? 'active' : 'inactive'}
                      onValueChange={(value) => setFormData({ ...formData, is_active: value === 'active' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowCreateDialog(false);
                setShowEditDialog(false);
                setSelectedClient(null);
                setFormData({ is_active: true, payment_terms: 'net_30', billing_country: 'USA' });
              }}>
                Cancel
              </Button>
              <Button onClick={showEditDialog ? handleUpdate : handleCreate}>
                {showEditDialog ? 'Update' : 'Create'} Client
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
