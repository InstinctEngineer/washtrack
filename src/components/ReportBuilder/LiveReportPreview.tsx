import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';
import { ReportConfig, UNIFIED_COLUMNS } from '@/lib/reportBuilder';
import { cn } from '@/lib/utils';

interface LiveReportPreviewProps {
  config: ReportConfig;
  onExport: () => void;
  isExporting: boolean;
}

const ROWS_PER_PAGE = 20;

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
  const totalPages = Math.ceil(displayData.length / ROWS_PER_PAGE);
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = startIndex + ROWS_PER_PAGE;
  const paginatedData = displayData.slice(startIndex, endIndex);

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
      <div className="flex-1 overflow-auto">
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
          <div className="font-mono text-[11px] min-w-max">
            {/* Column Letters Row */}
            <div className="flex sticky top-0 z-10 bg-gray-100 border-b border-gray-300">
              <div className="w-8 min-w-[32px] bg-gray-100 border-r border-gray-300" />
              {config.columns.map((_, idx) => (
                <div
                  key={idx}
                  className="min-w-[90px] flex-1 bg-gray-100 border-r border-gray-300 text-center py-0.5 font-semibold text-gray-500"
                >
                  {getColumnLetter(idx)}
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
                    className="min-w-[90px] flex-1 bg-gray-200 border-r border-gray-300 px-1 py-0.5 font-semibold text-gray-800 truncate"
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

              return (
                <div
                  key={idx}
                  className={cn(
                    "flex border-b border-gray-200",
                    rowStyle === 'total' && "bg-amber-100 font-bold",
                    rowStyle === 'summary-header' && "bg-gray-100 font-semibold italic",
                    rowStyle === 'separator' && "bg-gray-50",
                    rowStyle === 'summary-row' && "bg-amber-50",
                    rowStyle === 'normal' && "bg-white hover:bg-blue-50/30"
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
                          "min-w-[90px] flex-1 border-r border-gray-200 px-1 py-0.5 truncate",
                          rowStyle === 'total' && "border-gray-300"
                        )}
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
      {displayData.length > ROWS_PER_PAGE && (
        <div className="px-2 py-1.5 border-t bg-gray-50 flex items-center justify-between text-[10px] text-gray-600">
          <span>
            Rows {startIndex + 1}-{Math.min(endIndex, displayData.length)} of {displayData.length}
          </span>
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
