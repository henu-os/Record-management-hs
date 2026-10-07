import React, { useEffect, useState } from 'react';
import {
  Database, FileText, Upload,
  CheckCircle, AlertTriangle, XCircle,
  Clock, Layers, Plus, Building2, ChevronDown, MapPin, Calendar, Hash,
} from 'lucide-react';
import AddSocietyModal from '../components/AddSocietyModal';
import { Society, FoundationStatus, GenerationHistoryEntry, MasterDataStatus } from '../../main/types';
import { Lock, Unlock, ShieldCheck } from 'lucide-react';

type PageId = string;

interface Props {
  onNavigate: (page: PageId) => void;
}

const FORM_LIST = [
  { id: 'FORM_I', label: 'Form I', sub: 'Register of Members', orientation: 'Portrait' },
  { id: 'FORM_J', label: 'Form J', sub: 'List of Members', orientation: 'Portrait' },
  { id: 'FORM_SHARE', label: 'Share Register', sub: 'Share allotment data', orientation: 'Landscape' },
  { id: 'FORM_NOM', label: 'Nomination Register', sub: 'Nomination records', orientation: 'Landscape' },
  { id: 'FORM_PROP', label: 'Property Register', sub: 'Tenement records', orientation: 'Landscape' },
  { id: 'FORM_BANK', label: 'Bank Line Mark Register', sub: 'Loan / lien records', orientation: 'Portrait' },
];

