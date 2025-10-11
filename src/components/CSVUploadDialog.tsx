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

interface CSVUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (rows: CSVRow[]) => Promise<ImportResult>;
}

export function CSVUploadDialog({ open, onOpenChange, onImport }: CSVUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

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

    const text = await selectedFile.text();
    const rows = parseCSV(text);
    const validationResult = validateCSV(rows);
    setValidation(validationResult);
  };

  const handleImport = async () => {
    if (!file || !validation?.valid) return;

    setImporting(true);
    setProgress(0);

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 10, 90));
      }, 100);

      const importResult = await onImport(rows);
      
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
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Vehicles from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns: vehicle_number, type_name, home_location_name (optional)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          {validation?.valid && validation.preview.length > 0 && !result && (
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
            {!result && (
              <Button
                onClick={handleImport}
                disabled={!validation?.valid || importing}
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
