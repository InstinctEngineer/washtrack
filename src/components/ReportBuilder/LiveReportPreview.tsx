import { useEffect, useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';
import { ReportConfig, UNIFIED_COLUMNS } from '@/lib/reportBuilder';
import { cn } from '@/lib/utils';

interface LiveReportPreviewProps {
  config: ReportConfig;
  onExport: () => void;
  isExporting: boolean;
}

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];
const DEFAULT_COL_WIDTH = 100;
const MIN_COL_WIDTH = 50;

// Convert column index to Excel-style letter (A, B, C, ... Z, AA, AB...)
const getColumnLetter = (index: number): string => {
  let letter = '';
  let i = index;
  while (i >= 0) {
    letter = String.fromCharCode((i % 26) + 65) + letter;
    i = Math.floor(i / 26) - 1;
  }
  return letter;
};

// Columns that should be summed in TOTAL row
const SUM_COLUMNS = ['total_washes', 'total_revenue', 'avg_wash_value', 'rate_at_time_of_wash', 'locations_serviced'];

export function LiveReportPreview({ config, onExport, isExporting }: LiveReportPreviewProps) {
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [reportType, setReportType] = useState<'detail' | 'aggregated' | 'mixed'>('detail');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  
  // Column resize state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizing, setResizing] = useState<{ colId: string; startX: number; startWidth: number } | null>(null);

  const getColumnWidth = useCallback((colId: string) => columnWidths[colId] || DEFAULT_COL_WIDTH, [columnWidths]);

  // Handle resize events
  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizing.startX;
      const newWidth = Math.max(MIN_COL_WIDTH, resizing.startWidth + delta);
      setColumnWidths(prev => ({ ...prev, [resizing.colId]: newWidth }));
    };

    const handleMouseUp = () => setResizing(null);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

  const handleResizeStart = (e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    setResizing({ colId, startX: e.clientX, startWidth: getColumnWidth(colId) });
  };

  useEffect(() => {
    if (config.columns.length === 0) {
      setPreviewData([]);
      setTotalCount(0);
      return;
    }

    const fetchPreview = async () => {
      setIsLoading(true);
      setCurrentPage(1);
      try {
        const { generateReportPreview } = await import('@/lib/reportBuilder');
        const result = await generateReportPreview(config, 100);
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

    const timer = setTimeout(fetchPreview, 500);
    return () => clearTimeout(timer);
  }, [config]);

  // Build display data with TOTAL row
  const { displayData, summaryStartIndex } = useMemo(() => {
    if (previewData.length === 0) return { displayData: [], summaryStartIndex: -1 };

    // Find where summary section starts (look for separator row)
    let summaryIdx = previewData.findIndex(row => {
      const firstCol = config.columns[0];
      return row[firstCol] === '--- SUMMARY ---' || row[firstCol] === '';
    });

    // Check if we have aggregate columns that need a TOTAL row
    const hasAggregateColumns = config.columns.some(col => SUM_COLUMNS.includes(col));
    
    if (!hasAggregateColumns) {
      return { displayData: previewData, summaryStartIndex: summaryIdx };
    }

    // Find summary data rows (after the separator)
    let summaryRows: any[] = [];
    if (summaryIdx !== -1) {
      summaryRows = previewData.slice(summaryIdx + 2).filter(row => {
        const firstVal = row[config.columns[0]];
        return firstVal && firstVal !== '--- SUMMARY ---' && firstVal !== '';
      });
    }

    // Build TOTAL row
    const totalRow: any = {};
    const dataToSum = summaryRows.length > 0 ? summaryRows : previewData.filter(row => {
      const firstVal = row[config.columns[0]];
      return firstVal && firstVal !== '--- SUMMARY ---' && firstVal !== '';
    });

    config.columns.forEach((col, idx) => {
      if (SUM_COLUMNS.includes(col)) {
        const sum = dataToSum.reduce((acc, row) => {
          const val = parseFloat(row[col]);
          return acc + (isNaN(val) ? 0 : val);
        }, 0);
        totalRow[col] = col === 'total_washes' || col === 'locations_serviced' 
          ? sum.toString() 
          : sum.toFixed(2);
      } else if (idx === 0) {
        totalRow[col] = 'TOTAL';
      } else {
        totalRow[col] = '';
      }
    });

    return {
      displayData: [...previewData, totalRow],
      summaryStartIndex: summaryIdx
    };
  }, [previewData, config.columns]);

  // Pagination
  const totalPages = Math.ceil(displayData.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedData = displayData.slice(startIndex, endIndex);

  const handlePageSizeChange = (value: string) => {
    setRowsPerPage(Number(value));
    setCurrentPage(1);
  };

  const hasAggregateFields = config.columns.some(col =>
    UNIFIED_COLUMNS.find(c => c.id === col)?.isAggregate
  );
  const hasDetailFields = config.columns.some(col =>
    !UNIFIED_COLUMNS.find(c => c.id === col)?.isAggregate
  );
  const isMixed = hasAggregateFields && hasDetailFields;

  const getReportTypeLabel = () => {
    if (isMixed) return 'Mixed';
    if (hasAggregateFields) return 'Aggregated';
    return 'Detail';
  };

  // Determine row styling
  const getRowStyle = (row: any, absoluteIndex: number) => {
    const firstCol = config.columns[0];
    const firstVal = row[firstCol];
    
    if (firstVal === 'TOTAL') return 'total';
    if (firstVal === '--- SUMMARY ---') return 'summary-header';
    if (firstVal === '' && summaryStartIndex !== -1 && absoluteIndex === summaryStartIndex) return 'separator';
    if (summaryStartIndex !== -1 && absoluteIndex > summaryStartIndex + 1 && firstVal !== 'TOTAL') return 'summary-row';
    return 'normal';
  };

  return (
    <div className="flex flex-col h-full border-l bg-white">
      {/* Header */}
      <div className="p-3 border-b bg-gray-50 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-gray-700">Excel Preview</h3>
            <p className="text-[10px] text-gray-500">
              {isLoading ? 'Loading...' : previewData.length > 0 ? `${totalCount} rows` : 'Select columns'}
            </p>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">
            {getReportTypeLabel()}
          </span>
        </div>
        
        <Button
          onClick={onExport}
          disabled={previewData.length === 0 || isExporting}
          className="w-full h-7 text-xs"
          size="sm"
        >
          {isExporting ? 'Exporting...' : (
            <>
              <Download className="h-3 w-3 mr-1.5" />
              Export ({totalCount})
            </>
          )}
        </Button>
      </div>

      {/* Excel-style Grid */}
      <div className={cn("flex-1 overflow-auto", resizing && "select-none cursor-col-resize")}>
        {config.columns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
            <FileSpreadsheet className="h-10 w-10 mb-2 opacity-20" />
            <p className="text-xs">Select columns to preview</p>
          </div>
        ) : isLoading ? (
          <div className="p-3 space-y-1">
            <Skeleton className="h-6 w-full" />
            {[...Array(12)].map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : displayData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-xs">No data matches filters</p>
          </div>
        ) : (
          <div className="font-mono text-[11px]">
            {/* Column Letters Row */}
            <div className="flex sticky top-0 z-10 bg-gray-100 border-b border-gray-300">
              <div className="w-8 min-w-[32px] bg-gray-100 border-r border-gray-300" />
              {config.columns.map((colId, idx) => (
                <div
                  key={idx}
                  className="relative bg-gray-100 border-r border-gray-300 text-center py-0.5 font-semibold text-gray-500"
                  style={{ width: getColumnWidth(colId), minWidth: MIN_COL_WIDTH }}
                >
                  {getColumnLetter(idx)}
                  {/* Resize handle */}
                  <div
                    className={cn(
                      "absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/50 transition-colors",
                      resizing?.colId === colId && "bg-blue-500"
                    )}
                    onMouseDown={(e) => handleResizeStart(e, colId)}
                  />
                </div>
              ))}
            </div>

            {/* Header Row (Row 1) */}
            <div className="flex sticky top-[21px] z-10 bg-gray-200 border-b border-gray-300">
              <div className="w-8 min-w-[32px] bg-gray-200 border-r border-gray-300 text-right pr-1 py-0.5 font-semibold text-gray-600">
                1
              </div>
              {config.columns.map(colId => {
                const col = UNIFIED_COLUMNS.find(c => c.id === colId);
                return (
                  <div
                    key={colId}
                    className="bg-gray-200 border-r border-gray-300 px-1 py-0.5 font-semibold text-gray-800 truncate"
                    style={{ width: getColumnWidth(colId), minWidth: MIN_COL_WIDTH }}
                    title={col?.label}
                  >
                    {col?.label}
                  </div>
                );
              })}
            </div>

            {/* Data Rows */}
            {paginatedData.map((row, idx) => {
              const absoluteIndex = startIndex + idx;
              const rowStyle = getRowStyle(row, absoluteIndex);
              const rowNumber = absoluteIndex + 2; // +2 because row 1 is header
              const isEvenRow = idx % 2 === 0;

              return (
                <div
                  key={idx}
                  className={cn(
                    "flex border-b border-gray-200",
                    rowStyle === 'total' && "bg-amber-100 font-bold",
                    rowStyle === 'summary-header' && "bg-gray-100 font-semibold italic",
                    rowStyle === 'separator' && "bg-gray-50",
                    rowStyle === 'summary-row' && "bg-amber-50",
                    // Zebra striping for normal rows
                    rowStyle === 'normal' && (isEvenRow ? "bg-white" : "bg-gray-50/80"),
                    rowStyle === 'normal' && "hover:bg-blue-50/50"
                  )}
                >
                  <div className="w-8 min-w-[32px] bg-gray-100 border-r border-gray-300 text-right pr-1 py-0.5 text-gray-500">
                    {rowNumber}
                  </div>
                  {config.columns.map(colId => {
                    const value = row[colId];
                    const displayValue = value !== null && value !== undefined ? String(value) : '';
                    
                    return (
                      <div
                        key={colId}
                        className={cn(
                          "border-r border-gray-200 px-1 py-0.5 truncate",
                          rowStyle === 'total' && "border-gray-300"
                        )}
                        style={{ width: getColumnWidth(colId), minWidth: MIN_COL_WIDTH }}
                        title={displayValue}
                      >
                        {displayValue}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination - Excel-style footer */}
      {displayData.length > 0 && (
        <div className="px-2 py-1.5 border-t bg-gray-50 flex items-center justify-between text-[10px] text-gray-600">
          <div className="flex items-center gap-2">
            <span>
              Rows {startIndex + 1}-{Math.min(endIndex, displayData.length)} of {displayData.length}
            </span>
            <Select value={rowsPerPage.toString()} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="h-5 w-16 text-[10px] px-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map(size => (
                  <SelectItem key={size} value={size.toString()} className="text-xs">
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="px-1">{currentPage}/{totalPages}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
