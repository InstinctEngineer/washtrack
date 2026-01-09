import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download } from 'lucide-react';

interface CSVPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headers: string[];
  rows: string[][];
  onExport: () => void;
}

export function CSVPreviewModal({ open, onOpenChange, headers, rows, onExport }: CSVPreviewModalProps) {
  const previewRows = rows.slice(0, 20);
  const hasMoreRows = rows.length > 20;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>CSV Preview (First 20 Rows)</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] border rounded-lg">
          <div className="overflow-x-auto">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {headers.map((header, i) => (
                    <TableHead key={i} className="whitespace-nowrap font-mono text-xs">
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <TableCell key={cellIndex} className="whitespace-nowrap font-mono text-xs">
                        {cell || '—'}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>

        {hasMoreRows && (
          <p className="text-sm text-muted-foreground text-center">
            Showing 20 of {rows.length} rows. Full export will include all rows.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV ({rows.length} rows)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
