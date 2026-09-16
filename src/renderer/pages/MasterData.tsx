import React, { useState, useCallback, useEffect } from 'react';
import {
  Download, Upload, CheckCircle, AlertTriangle, FileSpreadsheet, Trash2, Lock, Unlock, Database, Edit3
} from 'lucide-react';
import { ModuleId, FoundationStatus, MasterDataStatus } from '../../main/types';
import EditDataModal from '../components/EditDataModal';
import SpreadsheetEditor from '../components/SpreadsheetEditor';

export default function MasterData() {
  const [status, setStatus] = useState<MasterDataStatus | null>(null);
  const [foundationStatus, setFoundationStatus] = useState<FoundationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingModule, setProcessingModule] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [activeEditModule, setActiveEditModule] = useState<ModuleId | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const api = (window as any).api;

  const loadAllStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [s, f] = await Promise.all([
        api.masterData.getStatus(),
        api.foundation?.getStatus() || Promise.resolve(null),
      ]);
      setStatus(s);
      setFoundationStatus(f);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllStatus();
    const handleSocChange = () => {
      loadAllStatus();
    };
    window.addEventListener('society-changed', handleSocChange);
    return () => window.removeEventListener('society-changed', handleSocChange);
  }, [loadAllStatus]);

  // Master Workbook Actions
  const handleDownloadMasterTemplate = async () => {
    setProcessingModule('master_download');
    setMessage(null);
    try {
      const filePath = await api.masterData.downloadMasterTemplate();
      if (filePath) setMessage({ type: 'success', text: `Master template saved to: ${filePath}` });
    } catch (err: any) {
      setMessage({ type: 'error', text: `Master download failed: ${err.message}` });
    } finally { setProcessingModule(null); }
  };

  const handleImportMaster = async () => {
    setProcessingModule('master_import');
    setMessage(null);
    try {
      const result = await api.masterData.upload();
      if (result) {
        setStatus(result);
        await loadAllStatus();
        setMessage({
          type: result.isValid ? 'success' : 'error',
          text: result.isValid
            ? `Successfully imported master workbook "${result.fileName}"`
            : `Imported with ${result.validationErrors.length} error(s).`,
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: `Master import failed: ${err.message}` });
    } finally { setProcessingModule(null); }
  };

  const handleExportMaster = async () => {
    setProcessingModule('master_export');
    setMessage(null);
    try {
      const filePath = await api.masterData.exportMaster();
      if (filePath) setMessage({ type: 'success', text: `Master exported to: ${filePath}` });
    } catch (err: any) {
      setMessage({ type: 'error', text: `Master export failed: ${err.message}` });
    } finally { setProcessingModule(null); }
  };

  // Individual Module Actions
  const handleDownloadModuleTemplate = async (moduleId: ModuleId) => {
    setProcessingModule(`tmpl_${moduleId}`);
    setMessage(null);
    try {
      const filePath = await api.masterData.downloadModuleTemplate(moduleId);
      if (filePath) setMessage({ type: 'success', text: `Template for ${moduleId} saved to: ${filePath}` });
    } catch (err: any) {
      setMessage({ type: 'error', text: `Download failed: ${err.message}` });
    } finally { setProcessingModule(null); }
  };

  const handleImportModule = async (moduleId: ModuleId) => {
    setProcessingModule(`imp_${moduleId}`);
    setMessage(null);
    try {
      const result = await api.masterData.importModule(moduleId);
      if (result) {
        if (!result.isValid) {
          setMessage({ type: 'error', text: result.validationErrors.join(' ') });
        } else {
          setStatus(result);
          await loadAllStatus();
          setMessage({ type: 'success', text: `Successfully imported ${moduleId}` });
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: `Import failed: ${err.message}` });
    } finally { setProcessingModule(null); }
  };

  const handleExportModule = async (moduleId: ModuleId) => {
    setProcessingModule(`exp_${moduleId}`);
    setMessage(null);
    try {
      const filePath = await api.masterData.exportModule(moduleId);
      if (filePath) setMessage({ type: 'success', text: `Exported ${moduleId} to: ${filePath}` });
    } catch (err: any) {
      setMessage({ type: 'error', text: `Export failed: ${err.message}` });
    } finally { setProcessingModule(null); }
  };

  const handleClear = async () => {
    if (!confirm('This will clear master data for the active society only. Are you sure you want to proceed?')) return;
    await api.masterData.clear();
    setStatus(null);
    await loadAllStatus();
    setMessage({ type: 'info', text: 'Master data cleared for active society.' });
  };

  const parseValidationStr = (str: string) => {
    if (str.includes('|')) {
      const parts: Record<string, string> = {};
      str.split('|').forEach(p => {
        const idx = p.indexOf(':');
        if (idx !== -1) {
          const key = p.substring(0, idx).trim().toLowerCase();
          const val = p.substring(idx + 1).trim();
          parts[key] = val;
        }
      });
      return {
        sheet: parts['sheet'] || 'Unknown',
        row: parts['row'] || 'N/A',
        column: parts['column'] || 'N/A',
        problem: parts['problem'] || str,
      };
    }
    return { sheet: 'General', row: 'N/A', column: 'N/A', problem: str };
  };

  const isUnlocked = foundationStatus?.registersUnlocked ?? false;

  const MODULES_LIST: { id: ModuleId; title: string; category: 'FOUNDATION' | 'REGISTER'; locked?: boolean }[] = [
    {
      id: 'SOCIETY_MASTER',
      title: 'Society Master',
      category: 'FOUNDATION',
      locked: false,
    },
    {
      id: 'COMMON_MEMBER_MASTER',
      title: 'Common Member Master',
      category: 'FOUNDATION',
      locked: !foundationStatus?.societyMasterComplete,
    },
    { id: 'FORM_I', title: 'Form I — Register of Members', category: 'REGISTER', locked: !isUnlocked },
    { id: 'FORM_J', title: 'Form J — List of Members', category: 'REGISTER', locked: !isUnlocked },
    { id: 'FORM_SHARE', title: 'Share Register', category: 'REGISTER', locked: !isUnlocked },
    { id: 'FORM_NOM', title: 'Nomination Register', category: 'REGISTER', locked: !isUnlocked },
    { id: 'FORM_PROP', title: 'Property Register', category: 'REGISTER', locked: !isUnlocked },
    { id: 'FORM_BANK', title: 'Bank Lien Mark Register', category: 'REGISTER', locked: !isUnlocked },
    { id: 'FORM_SHARE_CERT', title: 'Share Certificate Register', category: 'REGISTER', locked: !isUnlocked },
    { id: 'FORM_VOUCHER', title: 'Payment Voucher Register', category: 'REGISTER', locked: !isUnlocked },
  ];

  return (
    <div className="page-wrapper" style={{ padding: '28px 36px', maxWidth: 1240, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header flex items-center justify-between mb-24">
        <div>
          <div className="flex items-center gap-10">
            <Database className="icon-accent" size={26} />
            <h1 className="page-title" style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
              Master Data Architecture
            </h1>
          </div>
          <p className="page-subtitle text-xs text-secondary mt-4">
            Manage Society Master, Common Member Master, and Individual Register Templates (Prompt 04).
          </p>
        </div>
        {status && (
          <button className="btn btn-secondary btn-sm text-error flex items-center gap-6" onClick={handleClear}>
            <Trash2 size={14} /> Clear Master Data
          </button>
        )}
      </div>

      {/* Alert Banner */}
      {message && (
        <div className={`alert ${message.type === 'error' ? 'alert-error' : message.type === 'success' ? 'alert-success' : 'alert-info'} mb-20`}>
          {message.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
          <div className="text-xs fw-600">{message.text}</div>
        </div>
      )}

      {/* ── SECTION 1: MASTER WORKBOOK ───────────────────────────── */}
      <div className="card mb-24" style={{ padding: 24, borderLeft: '4px solid var(--accent)' }}>
        <div className="flex items-center justify-between flex-wrap gap-16 mb-16">
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }} className="flex items-center gap-8">
              <FileSpreadsheet className="icon-accent" size={20} /> Master Excel Workbook (8 Sheets)
            </h2>
            <p className="text-xs text-secondary mt-4">
              Complete society master containing 01_Society_Master through 08_Lien_Mark_Register.
            </p>
          </div>
          <div className="flex items-center gap-10">
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleDownloadMasterTemplate}
              disabled={processingModule === 'master_download'}
            >
              <Download size={13} /> Download Master Template
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleImportMaster}
              disabled={processingModule === 'master_import'}
            >
              <Upload size={13} /> Import Master
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleExportMaster}
              disabled={processingModule === 'master_export' || !status}
            >
              <Download size={13} /> Export Master
            </button>
          </div>
        </div>

        {/* Master Status Strip */}
        {status ? (
          <div style={{ background: 'var(--surface-2)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: (status.validationErrors.length > 0 || (status.validationWarnings && status.validationWarnings.length > 0)) ? 12 : 0 }} className="flex items-center justify-between text-xs">
            <div className="text-secondary">Loaded: <strong className="text-primary">{status.fileName}</strong> ({status.commonRecords} common records)</div>
            <div>
              Status: {status.isValid ? <span className="badge badge-success">✓ Valid Master Data</span> : <span className="badge badge-error">⚠ {status.validationErrors.length} Validation Errors</span>}
            </div>
          </div>
        ) : (
          <div style={{ background: 'var(--surface-2)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)' }} className="text-xs text-muted">
            No Master Workbook loaded for active society. Upload master template above or import individual modules below.
          </div>
        )}

        {/* ── IMPORT VALIDATION SUMMARY CARD ────────────────────────────── */}
        {status && (status.validationErrors.length > 0 || (status.validationWarnings && status.validationWarnings.length > 0)) && (
          <div style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 16,
            marginTop: 12
          }}>
            <div className="flex items-center justify-between mb-12">
              <h4 className="text-xs fw-700 text-primary flex items-center gap-6" style={{ margin: 0 }}>
                <AlertTriangle size={14} className="text-warning" /> IMPORT VALIDATION
              </h4>
              <div className="flex items-center gap-8 text-xs">
                <span className="badge badge-error" style={{ fontSize: 10 }}>Errors: {status.validationErrors.length}</span>
                <span className="badge badge-warning" style={{ fontSize: 10 }}>Warnings: {status.validationWarnings?.length || 0}</span>
              </div>
            </div>

            <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {status.validationErrors.map((errStr: string, idx: number) => {
                const p = parseValidationStr(errStr);
                return (
                  <div key={`err-${idx}`} style={{ background: 'rgba(239,68,68,0.08)', borderLeft: '3px solid #ef4444', padding: '6px 10px', borderRadius: 4, fontSize: 11 }}>
                    <div className="fw-700 text-error mb-2">[ERROR]</div>
                    <div><strong>Sheet:</strong> {p.sheet}</div>
                    <div><strong>Row:</strong> {p.row}</div>
                    <div><strong>Column:</strong> {p.column}</div>
                    <div><strong>Problem:</strong> {p.problem}</div>
                  </div>
                );
              })}

              {status.validationWarnings?.map((warnStr: string, idx: number) => {
                const p = parseValidationStr(warnStr);
                return (
                  <div key={`warn-${idx}`} style={{ background: 'rgba(245,158,11,0.08)', borderLeft: '3px solid #f59e0b', padding: '6px 10px', borderRadius: 4, fontSize: 11 }}>
                    <div className="fw-700 text-warning mb-2">[WARNING]</div>
                    <div><strong>Sheet:</strong> {p.sheet}</div>
                    <div><strong>Row:</strong> {p.row}</div>
                    <div><strong>Column:</strong> {p.column}</div>
                    <div><strong>Problem:</strong> {p.problem}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── REAL-TIME SPREADSHEET EDITOR ─────────────────────────── */}
      <SpreadsheetEditor onWorkbookUpdated={loadAllStatus} />

      {/* ── SECTION 2: FOUNDATION MODULES ───────────────────────── */}
      <div className="mb-28">
        <h3 className="text-xs fw-700 text-secondary uppercase mb-12" style={{ letterSpacing: '0.8px' }}>
          Foundation Modules
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {MODULES_LIST.filter(m => m.category === 'FOUNDATION').map(m => (
            <div key={m.id} className="card" style={{ padding: 20 }}>
              <div className="flex items-center justify-between mb-16">
                <div className="fw-700 text-sm text-primary">{m.title}</div>
                {m.id === 'SOCIETY_MASTER' ? (
                  <span className={`badge ${foundationStatus?.societyMasterComplete ? 'badge-success' : 'badge-warning'}`}>
                    {foundationStatus?.societyMasterComplete ? '✓ Complete' : '⚠ Incomplete'}
                  </span>
                ) : (
                  <span className={`badge ${foundationStatus?.commonMemberMasterComplete ? 'badge-success' : m.locked ? 'badge-muted' : 'badge-warning'}`}>
                    {foundationStatus?.commonMemberMasterComplete ? '✓ Complete' : m.locked ? '🔒 Locked' : '⚠ Pending'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-8 flex-wrap">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleDownloadModuleTemplate(m.id)}
                  disabled={processingModule === `tmpl_${m.id}`}
                >
                  <Download size={13} /> Template
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleImportModule(m.id)}
                  disabled={m.locked || processingModule === `imp_${m.id}`}
                >
                  <Upload size={13} /> Import
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleExportModule(m.id)}
                  disabled={m.locked || processingModule === `exp_${m.id}`}
                >
                  <Download size={13} /> Export
                </button>
                <button
                  className="btn btn-ghost btn-sm text-accent flex items-center gap-4"
                  onClick={() => { setActiveEditModule(m.id); setIsEditModalOpen(true); }}
                  disabled={m.locked}
                >
                  <Edit3 size={13} /> Edit Data
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION 3: REGISTER MODULES ─────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-14">
          <h3 className="text-xs fw-700 text-secondary uppercase" style={{ letterSpacing: '0.8px' }}>
            Form Register Modules
          </h3>
          <span className={`badge ${isUnlocked ? 'badge-success' : 'badge-warning'}`}>
            {isUnlocked ? <><Unlock size={12} /> Registers Unlocked</> : <><Lock size={12} /> Registers Locked</>}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {MODULES_LIST.filter(m => m.category === 'REGISTER').map(m => (
            <div key={m.id} className="card" style={{ padding: 18, opacity: m.locked ? 0.75 : 1 }}>
              <div className="flex items-center justify-between mb-14">
                <div className="fw-700 text-xs text-primary truncate" title={m.title}>{m.title}</div>
                {m.locked && <Lock size={13} className="text-error" />}
              </div>

              <div className="flex items-center gap-6 flex-wrap">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleDownloadModuleTemplate(m.id)}
                  disabled={m.locked || processingModule === `tmpl_${m.id}`}
                  style={{ fontSize: 11, padding: '5px 10px' }}
                >
                  Template
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleImportModule(m.id)}
                  disabled={m.locked || processingModule === `imp_${m.id}`}
                  style={{ fontSize: 11, padding: '5px 10px' }}
                >
                  Import
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleExportModule(m.id)}
                  disabled={m.locked || processingModule === `exp_${m.id}`}
                  style={{ fontSize: 11, padding: '5px 10px' }}
                >
                  Export
                </button>
                <button
                  className="btn btn-ghost btn-sm text-accent flex items-center gap-4"
                  onClick={() => { setActiveEditModule(m.id); setIsEditModalOpen(true); }}
                  disabled={m.locked}
                  style={{ fontSize: 11, padding: '5px 10px' }}
                >
                  <Edit3 size={11} /> Edit Data
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Data Modal */}
      <EditDataModal
        isOpen={isEditModalOpen}
        moduleId={activeEditModule}
        onClose={() => setIsEditModalOpen(false)}
        onSaved={loadAllStatus}
      />
    </div>
  );
}
