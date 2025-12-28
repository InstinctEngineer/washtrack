import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, Download, FileText, X, CheckCircle2, AlertCircle, XCircle, Check, Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import * as XLSX from "xlsx";
import { findSimilarMatches, SimilarMatch } from "@/lib/fuzzyMatch";
import { CreateClientInlineModal } from "./CreateClientInlineModal";
import { CreateLocationInlineModal } from "./CreateLocationInlineModal";

interface CSVImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  // Enhanced fields for suggestions
  clientSuggestions: SimilarMatch<Client>[];
  locationSuggestions: SimilarMatch<Location>[];
  resolvedClientId: string | null;
  resolvedClientName: string | null;
  resolvedLocationId: string | null;
  resolvedLocationName: string | null;
  clientError: string | null;
  locationError: string | null;
}

interface PendingCreation {
  rowNumber: number;
  type: 'client' | 'location';
  prefillName: string;
  prefillClientId?: string | null;
}

export function CSVImportModal({ open, onOpenChange }: CSVImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; failed: number } | null>(null);
  const [pendingCreation, setPendingCreation] = useState<PendingCreation | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const resetState = useCallback(() => {
    setFile(null);
    setParsedRows([]);
    setImportResults(null);
    setPendingCreation(null);
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

  const validateRow = (
    row: Omit<ParsedRow, 'errors' | 'warnings' | 'isValid' | 'clientSuggestions' | 'locationSuggestions' | 'clientError' | 'locationError'>,
    clientsData: Client[],
    locationsData: Location[]
  ): ParsedRow => {
    const errors: string[] = [];
    const warnings: string[] = [];
    let clientError: string | null = null;
    let locationError: string | null = null;
    let clientSuggestions: SimilarMatch<Client>[] = [];
    let locationSuggestions: SimilarMatch<Location>[] = [];

    const { client_name, location_name, work_type, rate_type, rate, resolvedClientId, resolvedLocationId } = row;

    // Required field validation
    if (!client_name) errors.push("Client name is required");
    if (!location_name) errors.push("Location name is required");
    if (!work_type) errors.push("Work type is required");
    if (!rate_type) errors.push("Rate type is required");

    // Rate type validation
    if (rate_type && !["per_unit", "hourly"].includes(rate_type.toLowerCase())) {
      errors.push('Rate type must be "per_unit" or "hourly"');
    }

    // Rate validation
    if (rate && isNaN(parseFloat(rate))) {
      errors.push("Rate must be a valid number");
    }

    // Client lookup maps
    const clientMap = new Map(clientsData.map((c) => [c.name.toLowerCase(), c]));

    // Resolve client
    let client_id = resolvedClientId;
    if (!client_id && client_name) {
      const client = clientMap.get(client_name.toLowerCase());
      if (!client) {
        clientError = `Client "${client_name}" not found`;
        clientSuggestions = findSimilarMatches(client_name, clientsData, 0.4, 3);
      } else {
        client_id = client.id;
      }
    }

    // Location lookup
    const locationsByClient = new Map<string, Location[]>();
    locationsData.forEach((loc) => {
      const existing = locationsByClient.get(loc.client_id) || [];
      existing.push(loc);
      locationsByClient.set(loc.client_id, existing);
    });

    // Resolve location
    let location_id = resolvedLocationId;
    if (!location_id && client_id && location_name) {
      const clientLocations = locationsByClient.get(client_id) || [];
      const location = clientLocations.find(
        (l) => l.name.toLowerCase() === location_name.toLowerCase()
      );
      if (!location) {
        locationError = `Location "${location_name}" not found for this client`;
        locationSuggestions = findSimilarMatches(location_name, clientLocations, 0.4, 3);
      } else {
        location_id = location.id;
      }
    }

    // Warnings
    if (!rate) {
      warnings.push("No rate provided - will use rate inheritance or flag for review");
    }

    // Combine client/location errors into main errors array if not resolved
    if (clientError && !client_id) errors.push(clientError);
    if (locationError && !location_id) errors.push(locationError);

    return {
      ...row,
      client_id,
      location_id,
      errors,
      warnings,
      isValid: errors.length === 0,
      clientSuggestions,
      locationSuggestions,
      clientError: clientError && !client_id ? clientError : null,
      locationError: locationError && !location_id ? locationError : null,
    };
  };

  const parseCSV = async (csvFile: File) => {
    setIsProcessing(true);

    try {
      // Fetch clients and locations for validation
      const [clientsRes, locationsRes] = await Promise.all([
        supabase.from("clients").select("id, name").eq("is_active", true),
        supabase.from("locations").select("id, name, client_id").eq("is_active", true),
      ]);

      const clientsData: Client[] = clientsRes.data || [];
      const locationsData: Location[] = locationsRes.data || [];
      
      setClients(clientsData);
      setLocations(locationsData);

      // Read file
      const data = await csvFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { defval: "" });

      // Parse and validate rows
      const rows: ParsedRow[] = jsonData.map((row, index) => {
        const baseRow = {
          rowNumber: index + 2, // +2 for 1-indexed + header row
          client_name: String(row.client_name ?? "").trim(),
          location_name: String(row.location_name ?? "").trim(),
          identifier: String(row.identifier ?? "").trim(),
          work_type: String(row.work_type ?? "").trim(),
          frequency: String(row.frequency ?? "").trim(),
          rate_type: String(row.rate_type ?? "").trim().toLowerCase(),
          rate: String(row.rate ?? "").trim(),
          client_id: null as string | null,
          location_id: null as string | null,
          resolvedClientId: null as string | null,
          resolvedClientName: null as string | null,
          resolvedLocationId: null as string | null,
          resolvedLocationName: null as string | null,
        };

        return validateRow(baseRow, clientsData, locationsData);
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

  const acceptClientSuggestion = (rowNumber: number, suggestion: SimilarMatch<Client>) => {
    setParsedRows(prev => prev.map(row => {
      if (row.rowNumber !== rowNumber) return row;
      
      const updatedRow = {
        ...row,
        resolvedClientId: suggestion.item.id,
        resolvedClientName: suggestion.item.name,
        client_id: suggestion.item.id,
        // Reset location since client changed
        resolvedLocationId: null,
        resolvedLocationName: null,
        location_id: null,
      };

      return validateRow(updatedRow, clients, locations);
    }));
  };

  const acceptLocationSuggestion = (rowNumber: number, suggestion: SimilarMatch<Location>) => {
    setParsedRows(prev => prev.map(row => {
      if (row.rowNumber !== rowNumber) return row;
      
      const updatedRow = {
        ...row,
        resolvedLocationId: suggestion.item.id,
        resolvedLocationName: suggestion.item.name,
        location_id: suggestion.item.id,
      };

      return validateRow(updatedRow, clients, locations);
    }));
  };

  const openCreateClientModal = (rowNumber: number, prefillName: string) => {
    setPendingCreation({
      rowNumber,
      type: 'client',
      prefillName,
    });
  };

  const openCreateLocationModal = (rowNumber: number, prefillName: string, clientId: string | null) => {
    setPendingCreation({
      rowNumber,
      type: 'location',
      prefillName,
      prefillClientId: clientId,
    });
  };

  const handleClientCreated = (newClient: { id: string; name: string }) => {
    // Add to clients list
    const updatedClients = [...clients, newClient];
    setClients(updatedClients);

    // Update the row that triggered creation
    if (pendingCreation) {
      setParsedRows(prev => prev.map(row => {
        if (row.rowNumber !== pendingCreation.rowNumber) return row;
        
        const updatedRow = {
          ...row,
          resolvedClientId: newClient.id,
          resolvedClientName: newClient.name,
          client_id: newClient.id,
        };

        return validateRow(updatedRow, updatedClients, locations);
      }));
    }

    setPendingCreation(null);
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  };

  const handleLocationCreated = (newLocation: { id: string; name: string; client_id: string }) => {
    // Add to locations list
    const updatedLocations = [...locations, newLocation];
    setLocations(updatedLocations);

    // Update the row that triggered creation
    if (pendingCreation) {
      setParsedRows(prev => prev.map(row => {
        if (row.rowNumber !== pendingCreation.rowNumber) return row;
        
        const updatedRow = {
          ...row,
          resolvedLocationId: newLocation.id,
          resolvedLocationName: newLocation.name,
          location_id: newLocation.id,
        };

        return validateRow(updatedRow, clients, updatedLocations);
      }));
    }

    setPendingCreation(null);
    queryClient.invalidateQueries({ queryKey: ["locations"] });
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
      // Fetch existing work_types
      const { data: workTypesData, error: wtError } = await supabase
        .from("work_types")
        .select("id, name, rate_type");
      
      if (wtError) throw wtError;
      
      const workTypeMap = new Map(workTypesData?.map(wt => [wt.name.toLowerCase(), wt]) || []);
      
      // Process each row
      for (const row of validRows) {
        try {
          // Find or create work_type
          let workType = workTypeMap.get(row.work_type.toLowerCase());
          
          if (!workType) {
            const { data: newWt, error: createWtError } = await supabase
              .from("work_types")
              .insert({
                name: row.work_type,
                rate_type: row.rate_type || 'per_unit',
              })
              .select()
              .single();
            
            if (createWtError) throw createWtError;
            workType = newWt;
            workTypeMap.set(row.work_type.toLowerCase(), newWt);
          }
          
          // Find or create rate_config
          const frequencyValue = row.frequency || null;
          let query = supabase
            .from("rate_configs")
            .select("id")
            .eq("client_id", row.client_id!)
            .eq("location_id", row.location_id!)
            .eq("work_type_id", workType.id);
          
          if (frequencyValue === null) {
            query = query.is("frequency", null);
          } else {
            query = query.eq("frequency", frequencyValue);
          }
          
          const { data: existingConfig, error: findError } = await query.maybeSingle();
          if (findError) throw findError;
          
          let rateConfigId: string;
          const rateValue = row.rate ? parseFloat(row.rate) : null;
          
          if (existingConfig) {
            rateConfigId = existingConfig.id;
            // Update rate if provided
            if (rateValue !== null) {
              await supabase
                .from("rate_configs")
                .update({ rate: rateValue, needs_rate_review: false })
                .eq("id", rateConfigId);
            }
          } else {
            const { data: newConfig, error: createConfigError } = await supabase
              .from("rate_configs")
              .insert({
                client_id: row.client_id!,
                location_id: row.location_id!,
                work_type_id: workType.id,
                frequency: frequencyValue,
                rate: rateValue,
                needs_rate_review: rateValue === null,
              })
              .select("id")
              .single();
            
            if (createConfigError) throw createConfigError;
            rateConfigId = newConfig.id;
          }
          
          // Create work_item
          if (row.identifier) {
            const { error: workItemError } = await supabase
              .from("work_items")
              .insert({
                rate_config_id: rateConfigId,
                identifier: row.identifier,
              });
            
            if (workItemError) throw workItemError;
          }
          
          successCount++;
        } catch (rowError) {
          console.error("Row import error:", rowError);
          failedCount++;
        }
      }

      setImportResults({ success: successCount, failed: failedCount });
      queryClient.invalidateQueries({ queryKey: ["work-items"] });
      queryClient.invalidateQueries({ queryKey: ["work-types"] });
      queryClient.invalidateQueries({ queryKey: ["rate-configs"] });

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

  // Sort rows: errors first, then warnings, then valid
  const sortedRows = [...parsedRows].sort((a, b) => {
    if (!a.isValid && b.isValid) return -1;
    if (a.isValid && !b.isValid) return 1;
    if (a.warnings.length > 0 && b.warnings.length === 0) return -1;
    if (a.warnings.length === 0 && b.warnings.length > 0) return 1;
    return a.rowNumber - b.rowNumber;
  });

  // Find bulk suggestions - group rows by their top client suggestion
  const bulkClientSuggestions = parsedRows
    .filter(r => r.clientError && r.clientSuggestions.length > 0 && !r.resolvedClientId)
    .reduce((acc, row) => {
      const topSuggestion = row.clientSuggestions[0];
      const key = `${row.client_name}→${topSuggestion.item.id}`;
      if (!acc[key]) {
        acc[key] = { suggestion: topSuggestion, originalName: row.client_name, rowNumbers: [] };
      }
      acc[key].rowNumbers.push(row.rowNumber);
      return acc;
    }, {} as Record<string, { suggestion: SimilarMatch<Client>; originalName: string; rowNumbers: number[] }>);

  const bulkLocationSuggestions = parsedRows
    .filter(r => r.locationError && r.locationSuggestions.length > 0 && !r.resolvedLocationId)
    .reduce((acc, row) => {
      const topSuggestion = row.locationSuggestions[0];
      const key = `${row.location_name}→${topSuggestion.item.id}`;
      if (!acc[key]) {
        acc[key] = { suggestion: topSuggestion, originalName: row.location_name, rowNumbers: [] };
      }
      acc[key].rowNumbers.push(row.rowNumber);
      return acc;
    }, {} as Record<string, { suggestion: SimilarMatch<Location>; originalName: string; rowNumbers: number[] }>);

  const acceptAllClientSuggestion = (suggestion: SimilarMatch<Client>, rowNumbers: number[]) => {
    setParsedRows(prev => prev.map(row => {
      if (!rowNumbers.includes(row.rowNumber)) return row;
      
      const updatedRow = {
        ...row,
        resolvedClientId: suggestion.item.id,
        resolvedClientName: suggestion.item.name,
        client_id: suggestion.item.id,
        resolvedLocationId: null,
        resolvedLocationName: null,
        location_id: null,
      };
      return validateRow(updatedRow, clients, locations);
    }));
  };

  const acceptAllLocationSuggestion = (suggestion: SimilarMatch<Location>, rowNumbers: number[]) => {
    setParsedRows(prev => prev.map(row => {
      if (!rowNumbers.includes(row.rowNumber)) return row;
      
      const updatedRow = {
        ...row,
        resolvedLocationId: suggestion.item.id,
        resolvedLocationName: suggestion.item.name,
        location_id: suggestion.item.id,
      };
      return validateRow(updatedRow, clients, locations);
    }));
  };

  const renderCellWithSuggestions = (
    row: ParsedRow,
    value: string,
    error: string | null,
    suggestions: SimilarMatch<Client | Location>[],
    resolvedName: string | null,
    onAccept: (suggestion: SimilarMatch<any>) => void,
    onCreateNew: () => void,
    type: 'client' | 'location'
  ) => {
    const hasError = error !== null;
    const isResolved = resolvedName !== null;

    return (
      <TableCell className={hasError ? "bg-destructive/10" : isResolved ? "bg-green-500/10" : ""}>
        <div className="space-y-2">
          {/* Original value */}
          <div className="flex items-center gap-2">
            <span className={hasError ? "text-destructive font-medium" : ""}>
              {value}
            </span>
            {isResolved && (
              <Badge variant="outline" className="text-xs bg-green-500/20 text-green-700 border-green-500/30">
                → {resolvedName}
              </Badge>
            )}
          </div>

          {/* Error message and suggestions */}
          {hasError && !isResolved && (
            <div className="space-y-1.5">
              <p className="text-xs text-destructive">{error}</p>
              
              {suggestions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Did you mean:</p>
                  <div className="flex flex-wrap gap-1">
                    {suggestions.map((suggestion, idx) => (
                      <TooltipProvider key={idx}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs px-2 bg-background hover:bg-green-500/20 hover:border-green-500/50"
                              onClick={() => onAccept(suggestion)}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              {suggestion.name}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {Math.round(suggestion.score * 100)}% match
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground"
                onClick={onCreateNew}
              >
                <Plus className="h-3 w-3 mr-1" />
                Create new {type}
              </Button>
            </div>
          )}
        </div>
      </TableCell>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
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
              <div className="flex items-center gap-4 text-sm">
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
                    {errorCount} need attention
                  </Badge>
                )}
                {errorCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Click suggestions below to fix issues, or create new clients/locations
                  </span>
                )}
              </div>

              {/* Bulk Accept Suggestions */}
              {(Object.keys(bulkClientSuggestions).length > 0 || Object.keys(bulkLocationSuggestions).length > 0) && (
                <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
                  <p className="text-sm font-medium">Quick Fix - Accept All Similar:</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(bulkClientSuggestions)
                      .filter(([, data]) => data.rowNumbers.length > 1)
                      .map(([key, data]) => (
                        <Button
                          key={key}
                          variant="outline"
                          size="sm"
                          className="h-auto py-1.5 px-3 text-xs bg-background hover:bg-green-500/20 hover:border-green-500/50"
                          onClick={() => acceptAllClientSuggestion(data.suggestion, data.rowNumbers)}
                        >
                          <Check className="h-3 w-3 mr-1.5" />
                          "{data.originalName}" → "{data.suggestion.name}" ({data.rowNumbers.length} rows)
                        </Button>
                      ))}
                    {Object.entries(bulkLocationSuggestions)
                      .filter(([, data]) => data.rowNumbers.length > 1)
                      .map(([key, data]) => (
                        <Button
                          key={key}
                          variant="outline"
                          size="sm"
                          className="h-auto py-1.5 px-3 text-xs bg-background hover:bg-blue-500/20 hover:border-blue-500/50"
                          onClick={() => acceptAllLocationSuggestion(data.suggestion, data.rowNumbers)}
                        >
                          <Check className="h-3 w-3 mr-1.5" />
                          "{data.originalName}" → "{data.suggestion.name}" ({data.rowNumbers.length} rows)
                        </Button>
                      ))}
                  </div>
                </div>
              )}

              <ScrollArea className="h-[400px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead className="w-16">Status</TableHead>
                      <TableHead className="min-w-[200px]">Client</TableHead>
                      <TableHead className="min-w-[200px]">Location</TableHead>
                      <TableHead>Identifier</TableHead>
                      <TableHead>Work Type</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Rate Type</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Other Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRows.map((row) => {
                      // Filter out client/location errors from general errors display
                      const otherErrors = row.errors.filter(
                        e => !e.includes('Client') && !e.includes('Location') && !e.includes('not found')
                      );
                      
                      return (
                        <TableRow
                          key={row.rowNumber}
                          className={
                            !row.isValid
                              ? "bg-destructive/5"
                              : row.warnings.length > 0
                              ? "bg-yellow-500/5"
                              : ""
                          }
                        >
                          <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
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
                          
                          {/* Client column with suggestions */}
                          {renderCellWithSuggestions(
                            row,
                            row.client_name,
                            row.clientError,
                            row.clientSuggestions,
                            row.resolvedClientName,
                            (suggestion) => acceptClientSuggestion(row.rowNumber, suggestion as SimilarMatch<Client>),
                            () => openCreateClientModal(row.rowNumber, row.client_name),
                            'client'
                          )}
                          
                          {/* Location column with suggestions */}
                          {renderCellWithSuggestions(
                            row,
                            row.location_name,
                            row.locationError,
                            row.locationSuggestions,
                            row.resolvedLocationName,
                            (suggestion) => acceptLocationSuggestion(row.rowNumber, suggestion as SimilarMatch<Location>),
                            () => openCreateLocationModal(row.rowNumber, row.location_name, row.client_id),
                            'location'
                          )}
                          
                          <TableCell>{row.identifier || "-"}</TableCell>
                          <TableCell>{row.work_type || <span className="text-destructive">Required</span>}</TableCell>
                          <TableCell>{row.frequency || "-"}</TableCell>
                          <TableCell>{row.rate_type || <span className="text-destructive">Required</span>}</TableCell>
                          <TableCell>{row.rate || "-"}</TableCell>
                          <TableCell className="max-w-xs">
                            {otherErrors.length > 0 && (
                              <span className="text-xs text-destructive">{otherErrors.join("; ")}</span>
                            )}
                            {row.warnings.length > 0 && otherErrors.length === 0 && (
                              <span className="text-xs text-yellow-600">{row.warnings.join("; ")}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
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

      {/* Inline Create Client Modal */}
      {pendingCreation?.type === 'client' && (
        <CreateClientInlineModal
          open={true}
          onOpenChange={() => setPendingCreation(null)}
          prefillName={pendingCreation.prefillName}
          onClientCreated={handleClientCreated}
        />
      )}

      {/* Inline Create Location Modal */}
      {pendingCreation?.type === 'location' && (
        <CreateLocationInlineModal
          open={true}
          onOpenChange={() => setPendingCreation(null)}
          prefillName={pendingCreation.prefillName}
          prefillClientId={pendingCreation.prefillClientId || null}
          clients={clients}
          onLocationCreated={handleLocationCreated}
        />
      )}
    </Dialog>
  );
}
