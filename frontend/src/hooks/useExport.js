import { useCallback } from 'react';

/**
 * useExport — Hook for generating CSV and PDF exports from tabular data.
 *
 * @param {Object} options
 * @param {string} options.title - Export title (used in filename and PDF header)
 * @param {Array<{ key: string, label: string }>} options.columns - Column definitions
 * @param {Array<Object>} options.data - Row data
 * @param {string} [options.filename] - Custom filename (without extension)
 * @param {string} [options.subtitle] - Optional subtitle (e.g. date range)
 * @param {Array} [options.summaryItems] - Optional summary stats [{ label, value }]
 *
 * @returns {{ exportCsv: function, exportPdf: function }}
 */
const useExport = ({ title = 'Export', columns = [], data = [], filename, subtitle = '', summaryItems = [] }) => {
  const safeName = filename || title.toLowerCase().replace(/\s+/g, '_');
  const timestamp = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const recordCount = data.length;

  // ─── CSV EXPORT ──────────────────────────────────
  const exportCsv = useCallback(() => {
    if (!data.length) return;

    const escape = (val) => {
      const str = val === null || val === undefined ? '' : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = columns.map(c => escape(c.label)).join(',');
    const rows = data.map(row =>
      columns.map(c => escape(row[c.key])).join(',')
    );

    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}_${timestamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [data, columns, safeName, timestamp]);

  // ─── PDF EXPORT ──────────────────────────────────
  const exportPdf = useCallback(() => {
    if (!data.length) return;

    // Calculate column widths — give wider columns to wider data
    const colWidths = columns.map(() => `${100 / columns.length}%`);

    // Build table rows with proper formatting
    const tableRows = data.map((row, rowIdx) => {
      const cells = columns.map((c, colIdx) => {
        let val = row[c.key];
        if (val === null || val === undefined) val = '—';
        else val = String(val);

        // Right-align numeric-looking values
        const cleaned = val.replace(/[₹,%.\s]/g, '');
        const isNumeric = /^\d+\.?\d*$/.test(cleaned);
        const align = isNumeric ? 'right' : 'left';

        return `<td style="
          padding: 7px 10px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 10.5px;
          color: #374151;
          text-align: ${align};
          ${colIdx === 0 ? 'font-weight: 600; color: #111827;' : ''}
          ${colIdx === columns.length - 1 ? 'font-weight: 600;' : ''}
        ">${val}</td>`;
      }).join('');

      return `<tr style="${rowIdx % 2 === 0 ? '' : 'background: #f9fafb;'}">${cells}</tr>`;
    }).join('');

    // Build summary stats HTML
    const summaryHtml = summaryItems.length > 0 ? `
      <div style="
        display: flex; gap: 0; margin: 20px 0 24px;
        border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;
      ">
        ${summaryItems.map((item, i) => `
          <div style="
            flex: 1; padding: 12px 16px;
            ${i > 0 ? 'border-left: 1px solid #e5e7eb;' : ''}
            text-align: center;
          ">
            <div style="font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600; margin-bottom: 4px;">
              ${item.label}
            </div>
            <div style="font-size: 18px; font-weight: 700; color: #111827;">
              ${item.value}
            </div>
          </div>
        `).join('')}
      </div>
    ` : '';

    // Compute table summary
    const totalPages = Math.ceil(recordCount / 50) || 1;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — TransitOps Report</title>
<style>
  @page {
    size: landscape;
    margin: 12mm 15mm 18mm 15mm;
  }
  @media print {
    body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
    color: #1f2937;
    background: #ffffff;
    font-size: 11px;
    line-height: 1.5;
  }

  /* ── Page Container ── */
  .page {
    padding: 0;
    max-width: 100%;
  }

  /* ── Header ── */
  .report-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 16px;
    border-bottom: 3px solid #714B67;
    margin-bottom: 20px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .brand-icon {
    width: 42px; height: 42px;
    background: linear-gradient(135deg, #714B67 0%, #5A3B52 100%);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 800;
    font-size: 16px;
    letter-spacing: 1px;
  }
  .brand-text h1 {
    font-size: 20px;
    font-weight: 700;
    color: #111827;
    line-height: 1.2;
  }
  .brand-text .tagline {
    font-size: 10px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    font-weight: 500;
    margin-top: 2px;
  }
  .header-meta {
    text-align: right;
  }
  .header-meta .date {
    font-size: 11px;
    color: #374151;
    font-weight: 600;
  }
  .header-meta .time {
    font-size: 10px;
    color: #6b7280;
    margin-top: 2px;
  }
  .header-meta .ref {
    font-size: 9px;
    color: #9ca3af;
    margin-top: 4px;
    font-family: 'Courier New', monospace;
    letter-spacing: 0.5px;
  }

  /* ── Report Title Bar ── */
  .title-bar {
    background: #f3f4f6;
    border-left: 4px solid #714B67;
    padding: 12px 16px;
    margin-bottom: 20px;
    border-radius: 0 4px 4px 0;
  }
  .title-bar h2 {
    font-size: 16px;
    font-weight: 700;
    color: #111827;
  }
  .title-bar .subtitle {
    font-size: 11px;
    color: #6b7280;
    margin-top: 2px;
  }

  /* ── Table ── */
  .data-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 0;
  }
  .data-table thead th {
    background: #1f2937;
    color: #ffffff;
    font-size: 9.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    padding: 10px 12px;
    text-align: left;
    border: none;
    white-space: nowrap;
  }
  .data-table thead th:first-child {
    border-radius: 4px 0 0 0;
  }
  .data-table thead th:last-child {
    border-radius: 0 4px 0 0;
  }
  .data-table tbody tr {
    border-bottom: 1px solid #e5e7eb;
  }
  .data-table tbody tr:nth-child(even) {
    background: #f9fafb;
  }
  .data-table tbody tr:hover {
    background: #f3f4f6;
  }
  .data-table tbody td {
    padding: 7px 12px;
    font-size: 10.5px;
    color: #374151;
    vertical-align: middle;
  }
  .data-table tbody td:first-child {
    font-weight: 600;
    color: #111827;
  }

  /* ── Footer ── */
  .report-footer {
    margin-top: 24px;
    padding-top: 12px;
    border-top: 2px solid #e5e7eb;
  }
  .footer-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 12px;
  }
  .footer-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 4px 10px;
    font-size: 9px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-weight: 600;
  }
  .footer-badge .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #16A34A;
  }
  .footer-stats {
    font-size: 10px;
    color: #6b7280;
  }
  .footer-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 8px;
    border-top: 1px solid #e5e7eb;
  }
  .footer-bottom .left {
    font-size: 9px;
    color: #9ca3af;
  }
  .footer-bottom .right {
    font-size: 9px;
    color: #9ca3af;
    font-family: 'Courier New', monospace;
  }
  .confidential {
    font-size: 8px;
    color: #d1d5db;
    text-align: center;
    margin-top: 8px;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  /* ── Print Adjustments ── */
  @media print {
    .data-table thead th {
      background: #1f2937 !important;
      color: #ffffff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .data-table tbody tr:nth-child(even) {
      background: #f9fafb !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .title-bar {
      background: #f3f4f6 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .footer-badge {
      background: #f3f4f6 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .brand-icon {
      background: #714B67 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
</style>
</head>
<body>
  <div class="page">

    <!-- ═══ HEADER ═══ -->
    <div class="report-header">
      <div class="brand">
        <div class="brand-icon">TO</div>
        <div class="brand-text">
          <h1>TransitOps</h1>
          <div class="tagline">Smart Transport Operations Platform</div>
        </div>
      </div>
      <div class="header-meta">
        <div class="date">${dateStr}</div>
        <div class="time">${timeStr}</div>
        <div class="ref">RPT-${safeName.toUpperCase().slice(0, 3)}-${timestamp.replace(/-/g, '')}</div>
      </div>
    </div>

    <!-- ═══ TITLE BAR ═══ -->
    <div class="title-bar">
      <h2>${title}</h2>
      ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
    </div>

    <!-- ═══ SUMMARY STATS ═══ -->
    ${summaryHtml}

    <!-- ═══ DATA TABLE ═══ -->
    <table class="data-table">
      <thead>
        <tr>
          ${columns.map((c, i) => `<th style="${i === 0 ? 'padding-left: 16px;' : ''}${i === columns.length - 1 ? 'padding-right: 16px;' : ''}">${c.label}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <!-- ═══ FOOTER ═══ -->
    <div class="report-footer">
      <div class="footer-top">
        <div class="footer-badge">
          <span class="dot"></span>
          Generated Report
        </div>
        <div class="footer-stats">
          Total Records: <strong>${recordCount}</strong>
          ${summaryItems.length > 0 ? ` &nbsp;·&nbsp; Summary Metrics: <strong>${summaryItems.length}</strong>` : ''}
        </div>
      </div>
      <div class="footer-bottom">
        <div class="left">
          TransitOps — Smart Transport Operations Platform &nbsp;|&nbsp; Confidential
        </div>
        <div class="right">
          ${timestamp} &nbsp;|&nbsp; Page 1 of ${totalPages}
        </div>
      </div>
      <div class="confidential">
        — End of Report —
      </div>
    </div>

  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=1280,height=900');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); }, 500);
    }
  }, [data, columns, title, safeName, timestamp, summaryItems, recordCount, dateStr, timeStr]);

  return { exportCsv, exportPdf };
};

export default useExport;
