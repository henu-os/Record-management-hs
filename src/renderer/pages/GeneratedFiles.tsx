import React, { useEffect, useState } from 'react';
import { History, FileText, FileSpreadsheet, FolderOpen, Trash2, RefreshCw, Eye, Search, Building2, X } from 'lucide-react';
import { GenerationHistoryEntry, Society } from '../../main/types';

export default function GeneratedFiles() {
  const [history, setHistory] = useState<GenerationHistoryEntry[]>([]);
  const [activeSociety, setActiveSociety] = useState<Society | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');

  const api = (window as any).api;

  const loadData = async () => {
    setLoading(true);
    try {
      const fetchHistory = api?.history?.list ? api.history.list() : Promise.resolve([]);
      const fetchSociety = api?.society?.getActive ? api.society.getActive() : (api?.societies?.getActive ? api.societies.getActive() : Promise.resolve(null));
      const [h, soc] = await Promise.all([
        fetchHistory,
        fetchSociety,
      ]);
      setHistory(h || []);
      setActiveSociety(soc);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenPdf = (pdfPath?: string) => {
    if (pdfPath) api.system.openPath(pdfPath);
  };

  const handleOpenExcel = (excelPath?: string) => {
    if (excelPath) api.system.openPath(excelPath);
  };

  const handleShowInFolder = (filePath?: string) => {
    if (filePath) api.system.showItemInFolder(filePath);
  };

  const handlePreviewPdf = (item: GenerationHistoryEntry) => {
    const pdfUrl = (item as any).pdfUrl || (item.pdfPath ? `file:///${item.pdfPath.replace(/\\/g, '/')}` : null);
    if (pdfUrl) {
      setPreviewPdfUrl(pdfUrl);
      setPreviewTitle(`${item.formLabel} — ${item.fromSerial} to ${item.toSerial}`);
    }
  };

  const handleClearAll = async () => {
    if (!confirm(`Clear generation history for ${activeSociety?.societyName || 'active society'}?`)) return;
    await api.history.clear();
    setHistory([]);
  };

  const filteredHistory = history.filter(item => {
    const q = searchQuery.toLowerCase();
    return (
      (item.formLabel && item.formLabel.toLowerCase().includes(q)) ||
      (item.fromSerial && item.fromSerial.toLowerCase().includes(q)) ||
      (item.toSerial && item.toSerial.toLowerCase().includes(q)) ||
      (item.generatedAt && item.generatedAt.toLowerCase().includes(q))
    );
  });

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleString('en-IN'); } catch { return iso; }
  };

  return (
    <div className="page-wrapper" style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header Bar */}
      <div className="page-header flex items-center justify-between mb-20">
        <div>
          <div className="flex items-center gap-10">
            <History className="text-accent" size={24} />
            <h1 className="page-title" style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
              Generated Files & History
            </h1>
          </div>
          <p className="page-subtitle text-xs text-secondary mt-4">
            Official register generation records & consolidated PDF/Excel documents.
          </p>
        </div>

        <div className="flex items-center gap-10">
          <button className="btn btn-secondary btn-sm flex items-center gap-6" onClick={loadData}>
            <RefreshCw size={14} /> Refresh
          </button>
          {history.length > 0 && (
            <button className="btn btn-ghost btn-sm text-error flex items-center gap-6" onClick={handleClearAll}>
              <Trash2 size={14} /> Clear History
            </button>
          )}
        </div>
      </div>

      {/* Active Society Context Strip */}
      <div style={{
        background: 'var(--surface)',
        padding: '14px 20px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }} className="mb-20">
        <div className="flex items-center gap-10">
          <Building2 size={18} className="icon-accent" />
          <span className="text-xs text-secondary fw-500">Active Society Context:</span>
          <span className="fw-700 text-sm text-primary">
            {activeSociety ? activeSociety.societyName : 'Loading...'}
          </span>
          {activeSociety && (
            <span className="badge badge-accent" style={{ fontSize: 11 }}>
              {activeSociety.registrationNo}
            </span>
          )}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
          <input
            className="form-input text-xs"
            placeholder="Filter by form, range, date..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 34, height: 34 }}
          />
        </div>
      </div>

      {/* History Table Card */}
      <div className="card" style={{ padding: 16 }}>
        {loading ? (
          <div className="flex items-center justify-center" style={{ padding: 48 }}>
            <div className="spinner" />
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="empty-state" style={{ textAlign: 'center', padding: 48 }}>
            <History size={48} className="text-muted mb-12" />
            <h3 className="text-sm fw-600 mb-4">No generation history found</h3>
            <p className="text-xs text-secondary">
              {searchQuery ? 'No records match your search filter.' : 'Generate your first register form to view file history.'}
            </p>
          </div>
        ) : (
          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color, #334155)', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.5px' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>#</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Register / Form</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Record Range</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Count</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Settings</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Generated At</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((item, idx) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.05))', fontSize: 12 }}>
                    <td style={{ padding: '10px 12px' }} className="text-muted">{idx + 1}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className="fw-700 text-primary">{item.formLabel}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className="badge badge-secondary" style={{ fontSize: 11 }}>
                        {item.fromSerial} → {item.toSerial}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className="fw-600 text-success">{item.totalGenerated} records</span>
                    </td>
                    <td style={{ padding: '10px 12px' }} className="text-xs text-secondary">
                      {item.orientation || 'Portrait'} • {item.colorSetting || 'Color'} • {item.gridSetting || 'Grid ON'}
                    </td>
                    <td style={{ padding: '10px 12px' }} className="text-xs text-muted">
                      {fmtDate(item.generatedAt)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-6">
                        <button
                          className="btn btn-primary btn-xs flex items-center gap-4"
                          onClick={() => handleOpenPdf(item.pdfPath)}
                          disabled={!item.pdfPath}
                          title="Open exact generated PDF"
                          style={{ fontSize: 11, padding: '4px 8px' }}
                        >
                          <FileText size={12} /> Open PDF
                        </button>
                        {item.excelPath && (
                          <button
                            className="btn btn-secondary btn-xs flex items-center gap-4"
                            onClick={() => handleOpenExcel(item.excelPath)}
                            title="Open exact generated Excel file"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                          >
                            <FileSpreadsheet size={12} /> Open Excel
                          </button>
                        )}
                        <button
                          className="btn btn-outline btn-xs flex items-center gap-4"
                          onClick={() => handlePreviewPdf(item)}
                          disabled={!item.pdfPath}
                          title="Preview PDF"
                          style={{ fontSize: 11, padding: '4px 8px' }}
                        >
                          <Eye size={12} /> Preview
                        </button>
                        <button
                          className="btn btn-ghost btn-xs text-secondary"
                          onClick={() => handleShowInFolder(item.pdfPath || item.zipPath)}
                          title="Show in File Explorer"
                          style={{ padding: '4px 6px' }}
                        >
                          <FolderOpen size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PDF Preview Modal */}
      {previewPdfUrl && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex', flexDirection: 'column',
          zIndex: 2000, padding: 20,
        }}>
          <div style={{
            background: 'var(--bg-card, #1e293b)',
            borderRadius: '12px 12px 0 0',
            padding: '12px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-color, #334155)',
          }}>
            <div className="flex items-center gap-10">
              <FileText className="text-accent" size={20} />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                {previewTitle}
              </h3>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setPreviewPdfUrl(null)}>
              <X size={18} />
            </button>
          </div>
          <iframe
            src={previewPdfUrl}
            style={{ width: '100%', height: '100%', border: 'none', background: '#525659', borderRadius: '0 0 12px 12px' }}
            title="PDF Preview"
          />
        </div>
      )}
    </div>
  );
}
