import * as XLSX from 'xlsx';

export interface ExcelExportOptions {
  addSumRow?: boolean;
  sumColumns?: string[];
}

export function exportToExcel(
  data: any[], 
  filename: string, 
  sheetName: string = 'Report',
  options: ExcelExportOptions = {}
) {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  const headers = Object.keys(data[0]);
  
  // Add sum row if requested
  let exportData = [...data];
  if (options.addSumRow && options.sumColumns && options.sumColumns.length > 0) {
    const sumRow: any = {};
    
    headers.forEach(header => {
      if (options.sumColumns!.includes(header)) {
        // Calculate sum for numeric columns
        const sum = data.reduce((acc, row) => {
          const value = parseFloat(row[header]) || 0;
          return acc + value;
        }, 0);
        sumRow[header] = sum.toFixed(2);
      } else if (header === headers[0]) {
        // First column shows "TOTAL"
        sumRow[header] = 'TOTAL';
      } else {
        sumRow[header] = '';
      }
    });
    
    exportData.push(sumRow);
  }

  // Create worksheet from data
  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Calculate column widths based on content
  const columnWidths: { wch: number }[] = [];
  
  headers.forEach((header) => {
    let maxWidth = header.length;
    exportData.forEach(row => {
      const value = String(row[header] || '');
      maxWidth = Math.max(maxWidth, value.length);
    });
    columnWidths.push({ wch: Math.min(maxWidth + 2, 50) }); // Cap at 50 characters
  });
  
  worksheet['!cols'] = columnWidths;

  // Style headers (bold)
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (worksheet[cellAddress]) {
      worksheet[cellAddress].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: 'E2E8F0' } },
        alignment: { horizontal: 'center' }
      };
    }
  }

  // Style sum row if exists
  if (options.addSumRow && exportData.length > data.length) {
    const sumRowIndex = exportData.length - 1;
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: sumRowIndex + 1, c: col });
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: 'FEF3C7' } }
        };
      }
    }
  }

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const fullFilename = `${filename}_${timestamp}.xlsx`;

  // Download file
  XLSX.writeFile(workbook, fullFilename);
  
  return fullFilename;
}
