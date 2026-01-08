import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Building2, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Client } from '@/types/database';

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<Partial<Client>>({
    is_active: true,
    is_taxable: false,
  });
  const [sortColumn, setSortColumn] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isTableOpen, setIsTableOpen] = useState(true);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

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
    if (!formData.name) {
      toast.error('Client name is required');
      return;
    }

    try {
      const { error } = await supabase.from('clients').insert([formData as any]);

      if (error) throw error;

      toast.success('Client created successfully');
      setShowCreateDialog(false);
      setFormData({ is_active: true, is_taxable: false });
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
      setFormData({ is_active: true, is_taxable: false });
      fetchClients();
    } catch (error: any) {
      console.error('Error updating client:', error);
      toast.error(error.message || 'Failed to update client');
    }
  };

  const handleDelete = async (client: Client) => {
    if (!confirm(`Are you sure you want to delete "${client.name}"?`)) return;

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
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (client.parent_company?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (client.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()))
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
            <p className="text-muted-foreground">Manage billing entities - who receives invoices</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Client
          </Button>
        </div>

        <Card>
          <Collapsible open={isTableOpen} onOpenChange={setIsTableOpen}>
            <CardHeader className="cursor-pointer" onClick={() => setIsTableOpen(!isTableOpen)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ChevronDown className={cn("h-5 w-5 transition-transform", !isTableOpen && "-rotate-90")} />
                  <div>
                    <CardTitle>Clients</CardTitle>
                    <CardDescription>
                      {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </div>
                </div>
                <div className="w-64" onClick={(e) => e.stopPropagation()}>
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
            <CollapsibleContent>
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
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">Client Name{getSortIcon('name')}</div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort('parent_company')}
                    >
                      <div className="flex items-center">Parent Company{getSortIcon('parent_company')}</div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort('contact_name')}
                    >
                      <div className="flex items-center">Contact{getSortIcon('contact_name')}</div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort('contact_email')}
                    >
                      <div className="flex items-center">Email{getSortIcon('contact_email')}</div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort('is_active')}
                    >
                      <div className="flex items-center">Status{getSortIcon('is_active')}</div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort('tax_rate')}
                    >
                      <div className="flex items-center">Tax Rate{getSortIcon('tax_rate')}</div>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>
                        {client.parent_company ? (
                          <Badge variant="outline">{client.parent_company}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{client.contact_name || '-'}</TableCell>
                      <TableCell>{client.contact_email || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={client.is_active ? 'default' : 'secondary'}>
                          {client.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {client.tax_rate !== null && client.tax_rate !== undefined 
                          ? `${client.tax_rate}%` 
                          : '-'}
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
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setShowEditDialog(false);
            setSelectedClient(null);
            setFormData({ is_active: true, is_taxable: false });
          }
        }}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{showEditDialog ? 'Edit Client' : 'Create New Client'}</DialogTitle>
              <DialogDescription>
                {showEditDialog ? 'Update client information' : 'Add a new billing entity'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Client Name *</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="FedEx Ground - Rochester"
                />
                <p className="text-xs text-muted-foreground">
                  How this client appears on invoices
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="parent_company">Parent Company</Label>
                <Input
                  id="parent_company"
                  value={formData.parent_company || ''}
                  onChange={(e) => setFormData({ ...formData, parent_company: e.target.value })}
                  placeholder="FedEx"
                />
                <p className="text-xs text-muted-foreground">
                  For grouping related clients (optional)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_name">Contact Name</Label>
                <Input
                  id="contact_name"
                  value={formData.contact_name || ''}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  placeholder="John Smith"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_email">Contact Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.contact_email || ''}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  placeholder="john@company.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing_address">Billing Address</Label>
                <Textarea
                  id="billing_address"
                  value={formData.billing_address || ''}
                  onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                  placeholder="123 Main St, City, State 12345"
                  rows={2}
                />
              </div>

              {/* QuickBooks Settings Section */}
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-medium mb-3">QuickBooks Settings</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="default_terms">Default Terms</Label>
                    <Input
                      id="default_terms"
                      value={formData.default_terms || ''}
                      onChange={(e) => setFormData({ ...formData, default_terms: e.target.value })}
                      placeholder="Net 30"
                    />
                    <p className="text-xs text-muted-foreground">Payment terms</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="default_class">Default Class</Label>
                    <Input
                      id="default_class"
                      value={formData.default_class || ''}
                      onChange={(e) => setFormData({ ...formData, default_class: e.target.value })}
                      placeholder="Fleet Services"
                    />
                    <p className="text-xs text-muted-foreground">QuickBooks accounting class</p>
                  </div>
                </div>
              </div>

              {/* Tax Settings Section */}
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-medium mb-3">Tax Settings</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_taxable"
                      checked={formData.is_taxable ?? false}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_taxable: checked === true })}
                    />
                    <Label htmlFor="is_taxable">This client is taxable</Label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tax_jurisdiction">Tax Jurisdiction</Label>
                    <Input
                      id="tax_jurisdiction"
                      value={formData.tax_jurisdiction || ''}
                      onChange={(e) => setFormData({ ...formData, tax_jurisdiction: e.target.value })}
                      placeholder="MN"
                    />
                    <p className="text-xs text-muted-foreground">QuickBooks tax jurisdiction code</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                    <Input
                      id="tax_rate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.tax_rate ?? ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        tax_rate: e.target.value ? parseFloat(e.target.value) : null 
                      })}
                      placeholder="8.25"
                    />
                    <p className="text-xs text-muted-foreground">Tax percentage (e.g., 8.25 for 8.25%)</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked === true })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowCreateDialog(false);
                setShowEditDialog(false);
              }}>
                Cancel
              </Button>
              <Button onClick={showEditDialog ? handleUpdate : handleCreate}>
                {showEditDialog ? 'Save Changes' : 'Create Client'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
