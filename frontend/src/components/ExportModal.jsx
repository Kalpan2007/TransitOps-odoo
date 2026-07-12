import React from 'react';
import { Download, FileText, FileSpreadsheet, X } from 'lucide-react';

/**
 * ExportModal — Popup with CSV and PDF export options.
 * @param {boolean} open - Show/hide
 * @param {function} onClose - Close handler
 * @param {function} onCsv - CSV export handler
 * @param {function} onPdf - PDF export handler
 * @param {string} title - Export context title (e.g. "Vehicles")
 * @param {number} rowCount - Number of rows being exported
 */
const ExportModal = ({ open, onClose, onCsv, onPdf, title = 'Data', rowCount = 0 }) => {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: 'var(--overlay)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: 'var(--border-radius)', width: '420px', maxHeight: '90vh', overflowY: 'auto'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '2px',
              backgroundColor: 'var(--accent-bg-strong)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent-color)'
            }}>
              <Download size={16} />
            </div>
            <div>
              <h3 style={{
                fontSize: '15px', fontWeight: '600', fontFamily: 'var(--font-title)',
                color: 'var(--text-main)', margin: 0
              }}>Export {title}</h3>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {rowCount} row{rowCount !== 1 ? 's' : ''} will be exported
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: '4px', display: 'flex'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Export Options */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* CSV Option */}
          <button
            onClick={() => { onCsv(); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '16px', backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)',
              cursor: 'pointer', textAlign: 'left', width: '100%',
              transition: 'border-color 0.2s, background-color 0.2s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--success-text)';
              e.currentTarget.style.backgroundColor = 'var(--success-bg-soft)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.backgroundColor = 'var(--bg-main)';
            }}
          >
            <div style={{
              width: '44px', height: '44px', borderRadius: '2px',
              backgroundColor: 'var(--success-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--success-text)', flexShrink: 0
            }}>
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)', fontFamily: 'var(--font-title)' }}>
                Export as CSV
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Spreadsheet format — open in Excel, Google Sheets
              </div>
            </div>
          </button>

          {/* PDF Option */}
          <button
            onClick={() => { onPdf(); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '16px', backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)',
              cursor: 'pointer', textAlign: 'left', width: '100%',
              transition: 'border-color 0.2s, background-color 0.2s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--error-text)';
              e.currentTarget.style.backgroundColor = 'var(--error-bg-soft)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.backgroundColor = 'var(--bg-main)';
            }}
          >
            <div style={{
              width: '44px', height: '44px', borderRadius: '2px',
              backgroundColor: 'var(--error-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--error-text)', flexShrink: 0
            }}>
              <FileText size={22} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)', fontFamily: 'var(--font-title)' }}>
                Export as PDF
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Print-ready document — opens print dialog
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
