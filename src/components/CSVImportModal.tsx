import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, Download, FileText, X, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";

interface CSVImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedRow {
  rowNumber: number;
  client_name: string;
  location_name: string;
  identifier: string;
  work_type: string;
  frequency: string;
  rate_type: string;
  rate: string;
  client_id: string | null;
  location_id: string | null;
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

interface Client {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
  client_id: string;
}

export function CSVImportModal({ open, onOpenChange }: CSVImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; failed: number } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const resetState = useCallback(() => {
    setFile(null);
    setParsedRows([]);
    setImportResults(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [onOpenChange, resetState]);

  const downloadExampleCSV = () => {
    const csvContent = `client_name,location_name,identifier,work_type,frequency,rate_type,rate
Acme Corp,Main Warehouse,T-101,Box Truck,2x/week,per_unit,45.00
Acme Corp,Main Warehouse,T-102,Box Truck,2x/week,per_unit,
Acme Corp,Downtown Office,,Pressure Washing,Monthly,per_unit,150.00
Beta Inc,Headquarters,,Hourly Cleaning,,hourly,25.00
Beta Inc,Headquarters,VAN-001,Cargo Van,Weekly,per_unit,35.00`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'example-services.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file.",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setImportResults(null);
    await parseCSV(selectedFile);
  };

  const parseCSV = async (csvFile: File) => {
    setIsProcessing(true);

    try {
      // Fetch clients and locations for validation
      const [clientsRes, locationsRes] = await Promise.all([
        supabase.from("clients").select("id, name").eq("is_active", true),
        supabase.from("locations").select("id, name, client_id").eq("is_active", true),
      ]);

      const clients: Client[] = clientsRes.data || [];
      const locations: Location[] = locationsRes.data || [];

      // Create lookup maps (case-insensitive)
      const clientMap = new Map(clients.map((c) => [c.name.toLowerCase(), c]));
      const locationsByClient = new Map<string, Location[]>();
      locations.forEach((loc) => {
        const existing = locationsByClient.get(loc.client_id) || [];
        existing.push(loc);
        locationsByClient.set(loc.client_id, existing);
      });

      // Read file
      const data = await csvFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { defval: "" });

      // Parse and validate rows
      const rows: ParsedRow[] = jsonData.map((row, index) => {
        const errors: string[] = [];
        const warnings: string[] = [];

        const client_name = (row.client_name || "").trim();
        const location_name = (row.location_name || "").trim();
        const identifier = (row.identifier || "").trim();
        const work_type = (row.work_type || "").trim();
        const frequency = (row.frequency || "").trim();
        const rate_type = (row.rate_type || "").trim().toLowerCase();
        const rate = (row.rate || "").trim();

        // Required field validation
        if (!client_name) errors.push("Client name is required");
        if (!location_name) errors.push("Location name is required");
        if (!work_type) errors.push("Work type is required");
        if (!rate_type) errors.push("Rate type is required");

        // Rate type validation
        if (rate_type && !["per_unit", "hourly"].includes(rate_type)) {
          errors.push('Rate type must be "per_unit" or "hourly"');
        }

        // Rate validation
        if (rate && isNaN(parseFloat(rate))) {
          errors.push("Rate must be a valid number");
        }

        // Resolve client
        const client = clientMap.get(client_name.toLowerCase());
        let client_id: string | null = null;
        if (client_name && !client) {
          errors.push(`Client "${client_name}" not found`);
        } else if (client) {
          client_id = client.id;
        }

        // Resolve location
        let location_id: string | null = null;
        if (client_id && location_name) {
          const clientLocations = locationsByClient.get(client_id) || [];
          const location = clientLocations.find(
            (l) => l.name.toLowerCase() === location_name.toLowerCase()
          );
          if (!location) {
            errors.push(`Location "${location_name}" not found for client "${client_name}"`);
          } else {
            location_id = location.id;
          }
        }

        // Warnings
        if (!rate) {
          warnings.push("No rate provided - will use rate inheritance or flag for review");
        }

        return {
          rowNumber: index + 2, // +2 for 1-indexed + header row
          client_name,
          location_name,
          identifier,
          work_type,
          frequency,
          rate_type,
          rate,
          client_id,
          location_id,
          errors,
          warnings,
          isValid: errors.length === 0,
        };
      });

      setParsedRows(rows);
    } catch (error) {
      console.error("Error parsing CSV:", error);
      toast({
        title: "Error parsing CSV",
        description: "Please check the file format and try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter((row) => row.isValid);
    if (validRows.length === 0) {
      toast({
        title: "No valid rows",
        description: "Please fix the errors and try again.",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    let failedCount = 0;

    try {
      // Prepare insert data
      const insertData = validRows.map((row) => ({
        client_id: row.client_id!,
        location_id: row.location_id!,
        identifier: row.identifier || null,
        work_type: row.work_type,
        frequency: row.frequency || null,
        rate_type: row.rate_type,
        rate: row.rate ? parseFloat(row.rate) : null,
      }));

      // Batch insert
      const { data, error } = await supabase
        .from("billable_items")
        .insert(insertData)
        .select();

      if (error) throw error;

      successCount = data?.length || 0;
      failedCount = validRows.length - successCount;

      setImportResults({ success: successCount, failed: failedCount });
      queryClient.invalidateQueries({ queryKey: ["billableItems"] });

      toast({
        title: "Import complete",
        description: `Successfully imported ${successCount} services.${failedCount > 0 ? ` ${failedCount} failed.` : ""}`,
      });
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: "An error occurred during import. Please try again.",
        variant: "destructive",
      });
      failedCount = validRows.length;
      setImportResults({ success: 0, failed: failedCount });
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const errorCount = parsedRows.filter((r) => !r.isValid).length;
  const warningCount = parsedRows.filter((r) => r.isValid && r.warnings.length > 0).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Services from CSV</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Download Example */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Upload a CSV file with service data. Required columns: client_name, location_name, work_type, rate_type.
            </p>
            <Button variant="outline" size="sm" onClick={downloadExampleCSV}>
              <Download className="mr-2 h-4 w-4" />
              Example CSV
            </Button>
          </div>

          {/* File Upload */}
          {!file ? (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                <p className="mb-2 text-sm text-muted-foreground">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">CSV files only</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".csv"
                onChange={handleFileChange}
              />
            </label>
          ) : (
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">{file.name}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={resetState}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Processing State */}
          {isProcessing && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-muted-foreground">Processing CSV...</span>
            </div>
          )}

          {/* Preview Table */}
          {parsedRows.length > 0 && !isProcessing && (
            <>
              {/* Summary */}
              <div className="flex gap-4 text-sm">
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  {validCount} valid
                </Badge>
                {warningCount > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <AlertCircle className="h-3 w-3 text-yellow-500" />
                    {warningCount} warnings
                  </Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <XCircle className="h-3 w-3 text-destructive" />
                    {errorCount} errors
                  </Badge>
                )}
              </div>

              <ScrollArea className="flex-1 border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead className="w-16">Status</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Identifier</TableHead>
                      <TableHead>Work Type</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Rate Type</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row) => (
                      <TableRow
                        key={row.rowNumber}
                        className={
                          !row.isValid
                            ? "bg-destructive/10"
                            : row.warnings.length > 0
                            ? "bg-yellow-500/10"
                            : ""
                        }
                      >
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell>
                          {row.isValid ? (
                            row.warnings.length > 0 ? (
                              <AlertCircle className="h-4 w-4 text-yellow-500" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell>{row.client_name}</TableCell>
                        <TableCell>{row.location_name}</TableCell>
                        <TableCell>{row.identifier || "-"}</TableCell>
                        <TableCell>{row.work_type}</TableCell>
                        <TableCell>{row.frequency || "-"}</TableCell>
                        <TableCell>{row.rate_type}</TableCell>
                        <TableCell>{row.rate || "-"}</TableCell>
                        <TableCell className="max-w-xs">
                          {row.errors.length > 0 && (
                            <span className="text-xs text-destructive">{row.errors.join("; ")}</span>
                          )}
                          {row.warnings.length > 0 && row.errors.length === 0 && (
                            <span className="text-xs text-yellow-600">{row.warnings.join("; ")}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}

          {/* Import Results */}
          {importResults && (
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm">
                <span className="font-medium">Import complete:</span>{" "}
                {importResults.success} services imported successfully
                {importResults.failed > 0 && `, ${importResults.failed} failed`}.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            {importResults ? "Close" : "Cancel"}
          </Button>
          {parsedRows.length > 0 && !importResults && (
            <Button onClick={handleImport} disabled={validCount === 0 || isImporting}>
              {isImporting ? "Importing..." : `Import ${validCount} Services`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
