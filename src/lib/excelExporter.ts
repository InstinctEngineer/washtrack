import * as XLSX from 'xlsx';

export function exportToExcel(data: any[], filename: string, sheetName: string = 'Report') {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  // Create worksheet from data
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Calculate column widths based on content
  const columnWidths: { wch: number }[] = [];
  const headers = Object.keys(data[0]);
  
  headers.forEach((header, index) => {
    let maxWidth = header.length;
    data.forEach(row => {
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
        fill: { fgColor: { rgb: 'CCCCCC' } }
      };
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
