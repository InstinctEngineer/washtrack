import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface CSVRow {
  vehicle_number: string;
  type_name: string;
  home_location_name?: string;
  rate_per_wash?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  preview: CSVRow[];
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

interface TypeResolution {
  csvTypeName: string;
  action: 'create' | 'map';
  ratePerWash?: string;
  mapToTypeId?: string;
}

interface CSVUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (rows: CSVRow[], typeResolutions: TypeResolution[]) => Promise<ImportResult>;
  existingTypes: { id: string; type_name: string }[];
}

export function CSVUploadDialog({ open, onOpenChange, onImport, existingTypes }: CSVUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [missingTypes, setMissingTypes] = useState<string[]>([]);
  const [typeResolutions, setTypeResolutions] = useState<Record<string, TypeResolution>>({});
  const [showResolver, setShowResolver] = useState(false);
  const [parsedRows, setParsedRows] = useState<CSVRow[]>([]);

  const parseCSV = (text: string): CSVRow[] => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map((h) => h.trim());
    
    return lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim());
      const row: any = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      return row;
    });
  };

  const validateCSV = (rows: CSVRow[]): ValidationResult => {
    const errors: string[] = [];
    const preview = rows.slice(0, 5);

    if (!rows[0]?.vehicle_number) {
      errors.push('Missing required column: vehicle_number');
    }
    if (!rows[0]?.type_name) {
      errors.push('Missing required column: type_name');
    }

    const duplicates = new Set<string>();
    const seen = new Set<string>();
    rows.forEach((row) => {
      if (seen.has(row.vehicle_number)) {
        duplicates.add(row.vehicle_number);
      }
      seen.add(row.vehicle_number);
    });

    if (duplicates.size > 0) {
      errors.push(`Duplicate vehicle numbers in CSV: ${Array.from(duplicates).join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      preview,
    };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);
    setShowResolver(false);

    const text = await selectedFile.text();
    const rows = parseCSV(text);
    setParsedRows(rows);
    const validationResult = validateCSV(rows);
    setValidation(validationResult);

    // Check for missing types
    const uniqueTypes = new Set(rows.map(r => r.type_name));
    const missing = Array.from(uniqueTypes).filter(
      typeName => !existingTypes.some(t => t.type_name.toLowerCase() === typeName.toLowerCase())
    );
    
    setMissingTypes(missing);
    
    // Initialize resolutions
    const initialResolutions: Record<string, TypeResolution> = {};
    missing.forEach(typeName => {
      initialResolutions[typeName] = {
        csvTypeName: typeName,
        action: 'create',
        ratePerWash: '',
      };
    });
    setTypeResolutions(initialResolutions);
  };

  const handleProceedToResolve = () => {
    if (missingTypes.length > 0) {
      setShowResolver(true);
    } else {
      handleImport();
    }
  };

  const handleImport = async () => {
    if (!validation?.valid) return;

    // Validate all resolutions
    const invalidResolutions = Object.values(typeResolutions).filter(res => {
      if (res.action === 'create' && (!res.ratePerWash || parseFloat(res.ratePerWash) <= 0)) {
        return true;
      }
      if (res.action === 'map' && !res.mapToTypeId) {
        return true;
      }
      return false;
    });

    if (invalidResolutions.length > 0) {
      setResult({
        imported: 0,
        skipped: 0,
        errors: ['Please complete all type resolutions before importing.'],
      });
      return;
    }

    setImporting(true);
    setProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 10, 90));
      }, 100);

      const importResult = await onImport(parsedRows, Object.values(typeResolutions));
      
      clearInterval(progressInterval);
      setProgress(100);
      setResult(importResult);
    } catch (error) {
      console.error('Import error:', error);
      setResult({
        imported: 0,
        skipped: 0,
        errors: ['Failed to import vehicles. Please try again.'],
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setValidation(null);
    setResult(null);
    setProgress(0);
    setMissingTypes([]);
    setTypeResolutions({});
    setShowResolver(false);
    setParsedRows([]);
    onOpenChange(false);
  };

  const updateResolution = (typeName: string, updates: Partial<TypeResolution>) => {
    setTypeResolutions(prev => ({
      ...prev,
      [typeName]: { ...prev[typeName], ...updates },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Vehicles from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple vehicles at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md bg-muted p-4 space-y-3">
            <h4 className="font-medium text-sm">CSV Format Requirements:</h4>
            <ul className="text-sm space-y-2 list-disc list-inside text-muted-foreground">
              <li><strong>vehicle_number</strong> (required) - Alphanumeric with dashes/underscores only</li>
              <li><strong>type_name</strong> (required) - Must match an existing vehicle type</li>
              <li><strong>home_location_name</strong> (optional) - Must match an existing location</li>
            </ul>
            <div className="mt-3 pt-3 border-t">
              <p className="text-sm font-medium mb-2">Example CSV:</p>
              <pre className="text-xs bg-background p-2 rounded border overflow-x-auto">
{`vehicle_number,type_name,home_location_name
V-1001,Sedan,Main Facility
V-1002,SUV,North Location
V-1003,Truck,`}
              </pre>
            </div>
          </div>
          <div>
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={importing}
            />
          </div>

          {validation && !validation.valid && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside">
                  {validation.errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {validation?.valid && validation.preview.length > 0 && !result && !showResolver && (
            <div className="space-y-2">
              <h4 className="font-medium">Preview (first 5 rows):</h4>
              <div className="border rounded-md p-3 bg-muted/50 max-h-48 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Vehicle Number</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.preview.map((row, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2">{row.vehicle_number}</td>
                        <td className="p-2">{row.type_name}</td>
                        <td className="p-2">{row.home_location_name || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {missingTypes.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-1">Missing vehicle types detected:</p>
                    <p className="text-sm">{missingTypes.join(', ')}</p>
                    <p className="text-sm mt-2">Click "Continue" to resolve these types before importing.</p>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {showResolver && !result && (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium">Resolve Missing Vehicle Types</p>
                  <p className="text-sm mt-1">For each type, either create it with a rate or map it to an existing type.</p>
                </AlertDescription>
              </Alert>
              
              {missingTypes.map((typeName) => (
                <div key={typeName} className="border rounded-lg p-4 space-y-3">
                  <h4 className="font-medium text-sm">Type: "{typeName}"</h4>
                  
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        checked={typeResolutions[typeName]?.action === 'create'}
                        onChange={() => updateResolution(typeName, { action: 'create', mapToTypeId: undefined })}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-medium">Create new vehicle type</span>
                    </label>
                    
                    {typeResolutions[typeName]?.action === 'create' && (
                      <div className="ml-6 space-y-2">
                        <label className="text-sm text-muted-foreground">Rate Per Wash ($)</label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="25.00"
                          value={typeResolutions[typeName]?.ratePerWash || ''}
                          onChange={(e) => updateResolution(typeName, { ratePerWash: e.target.value })}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        checked={typeResolutions[typeName]?.action === 'map'}
                        onChange={() => updateResolution(typeName, { action: 'map', ratePerWash: undefined })}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-medium">Map to existing type</span>
                    </label>
                    
                    {typeResolutions[typeName]?.action === 'map' && (
                      <div className="ml-6">
                        <select
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={typeResolutions[typeName]?.mapToTypeId || ''}
                          onChange={(e) => updateResolution(typeName, { mapToTypeId: e.target.value })}
                        >
                          <option value="">Select existing type...</option>
                          {existingTypes.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.type_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {importing && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground text-center">Importing vehicles...</p>
            </div>
          )}

          {result && (
            <Alert variant={result.errors.length > 0 ? 'destructive' : 'default'}>
              {result.errors.length === 0 ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                <p>
                  Imported: {result.imported}, Skipped: {result.skipped}
                </p>
                {result.errors.length > 0 && (
                  <ul className="list-disc list-inside mt-2">
                    {result.errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose} disabled={importing}>
              {result ? 'Close' : 'Cancel'}
            </Button>
            {!result && !showResolver && (
              <Button
                onClick={handleProceedToResolve}
                disabled={!validation?.valid || importing}
              >
                {missingTypes.length > 0 ? 'Continue' : 'Import Vehicles'}
              </Button>
            )}
            {!result && showResolver && (
              <Button
                onClick={handleImport}
                disabled={importing}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Vehicles
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
