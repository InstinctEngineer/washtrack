import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, FileSpreadsheet } from 'lucide-react';
import { ReportConfig, UNIFIED_COLUMNS } from '@/lib/reportBuilder';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface LiveReportPreviewProps {
  config: ReportConfig;
  onExport: () => void;
  isExporting: boolean;
}

export function LiveReportPreview({ config, onExport, isExporting }: LiveReportPreviewProps) {
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [reportType, setReportType] = useState<'detail' | 'aggregated' | 'mixed'>('detail');

  useEffect(() => {
    if (config.columns.length === 0) {
      setPreviewData([]);
      setTotalCount(0);
      return;
    }

    const fetchPreview = async () => {
      setIsLoading(true);
      try {
        // Dynamically import the preview function
        const { generateReportPreview } = await import('@/lib/reportBuilder');
        const result = await generateReportPreview(config, 20);
        setPreviewData(result.data);
        setTotalCount(result.totalCount);
        setReportType(result.reportType);
      } catch (error) {
        console.error('Error fetching preview:', error);
        setPreviewData([]);
        setTotalCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce the fetch
    const timer = setTimeout(fetchPreview, 500);
    return () => clearTimeout(timer);
  }, [config]);

  // Detect report type from columns
  const hasAggregateFields = config.columns.some(col =>
    UNIFIED_COLUMNS.find(c => c.id === col)?.isAggregate
  );
  const hasDetailFields = config.columns.some(col =>
    !UNIFIED_COLUMNS.find(c => c.id === col)?.isAggregate
  );
  const isMixed = hasAggregateFields && hasDetailFields;

  const getReportTypeLabel = () => {
    if (isMixed) return 'Mixed Report';
    if (hasAggregateFields) return 'Aggregated Report';
    return 'Detail Report';
  };

  return (
    <div className="flex flex-col h-full border-l bg-background">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Live Preview</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isLoading ? (
                'Loading preview...'
              ) : previewData.length > 0 ? (
                <>Showing {previewData.length} of {totalCount} rows</>
              ) : (
                'Select columns to see preview'
              )}
            </p>
          </div>
          <Badge variant={isMixed ? "outline" : (hasAggregateFields ? "secondary" : "default")}>
            {getReportTypeLabel()}
          </Badge>
        </div>
        
        <Button
          onClick={onExport}
          disabled={previewData.length === 0 || isExporting}
          className="w-full"
          size="sm"
        >
          {isExporting ? (
            <>Exporting...</>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Export to Excel ({totalCount} rows)
            </>
          )}
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {config.columns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <FileSpreadsheet className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm">Select columns from the left to build your report</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            {[...Array(15)].map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : previewData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <p className="text-sm">No data matches the selected filters</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {config.columns.map(colId => {
                  const col = UNIFIED_COLUMNS.find(c => c.id === colId);
                  return col ? (
                    <TableHead key={colId} className="whitespace-nowrap">
                      {col.label}
                    </TableHead>
                  ) : null;
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewData.map((row, idx) => (
                <TableRow key={idx}>
                  {config.columns.map(colId => (
                    <TableCell key={colId} className="text-sm">
                      {row[colId] !== null && row[colId] !== undefined
                        ? String(row[colId])
                        : '-'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
