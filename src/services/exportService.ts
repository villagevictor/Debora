/**
 * Enterprise Data Export Service for STOREMAN ERP
 * Exports table data to CSV, Excel format, and triggers formatted print/PDF.
 */

class ExportService {
  /**
   * Generates and downloads a clean CSV file from arbitrary structured objects.
   */
  exportToCSV(filename: string, rows: Record<string, unknown>[], headers?: string[]): void {
    if (!rows || rows.length === 0) {
      alert('No records available to export.');
      return;
    }

    const keys = headers || Object.keys(rows[0]);
    const csvContent: string[] = [];

    // Header row
    csvContent.push(keys.map((k) => `"${k.replace(/"/g, '""')}"`).join(','));

    // Data rows
    for (const row of rows) {
      const line = keys.map((k) => {
        const val = row[k];
        if (val === null || val === undefined) return '""';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      });
      csvContent.push(line.join(','));
    }

    const blob = new Blob([csvContent.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Generates an Excel-compatible spreadsheet file.
   */
  exportToExcel(filename: string, rows: Record<string, unknown>[], headers?: string[]): void {
    if (!rows || rows.length === 0) {
      alert('No records available to export.');
      return;
    }

    const keys = headers || Object.keys(rows[0]);
    let tableXml = '<html><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>';

    keys.forEach((k) => {
      tableXml += `<th style="background-color: #1e293b; color: white;">${k}</th>`;
    });
    tableXml += '</tr></thead><tbody>';

    rows.forEach((row) => {
      tableXml += '<tr>';
      keys.forEach((k) => {
        const val = row[k];
        tableXml += `<td>${val === null || val === undefined ? '' : String(val)}</td>`;
      });
      tableXml += '</tr>';
    });

    tableXml += '</tbody></table></body></html>';

    const blob = new Blob([tableXml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Generates and downloads a formatted JSON file from structured data.
   */
  exportToJSON(filename: string, data: unknown): void {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Opens clean printer dialogue with print-friendly layout.
   */
  printReport(title: string, printableElementId?: string): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }
}

export const exportService = new ExportService();
