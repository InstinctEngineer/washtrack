import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Database, Edit, Plus, Trash2, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const TABLES = [
  'users',
  'user_roles',
  'locations',
  'clients',
  'client_locations',
  'vehicles',
  'vehicle_types',
  'wash_entries',
  'system_settings'
];

export default function SuperAdminDatabase() {
  const { userRole } = useAuth();
  const [selectedTable, setSelectedTable] = useState(TABLES[0]);
  const [tableData, setTableData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editingRow, setEditingRow] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Only super_admin can access
  if (userRole !== 'super_admin') {
    return <Navigate to="/unauthorized" replace />;
  }

  const fetchTableData = async (tableName: string) => {
    setLoading(true);
    setSortColumn(null);
    setSortDirection('asc');
    try {
      const { data, error } = await supabase
        .from(tableName as any)
        .select('*')
        .limit(100);

      if (error) throw error;

      setTableData(data || []);
      if (data && data.length > 0) {
        setColumns(Object.keys(data[0]));
      } else {
        setColumns([]);
      }
    } catch (error: any) {
      toast.error(`Failed to fetch ${tableName}: ${error.message}`);
      setTableData([]);
      setColumns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTableData(selectedTable);
  }, [selectedTable]);

  const handleEdit = (row: any) => {
    setEditingRow(row);
    setFormData({ ...row });
    setEditDialog(true);
  };

  const handleDelete = async (row: any) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;

    try {
      const { error } = await supabase
        .from(selectedTable as any)
        .delete()
        .eq('id', row.id);

      if (error) throw error;

      toast.success('Record deleted successfully');
      fetchTableData(selectedTable);
    } catch (error: any) {
      toast.error(`Delete failed: ${error.message}`);
    }
  };

  const handleSave = async () => {
    try {
      if (editingRow) {
        // Update existing
        const { error } = await supabase
          .from(selectedTable as any)
          .update(formData)
          .eq('id', editingRow.id);

        if (error) throw error;
        toast.success('Record updated successfully');
      } else {
        // Insert new
        const { error } = await supabase
          .from(selectedTable as any)
          .insert([formData]);

        if (error) throw error;
        toast.success('Record created successfully');
      }

      setEditDialog(false);
      setEditingRow(null);
      setFormData({});
      fetchTableData(selectedTable);
    } catch (error: any) {
      toast.error(`Save failed: ${error.message}`);
    }
  };

  const handleAddNew = () => {
    const newRow: any = {};
    columns.forEach(col => {
      if (col !== 'id' && col !== 'created_at' && col !== 'updated_at') {
        newRow[col] = '';
      }
    });
    setEditingRow(null);
    setFormData(newRow);
    setEditDialog(true);
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedTableData = useMemo(() => {
    if (!sortColumn) return tableData;

    return [...tableData].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

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
  }, [tableData, sortColumn, sortDirection]);

  const getSortIcon = (col: string) => {
    if (sortColumn !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Database Manager</h1>
              <p className="text-muted-foreground">Super Admin - Full Database Access</p>
            </div>
          </div>
          <Button onClick={() => fetchTableData(selectedTable)} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tables</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedTable} onValueChange={setSelectedTable}>
              <ScrollArea className="w-full">
                <TabsList className="inline-flex w-max">
                  {TABLES.map(table => (
                    <TabsTrigger key={table} value={table}>
                      {table}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </ScrollArea>

              {TABLES.map(table => (
                <TabsContent key={table} value={table} className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      {tableData.length} records (showing max 100)
                    </p>
                    <Button onClick={handleAddNew} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add New
                    </Button>
                  </div>

                  {loading ? (
                    <div className="text-center py-8">
                      <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                    </div>
                  ) : tableData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No records found
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <ScrollArea className="h-[600px] w-full">
                        <div className="min-w-max">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {columns.map(col => (
                                  <TableHead 
                                    key={col} 
                                    className="whitespace-nowrap cursor-pointer select-none hover:bg-muted/50"
                                    onClick={() => handleSort(col)}
                                  >
                                    <div className="flex items-center">
                                      {col}
                                      {getSortIcon(col)}
                                    </div>
                                  </TableHead>
                                ))}
                                <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sortedTableData.map((row, idx) => (
                                <TableRow key={row.id || idx}>
                                  {columns.map(col => (
                                    <TableCell key={col} className="whitespace-nowrap">
                                      {typeof row[col] === 'object' 
                                        ? JSON.stringify(row[col]) 
                                        : String(row[col] ?? '')}
                                    </TableCell>
                                  ))}
                                  <TableCell className="text-right whitespace-nowrap">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEdit(row)}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(row)}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* Edit/Add Dialog */}
        <Dialog open={editDialog} onOpenChange={setEditDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRow ? 'Edit Record' : 'Add New Record'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {Object.keys(formData).map(key => (
                <div key={key} className="space-y-2">
                  <label className="text-sm font-medium">{key}</label>
                  <Input
                    value={typeof formData[key] === 'object' 
                      ? JSON.stringify(formData[key]) 
                      : formData[key] ?? ''}
                    onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                    placeholder={key}
                    disabled={key === 'id' || key === 'created_at' || key === 'updated_at'}
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