export default function Dashboard({ onNavigate }: Props) {
  const [status, setStatus] = useState<MasterDataStatus | null>(null);
  const [history, setHistory] = useState<GenerationHistoryEntry[]>([]);
  const [societies, setSocieties] = useState<Society[]>([]);
  const [activeSociety, setActiveSociety] = useState<Society | null>(null);
  const [foundationStatus, setFoundationStatus] = useState<FoundationStatus | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    const api = (window as any).api;
    if (!api) return;
    try {
      setLoading(true);
      const [socList, activeSoc] = await Promise.all([
        api.society?.list() || Promise.resolve([]),
        api.society?.getActive() || Promise.resolve(null),
      ]);
      setSocieties(socList);
      setActiveSociety(activeSoc);

      const [s, h, f] = await Promise.all([
        api.masterData.getStatus(),
        api.history.list(),
        api.foundation?.getStatus() || Promise.resolve(null),
      ]);
      setStatus(s);
      setHistory(h?.slice(0, 5) || []);
      setFoundationStatus(f);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const handleSocChange = (e: any) => {
      if (e.detail) {
        setActiveSociety(e.detail);
      }
      loadDashboardData();
    };
    window.addEventListener('society-changed', handleSocChange);
    return () => window.removeEventListener('society-changed', handleSocChange);
  }, []);

  const handleSelectSociety = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const socId = e.target.value;
    if (!socId) return;
    const api = (window as any).api;
    if (api && api.society) {
      const selected = await api.society.select(socId);
      setActiveSociety(selected);
      // Reload master data & history for selected society
      const [s, h] = await Promise.all([
        api.masterData.getStatus(),
        api.history.list(),
      ]);
      setStatus(s);
      setHistory(h?.slice(0, 5) || []);
    }
  };

  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header flex items-center justify-between flex-wrap gap-12">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">HENU OS Multi-Society Records Management System</p>
        </div>

      </div>

      {/* Active Society Card Banner */}
      {activeSociety && (
        <div className="card mb-20" style={{
          background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.12) 0%, rgba(37, 99, 235, 0.08) 100%)',
          borderLeft: '4px solid var(--color-primary, #7c3aed)',
          padding: '16px 20px',
        }}>
          <div className="flex items-center justify-between flex-wrap gap-12 mb-8">
            <div className="flex items-center gap-8">
              <span className="badge badge-accent" style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: 10, fontWeight: 700 }}>
                Active Society
              </span>
              <h2 className="fw-700 text-lg" style={{ margin: 0, color: 'var(--text-main, #ffffff)' }}>
                {activeSociety.societyName}
              </h2>
            </div>
            <div className="flex gap-8">
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('masterdata')}>
                <Upload size={13} /> Upload Master Data
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => onNavigate('generate')}>
                <FileText size={13} /> Generate Forms
              </button>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-16 text-xs text-secondary mt-8">
            <div className="flex items-center gap-4">
              <Hash size={13} className="text-muted" />
              <span>Reg. No.: <strong>{activeSociety.registrationNo}</strong></span>
            </div>
            {activeSociety.registrationDate && (
              <div className="flex items-center gap-4">
                <Calendar size={13} className="text-muted" />
                <span>Reg. Date: {activeSociety.registrationDate}</span>
              </div>
            )}
            {(activeSociety.fullAddress || activeSociety.city) && (
              <div className="flex items-center gap-4">
                <MapPin size={13} className="text-muted" />
                <span>{[activeSociety.fullAddress, activeSociety.city, activeSociety.state, activeSociety.pinCode].filter(Boolean).join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Foundation Workflow & Register Locking Card */}
      {foundationStatus && (
        <div className="card mb-20" style={{ padding: '16px 20px', borderLeft: foundationStatus.registersUnlocked ? '4px solid #10b981' : '4px solid #f59e0b' }}>
          <div className="flex items-center justify-between flex-wrap gap-12 mb-12">
            <div className="flex items-center gap-8">
              <ShieldCheck size={18} className={foundationStatus.registersUnlocked ? 'text-success' : 'text-warning'} />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                Foundation Workflow & Register Locking
              </h3>
            </div>
            <span className={`badge ${foundationStatus.registersUnlocked ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 12, padding: '4px 10px' }}>
              {foundationStatus.registersUnlocked ? <><Unlock size={12} /> {foundationStatus.registersStatusText}</> : <><Lock size={12} /> {foundationStatus.registersStatusText}</>}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div style={{ background: 'var(--bg-card-sub, rgba(255,255,255,0.03))', padding: 12, borderRadius: 8, border: '1px solid var(--border-color, #2d3748)' }}>
              <div className="text-xs text-secondary mb-4">1. Society Master</div>
              <div className="fw-700 text-sm flex items-center gap-6">
                {foundationStatus.societyMasterComplete ? (
                  <span className="text-success">{foundationStatus.societyMasterStatusText}</span>
                ) : (
                  <span className="text-warning">{foundationStatus.societyMasterStatusText}</span>
                )}
              </div>
              <div className="text-xs text-muted mt-4">Society identity & registration</div>
            </div>

            <div style={{ background: 'var(--bg-card-sub, rgba(255,255,255,0.03))', padding: 12, borderRadius: 8, border: '1px solid var(--border-color, #2d3748)' }}>
              <div className="text-xs text-secondary mb-4">2. Common Member Master</div>
              <div className="fw-700 text-sm flex items-center gap-6">
                {foundationStatus.commonMemberMasterComplete ? (
                  <span className="text-success">{foundationStatus.commonMemberStatusText} ({foundationStatus.memberCount} members)</span>
                ) : foundationStatus.societyMasterComplete ? (
                  <span className="text-warning">{foundationStatus.commonMemberStatusText}</span>
                ) : (
                  <span className="text-muted">{foundationStatus.commonMemberStatusText}</span>
                )}
              </div>
              <div className="text-xs text-muted mt-4">Common member foundation</div>
            </div>

            <div style={{ background: 'var(--bg-card-sub, rgba(255,255,255,0.03))', padding: 12, borderRadius: 8, border: '1px solid var(--border-color, #2d3748)' }}>
              <div className="text-xs text-secondary mb-4">3. Form Registers</div>
              <div className="fw-700 text-sm flex items-center gap-6">
                {foundationStatus.registersUnlocked ? (
                  <span className="text-success"><Unlock size={14} /> {foundationStatus.registersStatusText}</span>
                ) : (
                  <span className="text-error"><Lock size={14} /> {foundationStatus.registersStatusText}</span>
                )}
              </div>
              <div className="text-xs text-muted mt-4">I, J, Share, Nom, Prop, Bank</div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid-4 mb-20">
        <div className="stat-card stat-accent">
          <div className="stat-label">Total Members</div>
          <div className="stat-value">{status?.commonRecords ?? '—'}</div>
          <div className="stat-sub">Common File Records for Active Society</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Forms Generated</div>
          <div className="stat-value">{history.length > 0 ? history.length : '0'}</div>
          <div className="stat-sub">PDF jobs for Active Society</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending / Validation</div>
          <div className="stat-value" style={{ fontSize: 16, marginTop: 8 }}>
            {!status ? (
              <span className="badge badge-muted">No Master Data</span>
            ) : status.isValid ? (
              <span className="badge badge-success"><CheckCircle size={11} /> Ready & Valid</span>
            ) : (
              <span className="badge badge-error"><XCircle size={11} /> {status.validationErrors.length} Issue(s)</span>
            )}
          </div>
          <div className="stat-sub">Master data status</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Available Forms</div>
          <div className="stat-value">6</div>
          <div className="stat-sub">I, J, Share, Nom, Prop, Bank</div>
        </div>
      </div>

      <div className="grid-2 gap-20">
        {/* Master Data Card */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title flex items-center gap-8">
                <Database size={15} className="icon-accent" /> Active Master Data
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('masterdata')}>
              Manage
            </button>
          </div>

          {!status ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No master data uploaded yet for this society</div>
              <div className="empty-state-sub">Upload the Master Data Excel workbook for {activeSociety?.societyName || 'this society'}</div>
              <button className="btn btn-primary btn-sm mt-12" onClick={() => onNavigate('masterdata')}>
                Upload Data
              </button>
            </div>
          ) : (
            <div>
              <div className="gen-summary-row">
                <span className="gen-summary-label">Uploaded File</span>
                <span className="gen-summary-value" style={{ fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{status.fileName}</span>
              </div>
              {[
                ['Form I records', status.formICnt],
                ['Form J records', status.formJCnt],
                ['Share Register', status.shareCnt],
                ['Nomination Register', status.nominationCnt],
                ['Property Register', status.propertyCnt],
                ['Bank Line Mark', status.bankCnt],
              ].map(([label, val]) => (
                <div key={String(label)} className="gen-summary-row">
                  <span className="gen-summary-label">{label}</span>
                  <span className="gen-summary-value">{val}</span>
                </div>
              ))}

              {status.validationErrors.length > 0 && (
                <div className="alert alert-error mt-12">
                  <XCircle size={14} />
                  <div>
                    <strong>{status.validationErrors.length} error(s)</strong>
                    <div className="text-sm mt-4">{status.validationErrors[0]}</div>
                  </div>
                </div>
              )}
              {status.validationWarnings.length > 0 && status.validationErrors.length === 0 && (
                <div className="alert alert-warning mt-12">
                  <AlertTriangle size={14} />
                  <div>{status.validationWarnings.length} warning(s)</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Available Forms */}
        <div className="card">
          <div className="card-header">
            <div className="card-title flex items-center gap-8">
              <Layers size={15} className="icon-accent" /> Available Forms
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('generate')}>
              Generate
            </button>
          </div>
          <div>
            {FORM_LIST.map(f => (
              <div key={f.id} className="gen-summary-row">
                <div>
                  <div className="fw-600 text-base">{f.label}</div>
                  <div className="text-xs text-secondary">{f.sub}</div>
                </div>
                <span className="badge badge-muted text-xs">{f.orientation}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Generations */}
      {history.length > 0 && (
        <div className="card mt-20">
          <div className="card-header">
            <div className="card-title flex items-center gap-8">
              <Clock size={15} className="icon-accent" /> Recent Society Generations
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('history')}>
              View All
            </button>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Form</th>
                  <th>Serial Range</th>
                  <th>Total</th>
                  <th>Found</th>
                  <th>Blank</th>
                  <th>Generated</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h: any) => (
                  <tr key={h.id}>
                    <td><span className="badge badge-accent">{h.formLabel || h.form_label}</span></td>
                    <td>
                      <span className="serial-tag">{h.fromSerial || h.from_serial}</span>
                      {' → '}
                      <span className="serial-tag">{h.toSerial || h.to_serial}</span>
                    </td>
                    <td className="fw-600">{h.totalGenerated ?? h.total_generated ?? 0}</td>
                    <td className="text-success">{h.foundCount ?? h.found_count ?? 0}</td>
                    <td className="text-secondary">{h.blankCount ?? h.blank_count ?? 0}</td>
                    <td className="text-muted text-sm">{fmt(h.generatedAt || h.generated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Society Modal */}
      <AddSocietyModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={loadDashboardData}
      />
    </div>
  );
}
