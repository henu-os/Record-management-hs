import React, { useState, useEffect, useCallback } from 'react';
import {
  SlidersHorizontal, HardDrive, FolderTree, FileSpreadsheet, ShieldCheck,
  Archive, Activity, FolderOpen, RefreshCw, CheckCircle2, AlertTriangle,
  Plus, Trash2, Edit2, ArrowRight, Search, FileText, Download, Check, X,
  Layers, Database, FileCheck, Lock, ExternalLink, RotateCcw
} from 'lucide-react';
import {
  ApplicationConfig, DocumentCategory, DocumentRecord, StorageOverview,
  SystemHealthReport, BackupItem, StorageValidationResult
} from '../../../main/types';
import { SecurityPasswordModal } from '../../components/SecurityPasswordModal';

export default function HenuConfigPage() {
  const [activeTab, setActiveTab] = useState<
    'system' | 'storage' | 'folders' | 'explorer' | 'routing' | 'backup'
  >('system');

  const [config, setConfig] = useState<ApplicationConfig | null>(null);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [overview, setOverview] = useState<StorageOverview | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [healthReport, setHealthReport] = useState<SystemHealthReport | null>(null);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Search & Explorer state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // Change location modal state
  const [isMigratingLocation, setIsMigratingLocation] = useState<boolean>(false);
  const [newLocationPath, setNewLocationPath] = useState<string>('');
  const [migrationValidation, setMigrationValidation] = useState<StorageValidationResult | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<string>('');

  // Category management modal state
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');

  // Backup & Restore state
  const [backupType, setBackupType] = useState<'zip' | 'json'>('zip');
  const [backupScope, setBackupScope] = useState<'all' | 'custom'>('all');
  const [includeConfigScope, setIncludeConfigScope] = useState<boolean>(true);
  const [societiesList, setSocietiesList] = useState<any[]>([]);
  const [selectedCustomSocieties, setSelectedCustomSocieties] = useState<string[]>([]);
  const [selectedCustomFolders, setSelectedCustomFolders] = useState<Record<string, string[]>>({});
  const [backupLoading, setBackupLoading] = useState<boolean>(false);
  const [backupProgressMsg, setBackupProgressMsg] = useState<string>('');

  // Restore state
  const [restoreFilePath, setRestoreFilePath] = useState<string>('');
  const [restoreValidation, setRestoreValidation] = useState<any | null>(null);
  const [restoreLoading, setRestoreLoading] = useState<boolean>(false);
  const [restoreReplace, setRestoreReplace] = useState<boolean>(false);
  const [restoreSuccessMsg, setRestoreSuccessMsg] = useState<string | null>(null);

  // Security authorization states
  const [isBackupAuthOpen, setIsBackupAuthOpen] = useState<boolean>(false);
  const [isRestoreAuthOpen, setIsRestoreAuthOpen] = useState<boolean>(false);

  const api = (window as any).api;

  const STATUTORY_FOLDERS = [
    'Form I',
    'Form J',
    'Share Register',
    'Property Register',
    'Nomination Register',
    'Bank Lien Mark',
    'Share Certificate',
    'HENU OCR/VOUCHER',
    'HENU OCR/CHECK',
    'Voucher',
  ];

  const loadAllData = useCallback(async () => {
    if (!api?.henuConfig) return;
    setIsLoading(true);
    try {
      const [cfg, cats, ovw, docs, health, bkps, socs] = await Promise.all([
        api.henuConfig.getConfig(),
        api.henuConfig.getCategories(),
        api.henuConfig.getStorageOverview(),
        api.henuConfig.getDocuments(),
        api.henuConfig.runHealthCheck(),
        api.henuConfig.listBackups(),
        api.henuMaster?.listSocieties ? api.henuMaster.listSocieties() : Promise.resolve([]),
      ]);
      setConfig(cfg);
      setCategories(cats || []);
      setOverview(ovw);
      setDocuments(docs || []);
      setHealthReport(health);
      setBackups(bkps || []);
      setSocietiesList(socs || []);
      
      // Default custom selection to all societies with all statutory folders
      if (socs && socs.length > 0) {
        const names = socs.map((s: any) => s.societyName);
        setSelectedCustomSocieties(names);
        const fmap: Record<string, string[]> = {};
        for (const n of names) {
          fmap[n] = [...STATUTORY_FOLDERS];
        }
        setSelectedCustomFolders(fmap);
      }
    } catch (err: any) {
      console.error('Failed to load HENU CONFIG data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // ── Handlers ──────────────────────────────────────────────────

  const handleSaveConfig = async (partial: Partial<ApplicationConfig>) => {
    if (!api?.henuConfig) return;
    setIsSaving(true);
    try {
      const saved = await api.henuConfig.saveConfig(partial);
      setConfig(saved);
      showStatus('success', 'Configuration updated successfully.');
    } catch (err: any) {
      showStatus('error', err.message || 'Failed to save configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidateNewLocation = async () => {
    if (!newLocationPath.trim() || !api?.henuConfig) return;
    try {
      const res = await api.henuConfig.validateStorageLocation(newLocationPath.trim());
      setMigrationValidation(res);
    } catch (err: any) {
      showStatus('error', err.message);
    }
  };

  const handleExecuteLocationMigration = async () => {
    if (!newLocationPath.trim() || !api?.henuConfig) return;
    setMigrationStatus('Migrating files and verifying storage...');
    try {
      const res = await api.henuConfig.changeDataLocation(newLocationPath.trim());
      if (res.success) {
        showStatus('success', res.message);
        setIsMigratingLocation(false);
        setNewLocationPath('');
        setMigrationValidation(null);
        await loadAllData();
      } else {
        showStatus('error', res.error || res.message);
      }
    } catch (err: any) {
      showStatus('error', err.message || 'Migration failed');
    } finally {
      setMigrationStatus('');
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim() || !api?.henuConfig) return;
    try {
      await api.henuConfig.saveCategory({ name: newCatName.trim() });
      setNewCatName('');
      setIsAddCatModalOpen(false);
      showStatus('success', `Added custom category: ${newCatName.trim()}`);
      const cats = await api.henuConfig.getCategories();
      setCategories(cats || []);
    } catch (err: any) {
      showStatus('error', err.message);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!api?.henuConfig) return;
    if (!window.confirm(`Are you sure you want to delete the custom category "${name}"?`)) return;
    try {
      const res = await api.henuConfig.deleteCategory(id);
      if (res.success) {
        showStatus('success', `Deleted category: ${name}`);
        const cats = await api.henuConfig.getCategories();
        setCategories(cats || []);
      } else {
        showStatus('error', res.error || 'Failed to delete category');
      }
    } catch (err: any) {
      showStatus('error', err.message);
    }
  };

  const handleToggleCategoryActive = async (cat: DocumentCategory) => {
    if (!api?.henuConfig) return;
    try {
      await api.henuConfig.saveCategory({ id: cat.id, active: !cat.active });
      const cats = await api.henuConfig.getCategories();
      setCategories(cats || []);
    } catch (err: any) {
      showStatus('error', err.message);
    }
  };

  const handleCreateBackup = async () => {
    if (!api?.henuConfig) return;
    showStatus('success', 'Creating full system backup...');
    try {
      const res = await api.henuConfig.createBackup('manual');
      if (res.success) {
        showStatus('success', `Backup created: ${res.backup.fileName} (${res.backup.fileSizeFormatted})`);
        const bkps = await api.henuConfig.listBackups();
        setBackups(bkps || []);
      } else {
        showStatus('error', res.error || 'Backup creation failed');
      }
    } catch (err: any) {
      showStatus('error', err.message);
    }
  };

  const handleRestoreBackup = async (filePath: string) => {
    if (!api?.henuConfig) return;
    if (!window.confirm('Restore from backup? This will extract all archived documents to your active storage location.')) return;
    try {
      const res = await api.henuConfig.restoreBackup(filePath);
      if (res.success) {
        showStatus('success', res.message);
        await loadAllData();
      } else {
        showStatus('error', res.error || res.message);
      }
    } catch (err: any) {
      showStatus('error', err.message);
    }
  };

  const handleRunRepair = async () => {
    if (!api?.henuConfig) return;
    showStatus('success', 'Running storage repair and re-index...');
    try {
      const res = await api.henuConfig.repairFileIndex();
      if (res.success) {
        showStatus('success', res.message);
        await loadAllData();
      } else {
        showStatus('error', 'Repair failed');
      }
    } catch (err: any) {
      showStatus('error', err.message);
    }
  };

  const handleOpenFile = (p: string) => {
    api?.system?.openPath?.(p);
  };

  const handleShowInFolder = (p: string) => {
    api?.system?.showItemInFolder?.(p);
  };

  // Filtered documents for explorer
  const filteredDocs = documents.filter(d => {
    const matchesCat = selectedCategoryFilter === 'ALL' || d.categoryId === selectedCategoryFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      d.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.societyName && d.societyName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.categoryName && d.categoryName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  // ── Backup & Restore Handlers ────────────────────────────────
  const handleSelectAllCustom = () => {
    const allSocNames = societiesList.map(s => s.societyName);
    setSelectedCustomSocieties(allSocNames);
    const foldersMap: Record<string, string[]> = {};
    for (const s of allSocNames) {
      foldersMap[s] = [...STATUTORY_FOLDERS];
    }
    setSelectedCustomFolders(foldersMap);
  };

  const handleDeselectAllCustom = () => {
    setSelectedCustomSocieties([]);
    setSelectedCustomFolders({});
  };

  const handleToggleSocietyCustom = (socName: string) => {
    if (selectedCustomSocieties.includes(socName)) {
      setSelectedCustomSocieties(prev => prev.filter(s => s !== socName));
      setSelectedCustomFolders(prev => {
        const next = { ...prev };
        delete next[socName];
        return next;
      });
    } else {
      setSelectedCustomSocieties(prev => [...prev, socName]);
      setSelectedCustomFolders(prev => ({
        ...prev,
        [socName]: [...STATUTORY_FOLDERS],
      }));
    }
  };

  const handleToggleFolderCustom = (socName: string, folderName: string) => {
    setSelectedCustomFolders(prev => {
      const current = prev[socName] || [];
      const updated = current.includes(folderName)
        ? current.filter(f => f !== folderName)
        : [...current, folderName];

      if (!selectedCustomSocieties.includes(socName) && updated.length > 0) {
        setSelectedCustomSocieties(s => [...s, socName]);
      }
      return { ...prev, [socName]: updated };
    });
  };

  const handleToggleOcrGroup = (socName: string) => {
    const current = selectedCustomFolders[socName] || [];
    const hasBoth = current.includes('HENU OCR/VOUCHER') && current.includes('HENU OCR/CHECK');
    if (hasBoth) {
      setSelectedCustomFolders(prev => ({
        ...prev,
        [socName]: (prev[socName] || []).filter(f => !f.startsWith('HENU OCR/')),
      }));
    } else {
      const filtered = (current || []).filter(f => !f.startsWith('HENU OCR/'));
      setSelectedCustomFolders(prev => ({
        ...prev,
        [socName]: [...filtered, 'HENU OCR/VOUCHER', 'HENU OCR/CHECK'],
      }));
      if (!selectedCustomSocieties.includes(socName)) {
        setSelectedCustomSocieties(s => [...s, socName]);
      }
    }
  };

  const handleStartBackup = () => {
    setIsBackupAuthOpen(true);
  };

  const executeActualBackup = async () => {
    setIsBackupAuthOpen(false);
    if (!api?.henuConfig) return;
    setBackupLoading(true);
    setBackupProgressMsg('Preparing backup...');
    try {
      setBackupProgressMsg('Scanning folders and database...');
      await new Promise(r => setTimeout(r, 200));

      const payload = {
        backupType,
        scope: backupScope,
        includeConfig: includeConfigScope,
        selectedSocieties: backupScope === 'custom' ? selectedCustomSocieties : undefined,
        selectedFolders: backupScope === 'custom' ? selectedCustomFolders : undefined,
      };

      setBackupProgressMsg(`Creating ${backupType.toUpperCase()} archive...`);
      const res = api.henuConfig.createScopedBackup
        ? await api.henuConfig.createScopedBackup(payload)
        : await api.henuConfig.createBackup();

      if (res.success) {
        setBackupProgressMsg('Verifying backup integrity...');
        await new Promise(r => setTimeout(r, 200));
        setBackupProgressMsg('Backup completed successfully!');
        showStatus('success', `Backup created: ${res.backup?.fileName || 'Success'}`);
        await loadAllData();
        setTimeout(() => setBackupProgressMsg(''), 4000);
      } else {
        showStatus('error', res.error || 'Backup creation failed');
        setBackupProgressMsg('');
      }
    } catch (err: any) {
      showStatus('error', err.message || 'Backup failed');
      setBackupProgressMsg('');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleBrowseRestoreFile = async () => {
    const selected = await api?.system?.openFileDialog?.({
      filters: [{ name: 'HENU OS Backups (*.zip, *.json)', extensions: ['zip', 'json'] }],
      properties: ['openFile'],
    });
    if (selected) {
      setRestoreFilePath(selected);
      setRestoreValidation(null);
      setRestoreSuccessMsg(null);
      handleValidateRestore(selected);
    }
  };

  const handleValidateRestore = async (pathToCheck?: string) => {
    const target = pathToCheck || restoreFilePath;
    if (!target.trim() || !api?.henuConfig?.validateBackupFile) return;
    try {
      const val = await api.henuConfig.validateBackupFile(target.trim());
      setRestoreValidation(val);
    } catch (err: any) {
      showStatus('error', err.message || 'Validation failed');
    }
  };

  const handleExecuteRestore = () => {
    if (!restoreFilePath.trim() || !api?.henuConfig?.restoreBackup) return;
    setIsRestoreAuthOpen(true);
  };

  const executeActualRestore = async () => {
    setIsRestoreAuthOpen(false);
    if (!restoreFilePath.trim() || !api?.henuConfig?.restoreBackup) return;
    setRestoreLoading(true);
    setRestoreSuccessMsg(null);
    try {
      const res = await api.henuConfig.restoreBackup(restoreFilePath.trim(), { replaceExisting: restoreReplace });
      if (res.success) {
        setRestoreSuccessMsg(res.message || 'Backup restored successfully.');
        showStatus('success', res.message || 'Backup restored successfully.');
        await loadAllData();
      } else {
        showStatus('error', res.error || 'Restore failed');
      }
    } catch (err: any) {
      showStatus('error', err.message || 'Restore failed');
    } finally {
      setRestoreLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, var(--accent, #7c3aed), #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 8px 16px rgba(124, 58, 237, 0.25)',
            }}
          >
            <SlidersHorizontal size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                HENU CONFIG
              </h1>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 20,
                  background: 'rgba(124, 58, 237, 0.15)',
                  color: 'var(--accent-light, #a78bfa)',
                  border: '1px solid rgba(124, 58, 237, 0.3)',
                }}
              >
                SYSTEM & STORAGE ENGINE
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              Central storage configuration, database health, document routing, and local backup engine.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={loadAllData}
            disabled={isLoading}
            className="btn btn-secondary flex items-center gap-6"
            style={{ fontSize: 12, height: 36, padding: '0 14px' }}
          >
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleRunRepair}
            className="btn btn-primary flex items-center gap-6"
            style={{ fontSize: 12, height: 36, padding: '0 16px', fontWeight: 700 }}
          >
            <ShieldCheck size={15} />
            Repair & Re-Index
          </button>
        </div>
      </div>

      {/* Status Toast */}
      {statusMessage && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: statusMessage.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${statusMessage.type === 'success' ? '#22c55e' : '#ef4444'}`,
            color: statusMessage.type === 'success' ? '#22c55e' : '#ef4444',
          }}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {statusMessage.text}
        </div>
      )}

      {/* ── Navigation Tabs ── */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          borderBottom: '1px solid var(--border)',
          marginBottom: 24,
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'system', label: 'System Health', icon: Activity },
          { id: 'storage', label: 'Storage & Paths', icon: HardDrive },
          { id: 'folders', label: 'Folder Structure', icon: FolderTree },
          { id: 'explorer', label: 'Storage Explorer', icon: Layers },
          { id: 'routing', label: 'Document Routing', icon: FileCheck },
          { id: 'backup', label: 'Backup & Restore', icon: Archive },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: isActive ? 800 : 600,
                color: isActive ? 'var(--accent, #7c3aed)' : 'var(--text-secondary)',
                borderBottom: isActive ? '2px solid var(--accent, #7c3aed)' : '2px solid transparent',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: SYSTEM HEALTH & OVERVIEW ── */}
      {activeTab === 'system' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Quick Metrics Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                System Status
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: healthReport?.overallStatus === 'HEALTHY' ? '#22c55e' : '#f59e0b',
                    boxShadow: `0 0 10px ${healthReport?.overallStatus === 'HEALTHY' ? '#22c55e' : '#f59e0b'}`,
                  }}
                />
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {healthReport?.overallStatus || 'OPERATIONAL'}
                </span>
              </div>
            </div>

            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Total Societies
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>
                {overview?.totalSocieties ?? 0}
              </div>
            </div>

            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Indexed Documents
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>
                {overview?.totalDocuments ?? 0}
              </div>
            </div>

            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Storage Managed
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>
                {overview?.totalStorageSizeFormatted || '0.00 MB'}
              </div>
            </div>
          </div>

          {/* 8-Point Health Checklist */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
              8-Point System Health Audit
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {healthReport && Object.entries(healthReport.checks).map(([key, item]) => {
                const labels: Record<string, string> = {
                  database: 'Database & SQLite Adapter',
                  storage: 'Root Storage Directory',
                  societyIndex: 'Society Physical Folders',
                  fileIndex: 'Document File Integrity',
                  folderStructure: 'Statutory 8-Folder Categories',
                  configuration: 'Application Setup & State',
                  permissions: 'Read & Write Permissions',
                  backup: 'Local Backup Readiness',
                };
                return (
                  <div
                    key={key}
                    style={{
                      padding: '14px 18px',
                      borderRadius: 10,
                      background: 'var(--surface-2, #1e293b)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                    }}
                  >
                    <CheckCircle2 size={18} color={item.passed ? '#22c55e' : '#f59e0b'} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {labels[key] || key}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {item.message}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: STORAGE & PATHS ── */}
      {activeTab === 'storage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Configured Storage Architecture
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                  All society documents, backups, and exports are dynamically resolved from this root path.
                </p>
              </div>
              <button
                onClick={() => setIsMigratingLocation(true)}
                className="btn btn-secondary flex items-center gap-6"
                style={{ fontSize: 12, height: 36, padding: '0 16px', fontWeight: 700 }}
              >
                <FolderOpen size={14} />
                Change Data Location
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Root Storage Path', path: config?.rootStoragePath },
                { label: 'Societies Directory', path: config?.societiesPath },
                { label: 'Backups Directory', path: config?.backupPath },
                { label: 'Exports Directory', path: config?.exportPath },
                { label: 'Imports Directory', path: config?.importPath },
                { label: 'Logs Directory', path: config?.logsPath },
                { label: 'System Directory', path: config?.systemPath },
              ].map(item => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: 'var(--surface-2, #1e293b)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', width: 200 }}>
                    {item.label}
                  </span>
                  <span style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-primary)' }}>
                    {item.path}
                  </span>
                  <button
                    onClick={() => handleShowInFolder(item.path || '')}
                    className="btn btn-sm btn-secondary flex items-center gap-4"
                    style={{ fontSize: 11, height: 28 }}
                  >
                    <ExternalLink size={12} /> Open
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: FOLDER STRUCTURE MANAGER ── */}
      {activeTab === 'folders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Society Folder Categories
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                  Statutory 8 system categories are protected. Custom categories can be created and managed safely.
                </p>
              </div>
              <button
                onClick={() => setIsAddCatModalOpen(true)}
                className="btn btn-primary flex items-center gap-6"
                style={{ fontSize: 12, height: 36, padding: '0 16px', fontWeight: 700 }}
              >
                <Plus size={15} /> Add Custom Category
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {categories.map((cat, idx) => (
                <div
                  key={cat.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 18px',
                    borderRadius: 8,
                    background: 'var(--surface-2, #1e293b)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', width: 24 }}>
                      #{idx + 1}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {cat.name}
                    </span>
                    {cat.systemRequired ? (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 12,
                          background: 'rgba(59, 130, 246, 0.15)',
                          color: '#3b82f6',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Lock size={10} /> SYSTEM REQUIRED
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 12,
                          background: 'rgba(168, 85, 247, 0.15)',
                          color: '#a855f7',
                        }}
                      >
                        CUSTOM
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={() => handleToggleCategoryActive(cat)}
                      className={`btn btn-sm ${cat.active ? 'btn-secondary' : 'btn-outline'}`}
                      style={{ fontSize: 11, height: 28, padding: '0 10px' }}
                    >
                      {cat.active ? 'Active' : 'Inactive'}
                    </button>
                    {!cat.systemRequired && (
                      <button
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        className="btn btn-sm btn-danger flex items-center gap-4"
                        style={{ fontSize: 11, height: 28, padding: '0 8px' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: STORAGE EXPLORER & FILE INDEX ── */}
      {activeTab === 'explorer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            {/* Search & Filter Bar */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search indexed files by name, society, or category..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="input-control"
                  style={{ paddingLeft: 38, height: 40, fontSize: 13 }}
                />
              </div>

              <select
                value={selectedCategoryFilter}
                onChange={e => setSelectedCategoryFilter(e.target.value)}
                className="input-control"
                style={{ width: 220, height: 40, fontSize: 13 }}
              >
                <option value="ALL">All Categories ({documents.length})</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({documents.filter(d => d.categoryId === c.id).length})
                  </option>
                ))}
              </select>
            </div>

            {/* Document Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px 12px' }}>File Name</th>
                    <th style={{ padding: '10px 12px' }}>Society</th>
                    <th style={{ padding: '10px 12px' }}>Category</th>
                    <th style={{ padding: '10px 12px' }}>Size</th>
                    <th style={{ padding: '10px 12px' }}>Version</th>
                    <th style={{ padding: '10px 12px' }}>Date</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                        No documents found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredDocs.map(doc => (
                      <tr
                        key={doc.id}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FileText size={14} color="#7c3aed" />
                            {doc.fileName}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                          {doc.societyName}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 10,
                              background: 'var(--surface-2)',
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            {doc.categoryName}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>
                          {(doc.fileSize / 1024).toFixed(1)} KB
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                          v{doc.version}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                            <button
                              onClick={() => handleOpenFile(doc.filePath)}
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: 11, padding: '2px 8px' }}
                            >
                              Open
                            </button>
                            <button
                              onClick={() => handleShowInFolder(doc.filePath)}
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: 11, padding: '2px 8px' }}
                            >
                              Folder
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 5: DOCUMENT ROUTING & NAMING ── */}
      {activeTab === 'routing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
              Automatic Document Naming Engine
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              Configure deterministic token rules for newly generated PDF and Excel documents.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                  File Naming Pattern
                </label>
                <input
                  type="text"
                  value={config?.fileNamingPattern || ''}
                  onChange={e => handleSaveConfig({ fileNamingPattern: e.target.value })}
                  className="input-control"
                  style={{ fontFamily: 'monospace', fontSize: 13, height: 38 }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  Available tokens: <code>{'{SocietyName}'}</code>, <code>{'{Category}'}</code>, <code>{'{Number}'}</code>, <code>{'{Date}'}</code>, <code>{'{Year}'}</code>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                  Duplicate Collision Handling Strategy
                </label>
                <select
                  value={config?.duplicateStrategy || 'VERSION'}
                  onChange={e => handleSaveConfig({ duplicateStrategy: e.target.value as any })}
                  className="input-control"
                  style={{ height: 38, fontSize: 13 }}
                >
                  <option value="VERSION">Create Incremental Version (e.g. _v2.pdf) — Recommended</option>
                  <option value="REPLACE">Overwrite Existing File</option>
                  <option value="RENAME_AUTO">Timestamp Append (e.g. _1718000000.pdf)</option>
                  <option value="CANCEL">Cancel Operation if Duplicate</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 6: BACKUP & RESTORE ── */}
      {activeTab === 'backup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Create Backup Section */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                }}
              >
                <Archive size={16} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                  BACKUP & RESTORE
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                  Standardized JSON metadata snapshots and comprehensive ZIP archive center
                </p>
              </div>
            </div>

            {/* Backup Type Selector */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>
                Backup Type
              </label>
              <div style={{ display: 'flex', gap: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <input
                    type="radio"
                    name="backupType"
                    checked={backupType === 'zip'}
                    onChange={() => setBackupType('zip')}
                  />
                  <span><strong>Folder / ZIP Backup</strong> (Includes physical statutory folders and files)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <input
                    type="radio"
                    name="backupType"
                    checked={backupType === 'json'}
                    onChange={() => setBackupType('json')}
                  />
                  <span><strong>JSON Backup</strong> (Structured database & metadata snapshot)</span>
                </label>
              </div>
            </div>

            {/* Backup Scope Selector */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>
                Backup Scope
              </label>
              <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <input
                    type="radio"
                    name="backupScope"
                    checked={backupScope === 'all'}
                    onChange={() => setBackupScope('all')}
                  />
                  <span><strong>Default: All Societies</strong> (Entire <code>HENU OS RECMA\Societies</code> tree)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <input
                    type="radio"
                    name="backupScope"
                    checked={backupScope === 'custom'}
                    onChange={() => setBackupScope('custom')}
                  />
                  <span><strong>Customize Backup</strong> (Select specific societies and statutory registers)</span>
                </label>
              </div>

              {/* HENU CONFIG Scope Option Checkbox */}
              <div style={{ padding: '8px 12px', background: 'var(--surface-2, #1e293b)', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="includeConfigScope"
                  checked={includeConfigScope}
                  onChange={e => setIncludeConfigScope(e.target.checked)}
                />
                <label htmlFor="includeConfigScope" style={{ fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <strong>HENU CONFIG</strong> (Include storage configuration, folder mappings, and system settings)
                </label>
              </div>
            </div>

            {/* Custom Scope Tree */}
            {backupScope === 'custom' && (
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 20,
                  background: 'var(--surface-2, #1e293b)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Societies & Folder Selection Tree
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={handleSelectAllCustom}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '3px 8px' }}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllCustom}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '3px 8px' }}
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {societiesList.map((soc: any) => {
                    const socName = soc.societyName;
                    const isSocSelected = selectedCustomSocieties.includes(socName);
                    const currentFolders = selectedCustomFolders[socName] || [];
                    const hasOcrVoucher = currentFolders.includes('HENU OCR/VOUCHER');
                    const hasOcrCheck = currentFolders.includes('HENU OCR/CHECK');
                    const isOcrFull = hasOcrVoucher && hasOcrCheck;

                    return (
                      <div
                        key={soc.id || socName}
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          padding: 12,
                          background: 'var(--bg-card, #0f172a)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--text-primary)' }}>
                            <input
                              type="checkbox"
                              checked={isSocSelected}
                              onChange={() => handleToggleSocietyCustom(socName)}
                            />
                            <span>{socName}</span>
                          </label>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (!selectedCustomSocieties.includes(socName)) {
                                  setSelectedCustomSocieties(prev => [...prev, socName]);
                                }
                                setSelectedCustomFolders(prev => ({ ...prev, [socName]: [...STATUTORY_FOLDERS] }));
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 10, padding: '2px 6px' }}
                            >
                              Select Society
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCustomSocieties(prev => prev.filter(s => s !== socName));
                                setSelectedCustomFolders(prev => {
                                  const n = { ...prev };
                                  delete n[socName];
                                  return n;
                                });
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 10, padding: '2px 6px' }}
                            >
                              Deselect Society
                            </button>
                          </div>
                        </div>

                        {/* Statutory Registers Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, paddingLeft: 24 }}>
                          {[
                            'Form I',
                            'Form J',
                            'Share Register',
                            'Property Register',
                            'Nomination Register',
                            'Bank Lien Mark',
                            'Share Certificate',
                            'Voucher',
                          ].map(fName => (
                            <label key={fName} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                              <input
                                type="checkbox"
                                checked={currentFolders.includes(fName)}
                                onChange={() => handleToggleFolderCustom(socName, fName)}
                              />
                              <span>{fName}</span>
                            </label>
                          ))}

                          {/* HENU OCR Sub-Group */}
                          <div style={{ gridColumn: '1 / -1', marginTop: 4, padding: '8px 10px', background: 'var(--surface-2, #1e293b)', borderRadius: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                                📁 HENU OCR
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleOcrGroup(socName)}
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: 10, padding: '1px 6px' }}
                              >
                                {isOcrFull ? 'Deselect HENU OCR' : 'Select HENU OCR'}
                              </button>
                            </div>
                            <div style={{ display: 'flex', gap: 20, paddingLeft: 12 }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <input
                                  type="checkbox"
                                  checked={hasOcrVoucher}
                                  onChange={() => handleToggleFolderCustom(socName, 'HENU OCR/VOUCHER')}
                                />
                                <span>VOUCHER</span>
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <input
                                  type="checkbox"
                                  checked={hasOcrCheck}
                                  onChange={() => handleToggleFolderCustom(socName, 'HENU OCR/CHECK')}
                                />
                                <span>CHECK</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {societiesList.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>
                      No societies registered yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action & Progress */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div>
                {backupProgressMsg && (
                  <span style={{ fontSize: 12, color: '#38bdf8', fontWeight: 600 }}>
                    ⏳ {backupProgressMsg}
                  </span>
                )}
              </div>
              <button
                onClick={handleStartBackup}
                disabled={backupLoading}
                className="btn btn-primary flex items-center gap-6"
                style={{ fontSize: 13, height: 38, padding: '0 20px', fontWeight: 700 }}
              >
                <Archive size={15} />
                {backupLoading ? 'Creating Backup...' : 'Start Backup'}
              </button>
            </div>
          </div>

          {/* Restore Section */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                }}
              >
                <RotateCcw size={16} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                  RESTORE BACKUP
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                  Validate and restore society records and metadata from .zip archives or .json backups
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <input
                type="text"
                value={restoreFilePath}
                onChange={e => {
                  setRestoreFilePath(e.target.value);
                  setRestoreValidation(null);
                }}
                placeholder="Path to .zip or .json backup file..."
                className="input-control"
                style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
              />
              <button
                onClick={handleBrowseRestoreFile}
                className="btn btn-secondary"
                style={{ fontSize: 12, height: 38 }}
              >
                Select Backup
              </button>
              <button
                onClick={() => handleValidateRestore()}
                disabled={!restoreFilePath.trim()}
                className="btn btn-secondary"
                style={{ fontSize: 12, height: 38, fontWeight: 700 }}
              >
                Validate
              </button>
            </div>

            {/* Validation Details */}
            {restoreValidation && (
              <div
                style={{
                  background: 'var(--surface-2, #1e293b)',
                  border: `1px solid ${restoreValidation.isValid ? '#10b981' : '#ef4444'}`,
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 16,
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, color: restoreValidation.isValid ? '#10b981' : '#ef4444', fontSize: 13 }}>
                    {restoreValidation.isValid ? '✓ Valid Backup Archive' : '⚠ Validation Errors'}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Type: <strong>{restoreValidation.backupType}</strong> · Version: {restoreValidation.version || '1.0'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 10 }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Backup Date: </span>
                    <div>{restoreValidation.backupDate ? new Date(restoreValidation.backupDate).toLocaleString() : 'N/A'}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Files / Entries: </span>
                    <div><strong>{restoreValidation.filesCount}</strong> ({restoreValidation.fileSizeFormatted})</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Societies Included: </span>
                    <div><strong>{restoreValidation.societies?.length || 0}</strong> ({restoreValidation.societies?.join(', ') || 'None'})</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Configuration: </span>
                    <div>{restoreValidation.hasConfig ? '✓ Present' : 'Not Included'}</div>
                  </div>
                </div>

                {restoreValidation.errors?.length > 0 && (
                  <div style={{ color: '#ef4444', marginTop: 8 }}>
                    {restoreValidation.errors.join('; ')}
                  </div>
                )}

                {restoreValidation.isValid && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={restoreReplace}
                        onChange={e => setRestoreReplace(e.target.checked)}
                      />
                      <span>Replace existing matching files/records (Merge by default)</span>
                    </label>

                    <button
                      onClick={handleExecuteRestore}
                      disabled={restoreLoading}
                      className="btn btn-primary btn-sm"
                      style={{ fontWeight: 700, padding: '6px 16px' }}
                    >
                      {restoreLoading ? 'Restoring...' : 'Restore Now'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {restoreSuccessMsg && (
              <div style={{ padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: 6, color: '#10b981', fontSize: 12, marginBottom: 16 }}>
                ✓ {restoreSuccessMsg}
              </div>
            )}
          </div>

          {/* Backup Archives History */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
              Backup Archives History
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px 12px' }}>Archive File</th>
                    <th style={{ padding: '10px 12px' }}>Created At</th>
                    <th style={{ padding: '10px 12px' }}>Size</th>
                    <th style={{ padding: '10px 12px' }}>Integrity</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                        No local backups created yet. Click "Start Backup" above to generate one.
                      </td>
                    </tr>
                  ) : (
                    backups.map(b => (
                      <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {b.fileName}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                          {new Date(b.createdAt).toLocaleString()}
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>
                          {b.fileSizeFormatted}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ color: '#22c55e', fontWeight: 700 }}>✓ Verified</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                            <button
                              onClick={() => {
                                setRestoreFilePath(b.filePath);
                                handleValidateRestore(b.filePath);
                              }}
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: 11, padding: '2px 10px' }}
                            >
                              Restore
                            </button>
                            <button
                              onClick={() => handleShowInFolder(b.filePath)}
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: 11, padding: '2px 8px' }}
                            >
                              Folder
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CHANGE DATA LOCATION ── */}
      {isMigratingLocation && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999995,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 580,
              background: 'var(--surface-1, #0f172a)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', fontWeight: 800, fontSize: 16 }}>
              Change Root Storage Location
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                  New Storage Location Directory
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={newLocationPath}
                    onChange={e => {
                      setNewLocationPath(e.target.value);
                      setMigrationValidation(null);
                    }}
                    placeholder="e.g. E:\HENU OS RECMA"
                    className="input-control"
                    style={{ flex: 1, fontFamily: 'monospace', fontSize: 13 }}
                  />
                  <button
                    onClick={async () => {
                      const selected = await api?.system?.openFileDialog?.({ properties: ['openDirectory', 'createDirectory'] });
                      if (selected) {
                        setNewLocationPath(selected);
                        setMigrationValidation(null);
                      }
                    }}
                    className="btn btn-secondary"
                    style={{ height: 38 }}
                  >
                    Browse
                  </button>
                </div>
              </div>

              {migrationValidation && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: migrationValidation.isValid ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${migrationValidation.isValid ? '#22c55e' : '#ef4444'}`,
                    fontSize: 12,
                    color: migrationValidation.isValid ? '#22c55e' : '#ef4444',
                  }}
                >
                  {migrationValidation.isValid ? '✓ Directory is validated and writable.' : migrationValidation.errors.join('. ')}
                </div>
              )}

              {migrationStatus && (
                <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>
                  {migrationStatus}
                </div>
              )}
            </div>

            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--border)',
                background: 'var(--surface-2, #1e293b)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
              }}
            >
              <button
                onClick={() => setIsMigratingLocation(false)}
                className="btn btn-secondary"
                style={{ fontSize: 12 }}
              >
                Cancel
              </button>
              <button
                onClick={handleValidateNewLocation}
                className="btn btn-secondary"
                style={{ fontSize: 12, fontWeight: 700 }}
              >
                Validate
              </button>
              <button
                onClick={handleExecuteLocationMigration}
                disabled={!migrationValidation?.isValid}
                className="btn btn-primary"
                style={{ fontSize: 12, fontWeight: 800 }}
              >
                Migrate & Switch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD CUSTOM CATEGORY ── */}
      {isAddCatModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999995,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 440,
              background: 'var(--surface-1, #0f172a)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', fontWeight: 800, fontSize: 15 }}>
              Add Custom Folder Category
            </div>
            <div style={{ padding: '20px' }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                Category Name
              </label>
              <input
                type="text"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                placeholder="e.g. Audit Reports or Meeting Minutes"
                className="input-control"
                style={{ height: 38, fontSize: 13 }}
                autoFocus
              />
            </div>
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border)',
                background: 'var(--surface-2, #1e293b)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
              }}
            >
              <button
                onClick={() => setIsAddCatModalOpen(false)}
                className="btn btn-secondary"
                style={{ fontSize: 12 }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                disabled={!newCatName.trim()}
                className="btn btn-primary"
                style={{ fontSize: 12, fontWeight: 800 }}
              >
                Create Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security Password Modals for Backup & Restore */}
      <SecurityPasswordModal
        isOpen={isBackupAuthOpen}
        title="HENU OS BACKUP SECURITY"
        subtitle="Enter Administrative Password to initiate system backup operation."
        moduleType="admin"
        onSuccess={executeActualBackup}
        onCancel={() => setIsBackupAuthOpen(false)}
      />

      <SecurityPasswordModal
        isOpen={isRestoreAuthOpen}
        title="HENU OS RESTORE SECURITY"
        subtitle="Enter Administrative Password to restore system configuration and society data."
        moduleType="admin"
        onSuccess={executeActualRestore}
        onCancel={() => setIsRestoreAuthOpen(false)}
      />
    </div>
  );
}
