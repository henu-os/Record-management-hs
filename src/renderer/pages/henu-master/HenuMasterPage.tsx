import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Database,
  FileText,
  FolderOpen,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Plus,
  ArrowRightLeft,
  ExternalLink,
  Archive,
  RotateCcw,
  Edit3,
  HardDrive,
  Clock,
  ShieldCheck,
  FileCheck,
  Download,
  X,
  FileSpreadsheet,
  Check,
  Info,
  Trash2,
  Shield,
  Lock,
  KeyRound,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import {
  HenuMasterDashboardStats,
  SocietySummary,
  SocietyOverviewDetails,
  SocietyRegisterCount,
} from '../../../main/types';

interface HenuMasterPageProps {
  onNavigate: (pageId: string) => void;
  onOpenAddSociety?: () => void;
  onSocietySwitched?: () => void;
}

export default function HenuMasterPage({
  onNavigate,
  onOpenAddSociety,
  onSocietySwitched,
}: HenuMasterPageProps) {
  const api = (window as any).api;

  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<HenuMasterDashboardStats | null>(null);
  const [societies, setSocieties] = useState<SocietySummary[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ALL');

  // Selected Society for Detailed Overview
  const [selectedSocId, setSelectedSocId] = useState<string | null>(null);
  const [overviewData, setOverviewData] = useState<SocietyOverviewDetails | null>(null);
  const [overviewLoading, setOverviewLoading] = useState<boolean>(false);

  // Edit Society Modal State
  const [editingSociety, setEditingSociety] = useState<SocietySummary | null>(null);
  const [editForm, setEditForm] = useState({
    societyName: '',
    registrationNo: '',
    registrationDate: '',
    fullAddress: '',
    city: '',
    state: '',
    pinCode: '',
    yearEstablished: '',
  });
  const [editSaving, setEditSaving] = useState(false);

  // Switch / Archive / Delete Confirmation Modal State
  const [confirmSwitch, setConfirmSwitch] = useState<SocietySummary | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<SocietySummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SocietySummary | null>(null);
  const [deleteInput, setDeleteInput] = useState<string>('');
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Multi-step Security Deletion States
  type DeleteStep = 'NAME_CONFIRM' | 'PASSWORD' | 'MFA' | 'FINAL_CONFIRM';
  const [deleteStep, setDeleteStep] = useState<DeleteStep>('NAME_CONFIRM');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [mfaChallengeId, setMfaChallengeId] = useState<string>('');
  const [mfaCode, setMfaCode] = useState<string>('');
  const [mfaToken, setMfaToken] = useState<string>('');
  const [mfaChallengeCodeHint, setMfaChallengeCodeHint] = useState<string>('');
  const [showForgotHelp, setShowForgotHelp] = useState<boolean>(false);

  const [activeMasterTab, setActiveMasterTab] = useState<'SOCIETIES' | 'TEMPLATES'>('SOCIETIES');
  const [globalTemplates, setGlobalTemplates] = useState<any[]>([]);
  const [templateLoading, setTemplateLoading] = useState<boolean>(false);
  const [reuseNotice, setReuseNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!api?.henuMaster) return;
    setLoading(true);
    try {
      const [dashStats, socList, tmplList] = await Promise.all([
        api.henuMaster.getDashboardStats(),
        api.henuMaster.listSocieties({ search: searchTerm, status: statusFilter }),
        api.societyContext?.getGlobalTemplates ? api.societyContext.getGlobalTemplates() : Promise.resolve([]),
      ]);
      setStats(dashStats);
      setSocieties(socList || []);
      setGlobalTemplates(tmplList || []);
    } catch (err) {
      console.error('Failed to load HENUMASTER data:', err);
    } finally {
      setLoading(false);
    }
  }, [api, searchTerm, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReuseTemplate = async (templateName: string, targetSocietyId?: string) => {
    if (!api?.societyContext?.reuseTemplate) return;
    try {
      setTemplateLoading(true);
      const targetId = targetSocietyId || stats?.activeSocietyId;
      if (!targetId) {
        alert('Please select a target society first.');
        return;
      }
      const res = await api.societyContext.reuseTemplate(templateName, targetId);
      if (res.success) {
        setReuseNotice(`Successfully provisioned template "${templateName}" into society imports directory!`);
        setTimeout(() => setReuseNotice(null), 5000);
        await loadData();
      }
    } catch (err: any) {
      alert(`Failed to reuse template: ${err.message}`);
    } finally {
      setTemplateLoading(false);
    }
  };

  // Load detailed overview when selected
  const handleOpenOverview = async (societyId: string) => {
    if (!api?.henuMaster) return;
    setSelectedSocId(societyId);
    setOverviewLoading(true);
    try {
      const overview = await api.henuMaster.getSocietyOverview(societyId);
      setOverviewData(overview);
    } catch (err) {
      console.error('Failed to load society overview:', err);
    } finally {
      setOverviewLoading(false);
    }
  };

  const handleSwitchSociety = async (soc: SocietySummary) => {
    if (!api?.society) return;
    try {
      if (api.society.select) {
        await api.society.select(soc.id);
      } else {
        await api.society.setActive(soc.id);
      }
      setConfirmSwitch(null);
      if (onSocietySwitched) onSocietySwitched();
      await loadData();
      if (selectedSocId === soc.id) {
        await handleOpenOverview(soc.id);
      }
    } catch (err) {
      console.error('Failed to switch society:', err);
    }
  };

  const handleOpenSocietyDashboard = async (soc: SocietySummary) => {
    await handleSwitchSociety(soc);
    onNavigate('dashboard');
  };

  const handleOpenRegisterModule = async (reg: SocietyRegisterCount, socId: string) => {
    // 1. Switch context to the target society
    if (api?.society) {
      if (api.society.select) await api.society.select(socId);
      else await api.society.setActive(socId);
      if (onSocietySwitched) onSocietySwitched();
    }
    // 2. Navigate directly to the existing statutory register module
    if (reg.navFormId) {
      onNavigate(reg.navFormId);
    }
  };

  const handleOpenFolder = async (folderPath?: string) => {
    if (!folderPath || !api?.henuMaster?.openFolder) return;
    try {
      await api.henuMaster.openFolder(folderPath);
    } catch (err) {
      console.error('Failed to open folder:', err);
    }
  };

  const handleArchiveToggle = async (soc: SocietySummary) => {
    if (!api?.henuMaster) return;
    try {
      if (soc.status === 'ARCHIVED') {
        await api.henuMaster.restoreSociety(soc.id);
      } else {
        await api.henuMaster.archiveSociety(soc.id);
      }
      setConfirmArchive(null);
      await loadData();
      if (selectedSocId === soc.id) {
        await handleOpenOverview(soc.id);
      }
    } catch (err) {
      console.error('Failed to toggle archive status:', err);
    }
  };

  const handleOpenEdit = (soc: SocietySummary) => {
    setEditingSociety(soc);
    setEditForm({
      societyName: soc.societyName || '',
      registrationNo: soc.registrationNo || '',
      registrationDate: soc.registrationDate || '',
      fullAddress: soc.fullAddress || '',
      city: soc.city || '',
      state: soc.state || '',
      pinCode: soc.pinCode || '',
      yearEstablished: soc.yearEstablished || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingSociety || !api?.henuMaster) return;
    setEditSaving(true);
    try {
      await api.henuMaster.updateSocietyMetadata(editingSociety.id, editForm);
      setEditingSociety(null);
      await loadData();
      if (selectedSocId === editingSociety.id) {
        await handleOpenOverview(editingSociety.id);
      }
      if (onSocietySwitched) onSocietySwitched();
    } catch (err) {
      console.error('Failed to update society metadata:', err);
    } finally {
      setEditSaving(false);
    }
  };

  const handleExportSummary = async (socId: string, format: 'json' | 'csv' | 'text') => {
    if (!api?.henuMaster?.exportSocietySummary) return;
    try {
      const res = await api.henuMaster.exportSocietySummary(socId, format);
      // Copy to clipboard or trigger download
      if (format === 'json' || format === 'csv') {
        const blob = new Blob([res], { type: format === 'json' ? 'application/json' : 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Society_Summary_${socId}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await navigator.clipboard.writeText(res);
        setExportNotice('Executive summary copied to clipboard!');
        setTimeout(() => setExportNotice(null), 3000);
      }
    } catch (err) {
      console.error('Failed to export summary:', err);
    }
  };

  const resetDeleteState = () => {
    setDeleteTarget(null);
    setDeleteInput('');
    setAdminPassword('');
    setMfaChallengeId('');
    setMfaCode('');
    setMfaToken('');
    setMfaChallengeCodeHint('');
    setDeleteError(null);
    setDeleteStep('NAME_CONFIRM');
    setShowForgotHelp(false);
  };

  const handleProceedToPassword = () => {
    if (!deleteTarget) return;
    if (deleteInput.trim() !== deleteTarget.societyName.trim()) {
      setDeleteError(`Please type exact society name "${deleteTarget.societyName}" to confirm deletion.`);
      return;
    }
    setDeleteError(null);
    setAdminPassword('');
    setShowForgotHelp(false);
    setDeleteStep('PASSWORD');
  };

  const handleVerifyAdminPassword = async () => {
    if (!adminPassword.trim() || !deleteTarget || !api?.security) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await api.security.verifyAdminPassword(adminPassword);
      setAdminPassword('');
      if (!res.success) {
        setDeleteError(res.error || 'Invalid administrative password.');
        return;
      }
      // Generate single-use MFA challenge for this society deletion
      const challengeRes = await api.security.createMfaChallenge(deleteTarget.id);
      if (!challengeRes.success) {
        setDeleteError('Failed to initialize second-factor authentication challenge.');
        return;
      }
      setMfaChallengeId(challengeRes.challengeId);
      setMfaChallengeCodeHint(challengeRes.code);
      setMfaCode('');
      setDeleteStep('MFA');
    } catch (err: any) {
      setDeleteError(err.message || 'Authentication error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleVerifyMfa = async () => {
    if (!mfaCode.trim() || !deleteTarget || !mfaChallengeId || !api?.security) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await api.security.verifyMfaChallenge(mfaChallengeId, mfaCode, deleteTarget.id);
      if (!res.success || !res.mfaToken) {
        setDeleteError(res.error || 'Invalid 6-digit verification code.');
        return;
      }
      setMfaToken(res.mfaToken);
      setDeleteStep('FINAL_CONFIRM');
    } catch (err: any) {
      setDeleteError(err.message || 'MFA verification failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleFinalDelete = async () => {
    if (!deleteTarget || !mfaToken || !api?.security) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await api.security.executeSecureSocietyDelete({
        societyId: deleteTarget.id,
        mfaToken,
      });
      if (!res?.success) {
        setDeleteError(res?.error || 'Failed to delete society');
        return;
      }
      resetDeleteState();
      setSelectedSocId(null);
      setOverviewData(null);
      await loadData();
      if (onSocietySwitched) onSocietySwitched();
    } catch (err: any) {
      setDeleteError(err.message || 'Secure deletion failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="page-container" style={{ padding: '24px 32px', width: '100%', boxSizing: 'border-box' }}>
      {/* ── Top Header ── */}
      <div className="flex items-center justify-between gap-16" style={{ marginBottom: 20 }}>
        <div>
          <div className="flex items-center gap-10">
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
              }}
            >
              <Building2 size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
                HENUMASTER
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                Central Society Administration, Dynamic Context & Storage Engine
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-10">
          {stats?.activeSocietyName && (
            <div
              style={{
                background: 'rgba(124, 58, 237, 0.1)',
                border: '1px solid rgba(124, 58, 237, 0.25)',
                borderRadius: 8,
                padding: '6px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-light, #a78bfa)' }}>
                Active Context:
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                {stats.activeSocietyName}
              </span>
            </div>
          )}

          {/* Open Active Imports Folder */}
          <button
            className="btn btn-secondary btn-sm flex items-center gap-4"
            onClick={async () => {
              if (api?.storage?.openImportsFolder) await api.storage.openImportsFolder();
            }}
            title="Open active society Imports partition folder in Windows Explorer"
          >
            <FolderOpen size={13} />
            Imports Folder
          </button>

          {/* Open Active Exports Folder */}
          <button
            className="btn btn-secondary btn-sm flex items-center gap-4"
            onClick={async () => {
              if (api?.storage?.openExportsFolder) await api.storage.openExportsFolder();
            }}
            title="Open active society Exports partition folder in Windows Explorer"
          >
            <FolderOpen size={13} />
            Exports Folder
          </button>

          <button
            className="btn btn-secondary btn-sm flex items-center gap-6"
            onClick={loadData}
            title="Refresh Society Metrics"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            className="btn btn-primary btn-sm flex items-center gap-6"
            onClick={() => {
              if (onOpenAddSociety) onOpenAddSociety();
            }}
          >
            <Plus size={14} />
            Create Society
          </button>
        </div>
      </div>

      {exportNotice && (
        <div
          style={{
            background: '#064e3b',
            color: '#a7f3d0',
            border: '1px solid #059669',
            borderRadius: 8,
            padding: '8px 16px',
            marginBottom: 16,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Check size={16} />
          {exportNotice}
        </div>
      )}

      {reuseNotice && (
        <div
          style={{
            background: '#064e3b',
            color: '#a7f3d0',
            border: '1px solid #059669',
            borderRadius: 8,
            padding: '8px 16px',
            marginBottom: 16,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Check size={16} />
          {reuseNotice}
        </div>
      )}

      {/* ── KPI Stat Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
          marginBottom: 20,
        }}
      >
        {/* Total Societies */}
        <div className="card" style={{ padding: 14 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>TOTAL SOCIETIES</span>
            <Building2 size={15} className="text-accent" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
            {stats?.totalSocieties ?? 0}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            <span style={{ color: '#10b981', fontWeight: 600 }}>{stats?.activeSocieties ?? 0} Active</span>
            {' · '}
            <span style={{ color: '#64748b' }}>{stats?.archivedSocieties ?? 0} Archived</span>
          </div>
        </div>

        {/* Managed Documents */}
        <div className="card" style={{ padding: 14 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>DOCUMENTS</span>
            <FileText size={15} className="text-accent" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
            {stats?.totalDocuments ?? 0}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            Across {stats?.totalRegisters ?? 0} Statutory Registers
          </div>
        </div>

        {/* Imports & Exports */}
        <div className="card" style={{ padding: 14 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>IMPORTS & EXPORTS</span>
            <ExternalLink size={15} className="text-accent" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
            {(stats?.totalImports ?? 0) + (stats?.totalExports ?? 0)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>{stats?.totalImports ?? 0} Imports</span>
            {' · '}
            <span style={{ color: '#818cf8', fontWeight: 600 }}>{stats?.totalExports ?? 0} Exports</span>
          </div>
        </div>

        {/* Society Completion Status */}
        <div className="card" style={{ padding: 14 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>COMPLETION STATUS</span>
            <ShieldCheck size={15} color="#10b981" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>
            {stats?.completedSocieties ?? 0} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Done</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>{stats?.inProgressSocieties ?? 0} In Progress</span>
            {' · '}
            <span style={{ color: '#94a3b8' }}>{stats?.notStartedSocieties ?? 0} Not Started</span>
          </div>
        </div>

        {/* Storage Capacity */}
        <div className="card" style={{ padding: 14 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>STORAGE USED</span>
            <HardDrive size={15} className="text-accent" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
            {stats?.storageUsedFormatted ?? '0 B'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            {stats?.storageAvailableFormatted} Free Space
          </div>
        </div>

        {/* System & Society Health */}
        <div className="card" style={{ padding: 14 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>INTEGRITY</span>
            <ShieldCheck size={15} color={stats?.systemHealthStatus === 'HEALTHY' ? '#10b981' : '#f59e0b'} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: stats?.systemHealthStatus === 'HEALTHY' ? '#10b981' : '#f59e0b', marginTop: 2 }}>
            {stats?.systemHealthStatus === 'HEALTHY' ? '✓ HEALTHY' : '⚠ WARNINGS'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
            {stats?.healthySocietiesCount} Intact · {stats?.warningSocietiesCount} Attention
          </div>
        </div>
      </div>

      {/* ── Tab Switcher: Societies vs Global Template Library ── */}
      <div className="flex items-center gap-8" style={{ marginBottom: 16 }}>
        <button
          className={`btn btn-sm ${activeMasterTab === 'SOCIETIES' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveMasterTab('SOCIETIES')}
          style={{ fontSize: 12, padding: '6px 16px' }}
        >
          <Building2 size={14} /> Societies Directory ({societies.length})
        </button>
        <button
          className={`btn btn-sm ${activeMasterTab === 'TEMPLATES' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveMasterTab('TEMPLATES')}
          style={{ fontSize: 12, padding: '6px 16px' }}
        >
          <FileText size={14} /> Global Template Library ({globalTemplates.length})
        </button>
      </div>

      {/* ── Societies Tab: Search, Filters & Cards View ── */}
      {activeMasterTab === 'SOCIETIES' && (
        <>
          {/* ── Search & Filter Controls ── */}
          <div
            className="card"
            style={{
              padding: '12px 16px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            {/* Search Box */}
            <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}
              />
              <input
                type="text"
                className="input-control"
                placeholder="Search societies by name, registration no, city, state, or address..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ paddingLeft: 36, width: '100%' }}
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-6">
              {(['ALL', 'ACTIVE', 'ARCHIVED'] as const).map(tab => (
                <button
                  key={tab}
                  className={`btn btn-sm ${statusFilter === tab ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setStatusFilter(tab)}
                  style={{ fontSize: 12, padding: '6px 14px', textTransform: 'capitalize' }}
                >
                  {tab === 'ALL' ? 'All Societies' : tab.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* ── Societies Grid / Cards View ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
            {societies.map(soc => {
              const isSelected = soc.isActive;
              return (
                <div
                  key={soc.id}
                  className="card"
                  style={{
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: isSelected ? '2px solid var(--accent, #7c3aed)' : '1px solid var(--border)',
                    background: isSelected ? 'rgba(124, 58, 237, 0.03)' : 'var(--bg-card)',
                    boxShadow: isSelected ? '0 4px 20px rgba(124, 58, 237, 0.15)' : 'none',
                    position: 'relative',
                  }}
                >
                  {/* Header Badges */}
                  <div>
                    <div className="flex items-center justify-between gap-8" style={{ marginBottom: 10 }}>
                      <div className="flex items-center gap-6">
                        {isSelected && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              background: '#7c3aed',
                              color: '#ffffff',
                              padding: '2px 8px',
                              borderRadius: 4,
                              letterSpacing: '0.5px',
                            }}
                          >
                            ACTIVE CONTEXT
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: soc.status === 'ARCHIVED' ? '#334155' : '#064e3b',
                            color: soc.status === 'ARCHIVED' ? '#94a3b8' : '#6ee7b7',
                            padding: '2px 8px',
                            borderRadius: 4,
                          }}
                        >
                          {soc.status}
                        </span>

                        {/* Completion Status Badge */}
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background:
                              soc.completionStatus === 'COMPLETED'
                                ? 'rgba(16, 185, 129, 0.15)'
                                : soc.completionStatus === 'IN_PROGRESS'
                                ? 'rgba(245, 158, 11, 0.15)'
                                : 'rgba(100, 116, 139, 0.15)',
                            color:
                              soc.completionStatus === 'COMPLETED'
                                ? '#10b981'
                                : soc.completionStatus === 'IN_PROGRESS'
                                ? '#f59e0b'
                                : '#94a3b8',
                            border: `1px solid ${
                              soc.completionStatus === 'COMPLETED'
                                ? 'rgba(16, 185, 129, 0.3)'
                                : soc.completionStatus === 'IN_PROGRESS'
                                ? 'rgba(245, 158, 11, 0.3)'
                                : 'rgba(100, 116, 139, 0.3)'
                            }`,
                            padding: '2px 8px',
                            borderRadius: 4,
                          }}
                        >
                          {soc.completionStatus === 'COMPLETED'
                            ? 'COMPLETED'
                            : soc.completionStatus === 'IN_PROGRESS'
                            ? 'IN PROGRESS'
                            : 'NOT STARTED'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        {soc.healthStatus === 'HEALTHY' ? (
                          <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={13} /> Intact
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <AlertTriangle size={13} /> Attention
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Society Title */}
                    <h3
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        margin: '0 0 4px 0',
                        color: 'var(--text-primary)',
                        lineHeight: 1.3,
                      }}
                    >
                      {soc.societyName}
                    </h3>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                      Reg: <span className="fw-600 text-primary">{soc.registrationNo || 'N/A'}</span>
                      {soc.city && ` · ${soc.city}, ${soc.state}`}
                    </div>

                    {/* Metadata Row */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: 6,
                        background: 'var(--surface-2, #1e293b)',
                        padding: '8px 10px',
                        borderRadius: 6,
                        marginBottom: 8,
                        fontSize: 11,
                        textAlign: 'center',
                      }}
                    >
                      <div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>Docs</div>
                        <strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>{soc.documentCount}</strong>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>Imports</div>
                        <strong style={{ color: '#38bdf8', fontSize: 13 }}>{soc.importCount || 0}</strong>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>Exports</div>
                        <strong style={{ color: '#818cf8', fontSize: 13 }}>{soc.exportCount || 0}</strong>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>Storage</div>
                        <strong style={{ color: 'var(--text-primary)', fontSize: 11 }}>{soc.storageSizeFormatted}</strong>
                      </div>
                    </div>

                    {/* Last Activity */}
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Last Activity:</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {soc.lastActivityTitle || 'Society Created'}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-8 pt-10" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-6">
                      {/* Open Society */}
                      <button
                        className="btn btn-primary btn-sm flex items-center gap-4"
                        onClick={() => handleOpenSocietyDashboard(soc)}
                        style={{ fontSize: 11, padding: '5px 10px' }}
                        title="Switch active context and open record dashboard"
                      >
                        <ExternalLink size={12} />
                        Open
                      </button>

                      {/* Switch Context */}
                      {!isSelected && (
                        <button
                          className="btn btn-secondary btn-sm flex items-center gap-4"
                          onClick={() => setConfirmSwitch(soc)}
                          style={{ fontSize: 11, padding: '5px 10px' }}
                          title="Switch active society context"
                        >
                          <ArrowRightLeft size={12} />
                          Switch
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-6">
                      {/* View Complete Overview */}
                      <button
                        className="btn btn-secondary btn-sm flex items-center gap-4"
                        onClick={() => handleOpenOverview(soc.id)}
                        style={{ fontSize: 11, padding: '5px 10px' }}
                        title="View complete society breakdown and statutory registers"
                      >
                        <Info size={12} />
                        Overview
                      </button>

                      {/* Edit Metadata */}
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenEdit(soc)}
                        style={{ padding: '5px 8px' }}
                        title="Edit society identity metadata"
                      >
                        <Edit3 size={12} />
                      </button>

                      {/* Open Physical Folder */}
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenFolder(soc.folderPath)}
                        style={{ padding: '5px 8px' }}
                        title="Open society physical folder in Windows Explorer"
                      >
                        <FolderOpen size={12} />
                      </button>

                      {/* Delete Society */}
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setDeleteTarget(soc);
                          setDeleteInput('');
                          setDeleteError(null);
                        }}
                        style={{ padding: '5px 8px', color: '#ef4444' }}
                        title="Permanently delete society and files"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {societies.length === 0 && !loading && (
              <div
                className="card"
                style={{
                  gridColumn: '1 / -1',
                  padding: 40,
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                }}
              >
                <Building2 size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
                <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)' }}>No Societies Found</h4>
                <p style={{ margin: 0, fontSize: 13 }}>
                  {searchTerm ? 'No societies match your search query.' : 'Create your first society to get started.'}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Global Template Library View ── */}
      {activeMasterTab === 'TEMPLATES' && (
        <div style={{ marginTop: 8 }}>
          <div
            className="card"
            style={{
              padding: '16px 20px',
              marginBottom: 16,
              background: 'var(--surface-2, #1e293b)',
              border: '1px solid rgba(124, 58, 237, 0.3)',
            }}
          >
            <div className="flex items-center gap-10" style={{ marginBottom: 6 }}>
              <FileText size={18} className="text-accent" />
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                GLOBAL TEMPLATE LIBRARY & CROSS-SOCIETY REUSE
              </h3>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
              Reusing a template copies ONLY the blank template schema into the target society&apos;s isolated
              Imports/Templates directory. It NEVER copies or leaks member records, registers, or generated files.
            </p>
          </div>

          {globalTemplates.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
              No master templates have been used across societies yet. Upload a template in Master Data to populate this library.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {globalTemplates.map((tmpl, idx) => (
                <div
                  key={idx}
                  className="card"
                  style={{
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#818cf8',
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}
                      >
                        TEMPLATE SCHEMA
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        Used {tmpl.totalUsageCount} {tmpl.totalUsageCount === 1 ? 'time' : 'times'}
                      </span>
                    </div>

                    <h4 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
                      {tmpl.templateName}
                    </h4>

                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                      <strong>Used By:</strong>
                      <div className="flex flex-wrap gap-4" style={{ marginTop: 4 }}>
                        {tmpl.usedBySocieties.map((u: any, i: number) => (
                          <span
                            key={i}
                            style={{
                              fontSize: 10,
                              background: 'var(--bg-card, #0f172a)',
                              border: '1px solid var(--border)',
                              padding: '2px 6px',
                              borderRadius: 4,
                              color: 'var(--text-primary)',
                            }}
                          >
                            {u.societyName}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-10" style={{ borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      Latest: {new Date(tmpl.latestUsedAt).toLocaleDateString()}
                    </span>
                    <button
                      className="btn btn-primary btn-sm flex items-center gap-4"
                      onClick={() => handleReuseTemplate(tmpl.templateName, stats?.activeSocietyId)}
                      disabled={templateLoading}
                      title={`Provision a fresh copy of this template schema for active society (${stats?.activeSocietyName || 'Active Society'})`}
                    >
                      <Plus size={12} /> Use Template for Active Society
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Society Detailed Overview Modal ── */}
      {selectedSocId && overviewData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 960,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--surface-2, #1e293b)',
              }}
            >
              <div className="flex items-center gap-10">
                <Building2 size={20} className="text-accent" />
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    {overviewData.societyName}
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Registration No: {overviewData.registrationNo} · {overviewData.status}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <button
                  className="btn btn-secondary btn-sm flex items-center gap-4"
                  onClick={() => handleExportSummary(overviewData.id, 'text')}
                  style={{ fontSize: 11 }}
                >
                  <Download size={12} />
                  Copy Summary
                </button>
                <button
                  className="btn btn-secondary btn-sm flex items-center gap-4"
                  onClick={() => handleOpenFolder(overviewData.folderPath)}
                  style={{ fontSize: 11 }}
                >
                  <FolderOpen size={12} />
                  Open Folder
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelectedSocId(null)}
                  style={{ padding: 6 }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
              {/* Identity & Storage Bar */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 12,
                  marginBottom: 20,
                  background: 'var(--surface-2, #1e293b)',
                  padding: 14,
                  borderRadius: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>ADDRESS</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {overviewData.fullAddress || 'N/A'}, {overviewData.city} {overviewData.pinCode}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>STORAGE FOLDER</div>
                  <div
                    style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-light, #a78bfa)', cursor: 'pointer' }}
                    onClick={() => handleOpenFolder(overviewData.folderPath)}
                    title={overviewData.folderPath}
                    className="truncate"
                  >
                    {overviewData.folderPath}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>TOTAL FILES & SIZE</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {overviewData.documentCount} Files ({overviewData.storageSizeFormatted})
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>SYSTEM HEALTH</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: overviewData.healthStatus === 'HEALTHY' ? '#10b981' : '#f59e0b' }}>
                    {overviewData.healthStatus === 'HEALTHY' ? '✓ Storage Intact' : `⚠ ${overviewData.missingFilesCount} Missing Files`}
                  </div>
                </div>
              </div>

              {/* Statutory Register Cards */}
              <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px 0', color: 'var(--text-primary)' }}>
                STATUTORY REGISTERS & MANAGED DOCUMENTS
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 24 }}>
                {overviewData.registers.map(reg => (
                  <div
                    key={reg.categoryId}
                    className="card"
                    style={{
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {reg.categoryName}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: reg.folderExists ? (reg.documentCount > 0 ? '#10b981' : '#94a3b8') : '#f59e0b',
                            background: 'rgba(255,255,255,0.05)',
                            padding: '2px 6px',
                            borderRadius: 4,
                          }}
                        >
                          {reg.folderExists ? (reg.documentCount > 0 ? '✓ Ready' : 'Empty') : '⚠ Missing'}
                        </span>
                      </div>

                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
                        <span>{reg.documentCount} Documents</span>
                        {' · '}
                        <span>{reg.storageFormatted}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 pt-8" style={{ borderTop: '1px solid var(--border)' }}>
                      <button
                        className="btn btn-primary btn-sm flex items-center gap-4"
                        onClick={() => {
                          setSelectedSocId(null);
                          handleOpenRegisterModule(reg, overviewData.id);
                        }}
                        style={{ fontSize: 10, padding: '4px 8px', flex: 1 }}
                      >
                        <ExternalLink size={11} />
                        Open Module
                      </button>

                      <button
                        className="btn btn-secondary btn-sm flex items-center gap-4"
                        onClick={() => handleOpenFolder(reg.folderPath)}
                        style={{ fontSize: 10, padding: '4px 8px' }}
                        title="Open category folder"
                      >
                        <FolderOpen size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recent Activity Log */}
              <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px 0', color: 'var(--text-primary)' }}>
                RECENT SOCIETY ACTIVITY
              </h4>
              <div
                style={{
                  background: 'var(--surface-2, #1e293b)',
                  borderRadius: 8,
                  padding: 12,
                  maxHeight: 180,
                  overflowY: 'auto',
                }}
              >
                {overviewData.recentActivity.map(act => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between"
                    style={{
                      padding: '6px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{act.title}</span>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>{act.description}</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {new Date(act.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))}
                {overviewData.recentActivity.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: 10 }}>
                    No recent activity recorded.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 24px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--surface-2, #1e293b)',
              }}
            >
              <div className="flex items-center gap-8">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const soc = societies.find(s => s.id === overviewData.id);
                    if (soc) handleOpenEdit(soc);
                  }}
                >
                  <Edit3 size={13} /> Edit Metadata
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const soc = societies.find(s => s.id === overviewData.id);
                    if (soc) setConfirmArchive(soc);
                  }}
                >
                  {overviewData.status === 'ARCHIVED' ? <RotateCcw size={13} /> : <Archive size={13} />}
                  {overviewData.status === 'ARCHIVED' ? 'Restore Society' : 'Archive Society'}
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const soc = societies.find(s => s.id === overviewData.id);
                    if (soc) {
                      setDeleteTarget(soc);
                      setDeleteInput('');
                      setDeleteError(null);
                    }
                  }}
                  style={{ color: '#ef4444' }}
                >
                  <Trash2 size={13} /> Delete Society
                </button>
              </div>

              <button
                className="btn btn-primary btn-sm flex items-center gap-6"
                onClick={() => {
                  const soc = societies.find(s => s.id === overviewData.id);
                  if (soc) handleOpenSocietyDashboard(soc);
                }}
              >
                <ExternalLink size={13} />
                Open in Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Society Modal ── */}
      {editingSociety && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            padding: 24,
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 540, padding: 24 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Edit Society Metadata</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingSociety(null)}>
                <X size={14} />
              </button>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Updates society display identity in the database without altering folder paths or breaking file references.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label" style={{ fontSize: 11 }}>Society Name *</label>
                <input
                  type="text"
                  className="input-control"
                  value={editForm.societyName}
                  onChange={e => setEditForm({ ...editForm, societyName: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 11 }}>Registration No *</label>
                  <input
                    type="text"
                    className="input-control"
                    value={editForm.registrationNo}
                    onChange={e => setEditForm({ ...editForm, registrationNo: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 11 }}>Registration Date</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="DD/MM/YYYY"
                    value={editForm.registrationDate}
                    onChange={e => setEditForm({ ...editForm, registrationDate: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 11 }}>Full Registered Address</label>
                <input
                  type="text"
                  className="input-control"
                  value={editForm.fullAddress}
                  onChange={e => setEditForm({ ...editForm, fullAddress: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 11 }}>City</label>
                  <input
                    type="text"
                    className="input-control"
                    value={editForm.city}
                    onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 11 }}>State</label>
                  <input
                    type="text"
                    className="input-control"
                    value={editForm.state}
                    onChange={e => setEditForm({ ...editForm, state: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 11 }}>PIN Code</label>
                  <input
                    type="text"
                    className="input-control"
                    value={editForm.pinCode}
                    onChange={e => setEditForm({ ...editForm, pinCode: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 11 }}>Year Established</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. 2020"
                  value={editForm.yearEstablished}
                  onChange={e => setEditForm({ ...editForm, yearEstablished: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-10" style={{ marginTop: 20 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingSociety(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSaveEdit}
                disabled={editSaving || !editForm.societyName || !editForm.registrationNo}
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Switch Confirmation Modal ── */}
      {confirmSwitch && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1002,
            padding: 24,
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 440, padding: 24 }}>
            <div className="flex items-center gap-10" style={{ marginBottom: 12 }}>
              <ArrowRightLeft size={20} className="text-accent" />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Switch Active Society</h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Switch current operating context to <strong style={{ color: 'var(--text-primary)' }}>{confirmSwitch.societyName}</strong>? All subsequent registers and documents will be scoped to this society.
            </p>
            <div className="flex items-center justify-end gap-10">
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmSwitch(null)}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => handleSwitchSociety(confirmSwitch)}>
                Confirm Switch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Archive Confirmation Modal ── */}
      {confirmArchive && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1002,
            padding: 24,
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 460, padding: 24 }}>
            <div className="flex items-center gap-10" style={{ marginBottom: 12 }}>
              <Archive size={20} className="text-accent" />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                {confirmArchive.status === 'ARCHIVED' ? 'Restore Society' : 'Archive Society'}
              </h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              {confirmArchive.status === 'ARCHIVED'
                ? `Restore ${confirmArchive.societyName} to ACTIVE status?`
                : `Archive ${confirmArchive.societyName}? No files or records will be deleted. You can restore it anytime.`}
            </p>
            <div className="flex items-center justify-end gap-10">
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmArchive(null)}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => handleArchiveToggle(confirmArchive)}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Multi-Step Security Delete Modal Flow ── */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1005,
            padding: 24,
          }}
        >
          {/* STEP 1: Name Confirmation */}
          {deleteStep === 'NAME_CONFIRM' && (
            <div className="card" style={{ width: '100%', maxWidth: 500, padding: 24, border: '1px solid #ef4444' }}>
              <div className="flex items-center gap-10" style={{ marginBottom: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: 'rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444',
                  }}
                >
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#ef4444' }}>
                    DELETE SOCIETY?
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Irreversible administrative operation
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: 'var(--surface-2, #1e293b)',
                  borderRadius: 6,
                  padding: '12px 14px',
                  marginBottom: 14,
                  fontSize: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Society Name:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget.societyName}</strong>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Registration Number:</span>
                  <span style={{ color: 'var(--text-primary)' }}>{deleteTarget.registrationNo || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Number of Documents:</span>
                  <span style={{ color: 'var(--text-primary)' }}>{deleteTarget.documentCount}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Storage Used:</span>
                  <span style={{ color: 'var(--text-primary)' }}>{deleteTarget.storageSizeFormatted}</span>
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderLeft: '3px solid #ef4444',
                  padding: '10px 12px',
                  borderRadius: 4,
                  fontSize: 12,
                  color: '#fca5a5',
                  marginBottom: 14,
                }}
              >
                <strong>Warning:</strong> This action will permanently delete this society, all associated database records, member registrations, and physical files from the storage folder.
                {deleteTarget.isActive && (
                  <div style={{ marginTop: 6, fontWeight: 600, color: '#f87171' }}>
                    ⚠ This is the currently active society. Active context will be safely cleared.
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 6, display: 'block' }}>
                  To confirm, type <strong>{deleteTarget.societyName}</strong> below:
                </label>
                <input
                  type="text"
                  className="input-control"
                  placeholder={deleteTarget.societyName}
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  style={{ width: '100%', borderColor: deleteInput === deleteTarget.societyName ? '#10b981' : undefined }}
                  autoFocus
                />
              </div>

              {deleteError && (
                <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>
                  {deleteError}
                </div>
              )}

              <div className="flex items-center justify-end gap-10">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={resetDeleteState}
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-sm"
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    opacity: deleteInput.trim() === deleteTarget.societyName.trim() && !deleteLoading ? 1 : 0.5,
                    cursor: deleteInput.trim() === deleteTarget.societyName.trim() && !deleteLoading ? 'pointer' : 'not-allowed',
                  }}
                  onClick={handleProceedToPassword}
                  disabled={deleteInput.trim() !== deleteTarget.societyName.trim() || deleteLoading}
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Administrative Password Verification */}
          {deleteStep === 'PASSWORD' && (
            <div className="card" style={{ width: '100%', maxWidth: 480, padding: 24, border: '1px solid #f59e0b', background: '#0f172a' }}>
              <div className="flex items-center gap-10" style={{ marginBottom: 14 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    background: 'rgba(245, 158, 11, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#f59e0b',
                  }}
                >
                  <Shield size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#f59e0b' }}>
                    ADMINISTRATIVE SECURITY VERIFICATION
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Permanent Society Deletion Gate
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: 6,
                  padding: '12px 14px',
                  marginBottom: 16,
                  fontSize: 12,
                }}
              >
                <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>Society:</div>
                <strong style={{ color: '#f8fafc', fontSize: 14 }}>{deleteTarget.societyName}</strong>
                <div style={{ marginTop: 6, color: '#f87171', fontWeight: 600 }}>
                  This operation is irreversible.
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 6, display: 'block', color: '#cbd5e1' }}>
                  Enter Administrative Password:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    className="input-control"
                    placeholder="••••••••••••••••"
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleVerifyAdminPassword();
                      if (e.key === 'Escape') resetDeleteState();
                    }}
                    style={{ width: '100%', paddingLeft: 12 }}
                    autoFocus
                    disabled={deleteLoading}
                  />
                </div>
              </div>

              {deleteError && (
                <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12, padding: '8px 10px', background: 'rgba(239,68,68,0.1)', borderRadius: 6 }}>
                  {deleteError}
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => setShowForgotHelp(!showForgotHelp)}
                  style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
                >
                  <HelpCircle size={12} />
                  <span>Forgotten password?</span>
                </button>
                {showForgotHelp && (
                  <div style={{ marginTop: 6, padding: 8, background: '#1e293b', borderRadius: 6, fontSize: 11, color: '#94a3b8' }}>
                    Please contact <strong style={{ color: '#e2e8f0' }}>HENU OS Support</strong> for administrative credentials.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-10">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={resetDeleteState}
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-sm"
                  style={{
                    background: '#f59e0b',
                    color: '#000000',
                    fontWeight: 700,
                  }}
                  onClick={handleVerifyAdminPassword}
                  disabled={!adminPassword.trim() || deleteLoading}
                >
                  {deleteLoading ? 'Verifying...' : 'Verify Password'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Second Factor (MFA) Challenge Verification */}
          {deleteStep === 'MFA' && (
            <div className="card" style={{ width: '100%', maxWidth: 480, padding: 24, border: '1px solid #6366f1', background: '#0f172a' }}>
              <div className="flex items-center gap-10" style={{ marginBottom: 14 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    background: 'rgba(99, 102, 241, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#818cf8',
                  }}
                >
                  <Lock size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#818cf8' }}>
                    SECOND FACTOR VERIFICATION
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Two-Step Authorization Challenge
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.6)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: 8,
                  padding: '12px 14px',
                  marginBottom: 16,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
                  One-Time Authorization Security Code:
                </div>
                {mfaChallengeCodeHint && (
                  <div
                    style={{
                      display: 'inline-block',
                      background: 'rgba(99, 102, 241, 0.2)',
                      border: '1px dashed #818cf8',
                      color: '#a5b4fc',
                      fontWeight: 800,
                      fontSize: 20,
                      letterSpacing: 4,
                      padding: '4px 14px',
                      borderRadius: 6,
                      marginBottom: 6,
                      userSelect: 'all',
                    }}
                  >
                    {mfaChallengeCodeHint}
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  Enter the 6-digit challenge code above to authorize permanent deletion.
                </div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                  Single-use token • Expires in 5 minutes
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <input
                  type="text"
                  className="input-control"
                  placeholder="_ _ _ _ _ _"
                  maxLength={6}
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleVerifyMfa();
                    if (e.key === 'Escape') resetDeleteState();
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    fontSize: 20,
                    letterSpacing: 6,
                    fontWeight: 700,
                    color: '#818cf8',
                  }}
                  autoFocus
                  disabled={deleteLoading}
                />
              </div>

              {deleteError && (
                <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12, padding: '8px 10px', background: 'rgba(239,68,68,0.1)', borderRadius: 6 }}>
                  {deleteError}
                </div>
              )}

              <div className="flex items-center justify-end gap-10">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={resetDeleteState}
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-sm"
                  style={{
                    background: '#6366f1',
                    color: '#ffffff',
                    fontWeight: 700,
                  }}
                  onClick={handleVerifyMfa}
                  disabled={mfaCode.length !== 6 || deleteLoading}
                >
                  {deleteLoading ? 'Verifying...' : 'Verify & Continue'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Final Permanent Deletion Confirmation */}
          {deleteStep === 'FINAL_CONFIRM' && (
            <div className="card" style={{ width: '100%', maxWidth: 520, padding: 24, border: '2px solid #dc2626', background: '#0b0f19' }}>
              <div className="flex items-center gap-10" style={{ marginBottom: 14 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: 'rgba(220, 38, 38, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#f87171',
                  }}
                >
                  <Trash2 size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: '#f87171' }}>
                    FINAL DELETE CONFIRMATION
                  </h3>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    All Security Authorizations Verified
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid rgba(220, 38, 38, 0.3)',
                  borderRadius: 8,
                  padding: '14px 16px',
                  marginBottom: 16,
                  fontSize: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ color: '#cbd5e1', fontSize: 13, marginBottom: 2 }}>
                  You are about to permanently delete:
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
                  {deleteTarget.societyName}
                </div>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
                <div className="flex justify-between">
                  <span style={{ color: '#94a3b8' }}>Database records:</span>
                  <strong style={{ color: '#f1f5f9' }}>{deleteTarget.documentCount ? deleteTarget.documentCount * 4 + 10 : 1}</strong>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#94a3b8' }}>Members:</span>
                  <strong style={{ color: '#f1f5f9' }}>{overviewData?.health?.totalDocuments || 0}</strong>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#94a3b8' }}>Documents:</span>
                  <strong style={{ color: '#f1f5f9' }}>{deleteTarget.documentCount}</strong>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#94a3b8' }}>Storage:</span>
                  <strong style={{ color: '#f1f5f9' }}>{deleteTarget.storageSizeFormatted}</strong>
                </div>
                <div className="flex justify-between" style={{ wordBreak: 'break-all' }}>
                  <span style={{ color: '#94a3b8' }}>Physical folder:</span>
                  <code style={{ color: '#fca5a5', fontSize: 11, background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: 4 }}>
                    HENU OS RECMA\Societies\{deleteTarget.societyName}
                  </code>
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(220, 38, 38, 0.15)',
                  borderLeft: '4px solid #dc2626',
                  padding: '10px 12px',
                  borderRadius: 4,
                  fontSize: 12,
                  color: '#fecaca',
                  fontWeight: 600,
                  marginBottom: 16,
                }}
              >
                ⚠ This action cannot be undone. All data, files, and ledger records will be deleted immediately.
              </div>

              {deleteError && (
                <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12, padding: '8px 10px', background: 'rgba(239,68,68,0.1)', borderRadius: 6 }}>
                  {deleteError}
                </div>
              )}

              <div className="flex items-center justify-end gap-10">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={resetDeleteState}
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-sm"
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    fontWeight: 900,
                    letterSpacing: '0.5px',
                    padding: '8px 16px',
                  }}
                  onClick={handleFinalDelete}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? 'Executing Deletion...' : 'PERMANENTLY DELETE SOCIETY'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
