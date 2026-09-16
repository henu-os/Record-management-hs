import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Play, Download, CheckCircle, XCircle,
  AlertTriangle, ChevronRight, Loader, Eye, FolderOpen, RefreshCw, Layers,
  Lock, Unlock, ShieldAlert, Edit3, CheckSquare, ArrowLeft, Building2, Grid,
  Calendar, Award, FilePlus, Sparkles, Printer, Plus, Trash2, FileCheck
} from 'lucide-react';
import PdfViewer from '../components/PdfViewer';
import EditDataModal from '../components/EditDataModal';
import { FoundationStatus, Society } from '../../main/types';

function generateRange(fromStr: string, toStr: string, allowEmpty = false): string[] {
  const fromNum = parseInt(fromStr, 10);
  const toNum = parseInt(toStr, 10);
  if (isNaN(fromNum) || isNaN(toNum) || fromNum > toNum) return [];
  const padWidth = Math.max(fromStr.length, toStr.length, 1);
  const res: string[] = [];
  for (let i = fromNum; i <= toNum; i++) {
    res.push(String(i).padStart(padWidth, '0'));
  }
  return res;
}

const FORMS_META = [
  {
    id: 'FORM_I',
    title: 'Form I — Register of Members',
    category: 'Form I',
    description: 'Official member identity, entrance fees, address history, and share ledger.',
    zipName: 'FORM_I',
    defaultOrientation: 'Portrait' as const,
    fixedOrientation: true,
  },
  {
    id: 'FORM_J',
    title: 'Form J — List of Members',
    category: 'Form J',
    description: 'List of active co-partner members with class and residential details.',
    zipName: 'FORM_J',
    defaultOrientation: 'Portrait' as const,
    fixedOrientation: false,
  },
  {
    id: 'FORM_SHARE',
    title: 'Share Register',
    category: 'Share Register',
    description: 'Two-tier accounting register for share allotments, transfers, and folios.',
    zipName: 'SHARE_REGISTER',
    defaultOrientation: 'Landscape' as const,
    fixedOrientation: true,
  },
  {
    id: 'FORM_NOM',
    title: 'Nomination Register',
    category: 'Nomination Register',
    description: 'Nominee declarations, relationships, EC meeting dates, and share percentages.',
    zipName: 'NOMINATION_REGISTER',
    defaultOrientation: 'Landscape' as const,
    fixedOrientation: true,
  },
  {
    id: 'FORM_PROP',
    title: 'Property Register',
    category: 'Property Register',
    description: 'Tenement details, floor plans, area sq.ft., land & construction cost, and encumbrances.',
    zipName: 'PROPERTY_REGISTER',
    defaultOrientation: 'Landscape' as const,
    fixedOrientation: true,
  },
  {
    id: 'FORM_BANK',
    title: 'Bank Lien Mark Register',
    category: 'Bank Lien Mark',
    description: 'Financial institution loan account numbers, lien amounts, NOC dates, and status.',
    zipName: 'BANK_LINE_MARK',
    defaultOrientation: 'Portrait' as const,
    fixedOrientation: true,
  },
  {
    id: 'FORM_SHARE_CERT',
    title: 'Share Certificate (13" x 19")',
    category: 'Share Certificate',
    description: 'Premium 13x19 inch dual-page (Front & Back) share certificates for 300 GSM printing with 4 selectable templates.',
    zipName: 'SHARE_CERTIFICATE_13X19',
    defaultOrientation: 'Landscape' as const,
    fixedOrientation: false,
    isPreparation: false,
  },
  {
    id: 'FORM_VOUCHER',
    title: 'Payment Voucher (A4 Paper)',
    category: 'Voucher',
    description: 'Official Payment Voucher with complete financial calculation table (2 vouchers per A4 sheet).',
    zipName: 'PAYMENT_VOUCHER_A4',
    defaultOrientation: 'Portrait' as const,
    fixedOrientation: true,
    isPreparation: false,
  },
];

type Phase = 'idle' | 'previewing' | 'generating' | 'done' | 'error';
const PROGRESS_STEPS = ['Preparing pages...', 'Writing PDF...', 'Creating ZIP...', 'Complete.'];

export interface GenerateFormsProps {
  selectedFormId?: string;
  onNavigate?: (page: string) => void;
}

export default function GenerateForms({ selectedFormId, onNavigate }: GenerateFormsProps) {
  const [viewMode, setViewMode] = useState<'dashboard' | 'form_workflow'>(
    selectedFormId && selectedFormId !== 'CONTROL_CENTER' ? 'form_workflow' : 'dashboard'
  );
  const [formId, setFormId] = useState<string>(
    selectedFormId && selectedFormId !== 'CONTROL_CENTER' ? selectedFormId : 'FORM_I'
  );

  const [shareCertTemplateId, setShareCertTemplateId] = useState<string>('HENU_OS_DEFAULT');
  const [shareRegTemplateId, setShareRegTemplateId] = useState<'15_COLUMN' | '19_COLUMN'>('19_COLUMN');
  const [formJTemplateId, setFormJTemplateId] = useState<'TEMPLATE_1' | 'TEMPLATE_2'>('TEMPLATE_2');
  const [propRegTemplateId, setPropRegTemplateId] = useState<'TEMPLATE_1' | 'TEMPLATE_2'>('TEMPLATE_2');
  const [nomRegTemplateId, setNomRegTemplateId] = useState<'TEMPLATE_1' | 'TEMPLATE_2'>('TEMPLATE_2');
  const [voucherPaperSize, setVoucherPaperSize] = useState<'A4'>('A4');
  const [shareEmptyRows, setShareEmptyRows] = useState<number>(0);
  const [shareDataFontSize, setShareDataFontSize] = useState<number>(8.5);
  const [shareDataTextColor, setShareDataTextColor] = useState<string>('#002060');
  const [customHeaderImg, setCustomHeaderImg] = useState<string>(() => localStorage.getItem('henu_custom_marathi_header') || '');
  const [customAckImg, setCustomAckImg] = useState<string>(() => localStorage.getItem('henu_custom_marathi_ack') || '');
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState<boolean>(false);
  const [voucherTemplateId, setVoucherTemplateId] = useState<'TEMPLATE_1' | 'TEMPLATE_2'>('TEMPLATE_1');

  useEffect(() => {
    if (selectedFormId && selectedFormId !== 'CONTROL_CENTER') {
      setFormId(selectedFormId);
      setViewMode('form_workflow');
    } else {
      setViewMode('dashboard');
    }
  }, [selectedFormId]);

  // Multi-Society & Data State
  const [societies, setSocieties] = useState<Society[]>([]);
  const [activeSociety, setActiveSociety] = useState<Society | null>(null);
  const [summaryCounts, setSummaryCounts] = useState({
    totalMembers: 0,
    formI: 0,
    formJ: 0,
    share: 0,
    nomination: 0,
    property: 0,
    bank: 0,
    voucher: 0,
  });

  // Serial Range & Generation Options
  const [fromSerial, setFromSerial] = useState('001');
  const [toSerial, setToSerial] = useState('010');
  const [nonSerialCount, setNonSerialCount] = useState<number>(0);

  const [orientation, setOrientation] = useState<'Portrait' | 'Landscape'>('Portrait');
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [renderMode, setRenderMode] = useState<'Color' | 'BW'>('Color');
  const [gridOn, setGridOn] = useState<boolean>(true);
  const [selectedFont, setSelectedFont] = useState<string>('Times-Roman');
  const [prefix, setPrefix] = useState('');
  const [separator, setSeparator] = useState('-');

  // Details & Modals
  const [formDetails, setFormDetails] = useState<any | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasMasterData, setHasMasterData] = useState<boolean | null>(null);
  const [foundationStatus, setFoundationStatus] = useState<FoundationStatus | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Edit Data Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editModuleId, setEditModuleId] = useState<string>('formI');

  // History State
  const [historyEntries, setHistoryEntries] = useState<any[]>([]);

  const api = (window as any).api;

  // Load Dashboard Society Summary & History Context
  const loadDashboardContext = useCallback(async () => {
    if (!api) return;
    try {
      const [socList, activeSoc, masterData, history, status, foundation] = await Promise.all([
        api.society?.list ? api.society.list() : Promise.resolve([]),
        api.society?.getActive ? api.society.getActive() : Promise.resolve(null),
        api.masterData?.getWorkbook ? api.masterData.getWorkbook() : (api.masterData?.get ? api.masterData.get() : Promise.resolve(null)),
        api.history?.list ? api.history.list() : (api.history?.get ? api.history.get() : Promise.resolve([])),
        api.masterData?.getStatus ? api.masterData.getStatus() : Promise.resolve(null),
        api.foundation?.getStatus ? api.foundation.getStatus() : Promise.resolve(null),
      ]);

      setSocieties(socList || []);
      setActiveSociety(activeSoc || null);
      setHasMasterData(!!status);
      setFoundationStatus(foundation || null);
      setHistoryEntries(history || []);

      if (masterData) {
        const total = masterData.commonFile?.length || 0;
        setSummaryCounts({
          totalMembers: total,
          formI: masterData.formIData?.length || total,
          formJ: masterData.formJData?.length || total,
          share: masterData.shareData?.length || total,
          nomination: masterData.nominationData?.length || total,
          property: masterData.propertyData?.length || total,
          bank: masterData.bankLineMarkData?.length || total,
          voucher: masterData.voucherData?.length || 0,
        });
      } else {
        setSummaryCounts({
          totalMembers: 0, formI: 0, formJ: 0, share: 0, nomination: 0, property: 0, bank: 0, voucher: 0
        });
      }
    } catch (err) {
      console.error('Failed to load dashboard context:', err);
    }
  }, []);

  useEffect(() => {
    loadDashboardContext();
    const handleSocChange = () => {
      loadDashboardContext();
    };
    window.addEventListener('society-changed', handleSocChange);
    return () => window.removeEventListener('society-changed', handleSocChange);
  }, [loadDashboardContext]);

  // Sync prop changes
  useEffect(() => {
    if (selectedFormId) {
      openFormWorkflow(selectedFormId);
    }
  }, [selectedFormId]);

  // Open Form Workflow View
  const openFormWorkflow = (targetFormId: string) => {
    const meta = FORMS_META.find(f => f.id === targetFormId);
    if (!meta) return;
    setFormId(targetFormId);
    setOrientation(meta.defaultOrientation);
    setViewMode('form_workflow');
    setPreviewPdfUrl(null);
    setResult(null);
    setPhase('idle');
  };

  // Switch Active Society in Dashboard Selector
  const handleSocietyChange = async (socId: string) => {
    try {
      if (api?.society?.select) {
        await api.society.select(socId);
      } else if (api?.society?.setActive) {
        await api.society.setActive(socId);
      }
      await loadDashboardContext();
      const headerSelect = document.querySelector('header select') as HTMLSelectElement;
      if (headerSelect) {
        headerSelect.value = socId;
        headerSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } catch (err) {
      console.error('Failed to set active society:', err);
    }
  };

  // Fetch sheet details for active form
  const fetchFormDetails = useCallback(async () => {
    if (!hasMasterData || viewMode !== 'form_workflow' || formId === 'SHARE_CERT') return;
    try {
      const details = await api.masterData.getFormDetails(formId);
      if (details) {
        setFormDetails(details);
        if (details.availableMinSerial && details.availableMinSerial !== '—' && details.availableMaxSerial && details.availableMaxSerial !== '—') {
          setFromSerial(details.availableMinSerial);
          setToSerial(details.availableMaxSerial);
        }
      }
    } catch (err) {
      console.error('Failed to get form details:', err);
    }
  }, [formId, hasMasterData, viewMode]);

  useEffect(() => {
    fetchFormDetails();
  }, [fetchFormDetails]);

  // Subscribe to progress messages
  useEffect(() => {
    api.generate.onProgress((msg: string) => {
      setProgressLog(prev => [...prev, msg]);
      const idx = PROGRESS_STEPS.findIndex(s => msg.includes(s.split('...')[0]));
      if (idx >= 0) setCurrentStep(idx);
    });
    return () => {
      api.generate.removeProgressListener();
    };
  }, []);

  // Serial Range Calculations & Validation
  const fromClean = fromSerial.trim();
  const toClean = toSerial.trim();
  const fromNum = parseInt(fromClean.replace(/\D/g, ''), 10);
  const toNum = parseInt(toClean.replace(/\D/g, ''), 10);

  const isRangeValid = Boolean(
    (!fromClean && !toClean && nonSerialCount > 0) ||
    (fromClean && toClean && !isNaN(fromNum) && !isNaN(toNum) && fromNum <= toNum)
  );

  const rangeErrorText = (fromClean && toClean && !isNaN(fromNum) && !isNaN(toNum) && fromNum > toNum)
    ? 'From Serial No. cannot be greater than To Serial No.'
    : ((fromClean && !toClean) || (!fromClean && toClean))
      ? 'Both From and To Serial No. must be provided.'
      : (!fromClean && !toClean && nonSerialCount === 0)
        ? 'Please enter Serial Range (From/To) or Non Serial Count (> 0).'
        : '';

  // Update preview range
  const updateRangePreview = useCallback(async () => {
    if (!hasMasterData || viewMode !== 'form_workflow' || formId === 'SHARE_CERT') return;
    try {
      const prev = await api.generate.getPreviewRange(formId, fromClean, toClean, nonSerialCount);
      setPreview(prev);
    } catch (err) {
      console.error('Failed to get preview range:', err);
    }
  }, [formId, fromClean, toClean, nonSerialCount, hasMasterData, viewMode]);

  useEffect(() => {
    if (hasMasterData && viewMode === 'form_workflow') updateRangePreview();
  }, [updateRangePreview, hasMasterData, viewMode]);

  const isUnlocked = foundationStatus ? foundationStatus.registersUnlocked : Boolean(hasMasterData);
  const canGenerate = Boolean(isUnlocked && (hasMasterData || nonSerialCount > 0) && isRangeValid && phase !== 'generating' && !previewLoading);
  const isGenerating = phase === 'generating' || previewLoading;
  const selectedForm = FORMS_META.find(f => f.id === formId);

  // Full PDF Generation
  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setPhase('generating');
    setProgressLog(['Starting PDF generation pipeline...']);
    setCurrentStep(0);
    setResult(null);

    try {
      const targetForm = FORMS_META.find(f => f.id === formId);
      const activeTemplate =
        formId === 'FORM_SHARE_CERT' ? shareCertTemplateId :
          formId === 'FORM_SHARE' ? shareRegTemplateId :
            formId === 'FORM_J' ? formJTemplateId :
              formId === 'FORM_PROP' ? propRegTemplateId :
                formId === 'FORM_NOM' ? nomRegTemplateId :
                  formId === 'FORM_VOUCHER' ? voucherTemplateId : undefined;

      const activeWb = await api.masterData.getWorkbook();
      const res = await api.generate.execute({
        formId,
        fromSerial: fromClean,
        toSerial: toClean,
        nonSerialCount,
        templateId: activeTemplate,
        shareRegisterTemplateId: shareRegTemplateId,
        voucherPaperSize,
        voucherTemplateId,
        emptyRows: shareEmptyRows,
        dataFontSize: shareDataFontSize,
        dataTextColor: shareDataTextColor,
        orientationOverride: orientation,
        prefix: prefix.trim(),
        separator,
        rowsPerPage,
        renderMode,
        gridOn,
        fontFamily: selectedFont,
        headerImageBase64: (formId === 'FORM_VOUCHER' ? (activeSociety?.logoBase64 || '') : (customHeaderImg || activeSociety?.logoBase64)),
        ackImageBase64: customAckImg,
        zipFilenameHint: targetForm?.zipName,
        workbook: activeWb,
      });
      setResult(res);
      setPhase(res.success ? 'done' : 'error');
      if (res.previewPdfUrl) {
        setPreviewPdfUrl(res.previewPdfUrl);
      }
      loadDashboardContext(); // Refresh history counts
    } catch (err: any) {
      setResult({ success: false, errorMessage: err.message });
      setPhase('error');
    }
  }, [formId, fromClean, toClean, nonSerialCount, shareCertTemplateId, shareRegTemplateId, formJTemplateId, propRegTemplateId, nomRegTemplateId, voucherTemplateId, voucherPaperSize, shareEmptyRows, shareDataFontSize, shareDataTextColor, orientation, prefix, separator, rowsPerPage, renderMode, gridOn, selectedFont, customHeaderImg, customAckImg, activeSociety, canGenerate, loadDashboardContext]);

  // Live PDF preview
  const handlePreviewOnly = async () => {
    if (!isRangeValid) return;
    setPreviewLoading(true);
    setPreviewPdfUrl(null);
    setResult(null);

    const activeTemplate =
      formId === 'FORM_SHARE_CERT' ? shareCertTemplateId :
        formId === 'FORM_SHARE' ? shareRegTemplateId :
          formId === 'FORM_J' ? formJTemplateId :
            formId === 'FORM_PROP' ? propRegTemplateId :
              formId === 'FORM_NOM' ? nomRegTemplateId :
                formId === 'FORM_VOUCHER' ? voucherTemplateId : undefined;

    try {
      const activeWb = await api.masterData.getWorkbook();
      const res = await api.generate.previewPdf(formId, fromClean, toClean, {
        nonSerialCount,
        templateId: activeTemplate,
        shareRegisterTemplateId: shareRegTemplateId,
        voucherPaperSize,
        voucherTemplateId,
        emptyRows: shareEmptyRows,
        dataFontSize: shareDataFontSize,
        dataTextColor: shareDataTextColor,
        orientationOverride: orientation,
        prefix: prefix.trim(),
        separator,
        rowsPerPage,
        renderMode,
        gridOn,
        fontFamily: selectedFont,
        headerImageBase64: (formId === 'FORM_VOUCHER' ? (activeSociety?.logoBase64 || '') : (customHeaderImg || activeSociety?.logoBase64)),
        ackImageBase64: customAckImg,
        workbook: activeWb,
      });
      if (res.error) {
        setResult({ success: false, errorMessage: res.error });
        setPhase('error');
      } else if (res.previewPdfUrl) {
        setPreviewPdfUrl(res.previewPdfUrl);
      }
    } catch (err: any) {
      setResult({ success: false, errorMessage: err.message });
      setPhase('error');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Helper to resolve card record count
  const getRecordCountForForm = (id: string) => {
    switch (id) {
      case 'FORM_I': return summaryCounts.formI || summaryCounts.totalMembers || 0;
      case 'FORM_J': return summaryCounts.formJ || summaryCounts.totalMembers || 0;
      case 'FORM_SHARE': return summaryCounts.share || summaryCounts.totalMembers || 0;
      case 'FORM_NOM': return summaryCounts.nomination || summaryCounts.totalMembers || 0;
      case 'FORM_PROP': return summaryCounts.property || summaryCounts.totalMembers || 0;
      case 'FORM_BANK': return summaryCounts.bank || summaryCounts.totalMembers || 0;
      case 'FORM_SHARE_CERT': return summaryCounts.share || summaryCounts.totalMembers || 0;
      case 'FORM_VOUCHER': return (summaryCounts as any).voucher || 0;
      default: return summaryCounts.totalMembers || 0;
    }
  };

  // Open Edit Data Modal for specific card
  const handleOpenEditModal = (formId: string) => {
    const modMap: Record<string, string> = {
      'FORM_I': 'formI',
      'FORM_J': 'formJ',
      'FORM_SHARE': 'share',
      'FORM_NOM': 'nomination',
      'FORM_PROP': 'property',
      'FORM_BANK': 'bankLineMark',
      'FORM_SHARE_CERT': 'shareCert',
      'FORM_VOUCHER': 'voucher',
      'voucher': 'voucher',
    };
    setEditModuleId(modMap[formId] || formId);
    setIsEditModalOpen(true);
  };

  // Society Delete Modal State
  const [deletingSociety, setDeletingSociety] = useState<Society | null>(null);

  const handleDeleteSociety = async (soc: Society) => {
    setDeletingSociety(soc);
  };

  const confirmDeleteSociety = async () => {
    if (!deletingSociety || !api?.society?.delete) return;
    try {
      await api.society.delete(deletingSociety.id);
      setDeletingSociety(null);
      await loadDashboardContext();
    } catch (err: any) {
      alert(`Delete society error: ${err.message}`);
    }
  };

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER 1: GENERATE FORMS CONTROL CENTER
  // ═════════════════════════════════════════════════════════════════════════
  if (viewMode === 'dashboard') {
    return (
      <div style={{ padding: '24px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowY: 'auto', minHeight: '100vh' }}>

        {/* Dashboard Header Bar */}
        <div className="mb-24 pb-16" style={{ borderBottom: '1px solid var(--border)' }}>
          <h1 className="page-title text-xl fw-700 flex items-center gap-10">
            <Layers className="icon-accent" size={24} /> GENERATE FORMS CONTROL CENTER
          </h1>
          <p className="page-subtitle text-xs text-secondary mt-4">
            Centralized control center for official register generation, multi-society records, and system reports.
          </p>
        </div>

        {/* 1. SOCIETY DASHBOARD GRAPH & METRIC CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 24 }}>
          {/* Visual Graph / Progress Overview for Selected Society */}
          <div className="card" style={{ background: 'var(--surface)', padding: 20, border: '1px solid var(--border)', borderRadius: 10 }}>
            <h3 className="text-sm fw-700 text-primary mb-14 flex items-center gap-8">
              <Sparkles size={16} className="text-accent" /> Active Society Record Coverage — {activeSociety?.societyName}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Form I — Member Register', count: summaryCounts.formI, color: '#3b82f6' },
                { label: 'Form J — Member List', count: summaryCounts.formJ, color: '#10b981' },
                { label: 'Share Register', count: summaryCounts.share, color: '#8b5cf6' },
                { label: 'Nomination Register', count: summaryCounts.nomination, color: '#f59e0b' },
                { label: 'Property Register', count: summaryCounts.property, color: '#ec4899' },
                { label: 'Bank Lien Mark Register', count: summaryCounts.bank, color: '#06b6d4' },
              ].map(item => {
                const maxCount = Math.max(1, summaryCounts.totalMembers);
                const pct = Math.min(100, Math.round((item.count / maxCount) * 100));
                return (
                  <div key={item.label} style={{ fontSize: 12 }}>
                    <div className="flex justify-between mb-4">
                      <span className="fw-600 text-secondary">{item.label}</span>
                      <span className="fw-700 font-mono text-primary">{item.count} records ({pct}%)</span>
                    </div>
                    <div style={{ background: 'var(--surface-2)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: item.color, borderRadius: 4, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="card text-center" style={{ padding: 14, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="text-xs text-secondary mb-4 fw-600">Total Members</div>
              <div className="text-xl fw-700 text-primary">{summaryCounts.totalMembers}</div>
            </div>
            <div className="card text-center" style={{ padding: 14, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="text-xs text-secondary mb-4 fw-600">Forms Generated</div>
              <div className="text-xl fw-700 text-accent">{historyEntries.length}</div>
            </div>
            <div className="card text-center" style={{ padding: 14, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="text-xs text-secondary mb-4 fw-600">Total PDFs</div>
              <div className="text-xl fw-700 text-success">{historyEntries.reduce((sum, h) => sum + (h.count || 1), 0)}</div>
            </div>
            <div className="card text-center" style={{ padding: 14, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="text-xs text-secondary mb-4 fw-600">Blank Forms</div>
              <div className="text-xl fw-700 text-warning">0</div>
            </div>
            <div className="card text-center" style={{ gridColumn: 'span 2', padding: 14, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="text-xs text-secondary mb-4 fw-600">System Problems</div>
              <div className="text-xl fw-700 text-success">0 Problems</div>
            </div>
          </div>
        </div>

        {/* 2. QUICK ACTION SHORTCUTS */}
        <div className="mb-24 flex items-center gap-10 flex-wrap" style={{ background: 'var(--surface)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>
          <span className="text-xs fw-700 text-secondary flex items-center gap-6">
            <Sparkles size={14} className="text-accent" /> Quick Actions:
          </span>
          {FORMS_META.filter(f => !f.isPreparation).map(f => (
            <button
              key={f.id}
              className="btn btn-secondary btn-sm"
              onClick={() => openFormWorkflow(f.id)}
              style={{ fontSize: 11, padding: '4px 10px' }}
            >
              Generate {f.category}
            </button>
          ))}
        </div>

        {/* 3. FORM CARDS GRID (7 CARDS) */}
        <h3 className="text-sm fw-700 text-primary mb-12 flex items-center gap-8">
          <FileText size={16} className="text-accent" /> Official Register Forms & Modules
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
          marginBottom: 32
        }}>
          {FORMS_META.map(card => {
            const records = getRecordCountForForm(card.id);
            const isPrep = card.isPreparation;
            const statusLabel = isPrep ? 'PREPARATION' : records > 0 ? 'READY' : 'NO DATA';
            const statusBadgeClass = isPrep ? 'badge-warning' : records > 0 ? 'badge-success' : 'badge-secondary';

            return (
              <div
                key={card.id}
                className="card"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <h4 className="text-xs fw-700 text-primary flex items-center gap-6">
                      <FileText size={15} className="text-accent" /> {card.title}
                    </h4>
                    <span className={`badge ${statusBadgeClass}`} style={{ fontSize: 9 }}>
                      {statusLabel}
                    </span>
                  </div>
                  <p className="text-xs text-secondary" style={{ lineHeight: 1.4, minHeight: 34 }}>
                    {card.description}
                  </p>
                </div>

                <div style={{ background: 'var(--surface-2)', padding: '8px 10px', borderRadius: 6, fontSize: 11 }}>
                  <div className="flex justify-between mb-2">
                    <span className="text-secondary">Available Records:</span>
                    <span className="fw-700 text-primary">{isPrep ? '0' : records}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Status:</span>
                    <span className="fw-600">{statusLabel}</span>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {isPrep ? (
                    <button
                      className="btn btn-secondary btn-sm w-full"
                      onClick={() => alert('Share Certificate preparation module is ready for configuration.')}
                    >
                      Configure Module
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn btn-secondary btn-sm flex-1"
                        onClick={() => openFormWorkflow(card.id)}
                        style={{ fontSize: 11, padding: '4px 6px' }}
                      >
                        <Eye size={12} /> Preview
                      </button>
                      <button
                        className="btn btn-secondary btn-sm flex-1"
                        onClick={() => handleOpenEditModal(card.id)}
                        style={{ fontSize: 11, padding: '4px 6px' }}
                      >
                        <Edit3 size={12} /> Edit Data
                      </button>
                      <button
                        className="btn btn-primary btn-sm flex-1"
                        onClick={() => openFormWorkflow(card.id)}
                        style={{ fontSize: 11, padding: '4px 6px' }}
                      >
                        <Play size={12} /> Generate
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 4. SOCIETY MANAGEMENT SECTION */}
        <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: 18, marginBottom: 24 }}>
          <div className="flex items-center justify-between mb-12">
            <h3 className="text-sm fw-700 text-primary flex items-center gap-8">
              <Building2 size={16} className="text-accent" /> Society Management
            </h3>
            <button
              className="btn btn-primary btn-sm flex items-center gap-4"
              onClick={() => {
                const addBtn = document.querySelector('header button.btn-primary') as HTMLButtonElement;
                if (addBtn) addBtn.click();
              }}
            >
              <Plus size={13} /> Add Society
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '8px 12px' }}>Society Name</th>
                <th style={{ padding: '8px 12px' }}>Registration No.</th>
                <th style={{ padding: '8px 12px' }}>Member Count</th>
                <th style={{ padding: '8px 12px' }}>Status</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {societies.map(soc => {
                const isActive = soc.id === activeSociety?.id;
                return (
                  <tr key={soc.id} style={{ borderBottom: '1px solid var(--border)', background: isActive ? 'var(--cell-selected-bg)' : 'transparent' }}>
                    <td style={{ padding: '8px 12px' }} className="fw-700 text-primary">{soc.societyName}</td>
                    <td style={{ padding: '8px 12px' }} className="font-mono text-secondary">{soc.registrationNo || 'N/A'}</td>
                    <td style={{ padding: '8px 12px' }}>{isActive ? summaryCounts.totalMembers : '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span className={`badge ${isActive ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: 10 }}>
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-6">
                        {!isActive && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleSocietyChange(soc.id)}
                            style={{ fontSize: 11 }}
                          >
                            Select
                          </button>
                        )}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            handleSocietyChange(soc.id);
                            handleOpenEditModal('SOCIETY_MASTER');
                          }}
                          style={{ fontSize: 11 }}
                          title="Edit Society Details"
                        >
                          <Edit3 size={12} /> Edit
                        </button>
                        <button
                          className="btn btn-ghost btn-sm text-error"
                          onClick={() => handleDeleteSociety(soc)}
                          disabled={societies.length <= 1}
                          style={{ fontSize: 11 }}
                          title="Delete Society"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 5. ALL SOCIETIES OVERVIEW COMPARISON TABLE */}
        <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: 18, marginBottom: 24 }}>
          <h3 className="text-sm fw-700 text-primary mb-12 flex items-center gap-8">
            <Layers size={16} className="text-accent" /> All Societies Overview Comparison
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '8px 12px' }}>Society</th>
                <th style={{ padding: '8px 12px' }}>Members</th>
                <th style={{ padding: '8px 12px' }}>Form I</th>
                <th style={{ padding: '8px 12px' }}>Form J</th>
                <th style={{ padding: '8px 12px' }}>Share</th>
                <th style={{ padding: '8px 12px' }}>Nomination</th>
                <th style={{ padding: '8px 12px' }}>Property</th>
                <th style={{ padding: '8px 12px' }}>Bank</th>
              </tr>
            </thead>
            <tbody>
              {societies.map(soc => {
                const isActive = soc.id === activeSociety?.id;
                return (
                  <tr key={soc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px' }} className="fw-700">{soc.societyName}</td>
                    <td style={{ padding: '8px 12px' }}>{isActive ? summaryCounts.totalMembers : 0}</td>
                    <td style={{ padding: '8px 12px' }}>{isActive ? summaryCounts.formI : 0}</td>
                    <td style={{ padding: '8px 12px' }}>{isActive ? summaryCounts.formJ : 0}</td>
                    <td style={{ padding: '8px 12px' }}>{isActive ? summaryCounts.share : 0}</td>
                    <td style={{ padding: '8px 12px' }}>{isActive ? summaryCounts.nomination : 0}</td>
                    <td style={{ padding: '8px 12px' }}>{isActive ? summaryCounts.property : 0}</td>
                    <td style={{ padding: '8px 12px' }}>{isActive ? summaryCounts.bank : 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 6. RECENT GENERATION HISTORY */}
        <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: 18 }}>
          <h3 className="text-sm fw-700 text-primary mb-12 flex items-center gap-8">
            <Calendar size={16} className="text-accent" /> Recent Generation History ({activeSociety?.societyName})
          </h3>
          {historyEntries.length === 0 ? (
            <div className="text-xs text-secondary py-12 text-center">No recent generation history for active society.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '8px 12px' }}>Form</th>
                  <th style={{ padding: '8px 12px' }}>Date / Time</th>
                  <th style={{ padding: '8px 12px' }}>Records</th>
                  <th style={{ padding: '8px 12px' }}>Society</th>
                  <th style={{ padding: '8px 12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {historyEntries.slice(0, 5).map((h, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px' }} className="fw-600">{h.formId || 'Official Register'}</td>
                    <td style={{ padding: '8px 12px' }} className="text-secondary">{h.generatedAt ? new Date(h.generatedAt).toLocaleString() : 'Recent'}</td>
                    <td style={{ padding: '8px 12px' }}>{h.count || 1} PDFs</td>
                    <td style={{ padding: '8px 12px' }}>{h.societyName || activeSociety?.societyName || 'Active Society'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span className="badge badge-success" style={{ fontSize: 10 }}>Completed</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Delete Society Safety Confirmation Modal */}
        {deletingSociety && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{
              background: 'var(--surface)', padding: 24, borderRadius: 10,
              maxWidth: 440, width: '100%', border: '1px solid var(--border)', textAlign: 'center'
            }}>
              <h3 className="text-base fw-700 text-error mb-8 flex items-center justify-center gap-6">
                <Trash2 size={18} /> Confirm Permanent Deletion
              </h3>
              <p className="text-xs text-secondary mb-16" style={{ lineHeight: 1.5 }}>
                Delete Society <strong>"{deletingSociety.societyName}"</strong>?<br /><br />
                This will permanently remove:<br />
                • Master data & member records<br />
                • Form registers (Form I, J, Share, etc.)<br />
                • Design settings & configurations<br />
                • Generation history & exported metadata<br /><br />
                <span className="text-error fw-700">This action cannot be undone.</span>
              </p>
              <div className="flex items-center justify-center gap-10">
                <button
                  className="btn btn-primary btn-sm text-error"
                  style={{ background: 'var(--error, #ef4444)', borderColor: 'var(--error, #ef4444)', color: '#fff' }}
                  onClick={confirmDeleteSociety}
                >
                  Permanently Delete
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setDeletingSociety(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Data Modal */}
        <EditDataModal
          isOpen={isEditModalOpen}
          moduleId={editModuleId}
          onClose={() => setIsEditModalOpen(false)}
          onSaved={async () => {
            await loadDashboardContext();
            await fetchFormDetails();
            setPreviewPdfUrl(null);
          }}
        />
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER 2: INDIVIDUAL FORM GENERATION WORKFLOW
  // ═════════════════════════════════════════════════════════════════════════
  const selectedCount = (fromClean && toClean && !isNaN(fromNum) && !isNaN(toNum) && fromNum <= toNum)
    ? Math.max(0, toNum - fromNum + 1)
    : 0;

  const pfxStr = prefix.trim() ? `${prefix.trim()}${separator}` : '';
  const exampleFilename = formId === 'FORM_I'
    ? `${selectedForm?.zipName}_${pfxStr}${fromClean || 'BLANK'}.pdf`
    : `${selectedForm?.zipName}_${pfxStr}${fromClean || '001'}-${toClean || '001'}.pdf`;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }} className="generate-full-height">

      {/* ── LEFT PANEL — Controls ────────────────────────────── */}
      <div style={{
        width: 450, flexShrink: 0, overflowY: 'auto',
        borderRight: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: '20px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}>

        {/* Navigation Header */}
        <div className="flex items-center justify-between">
          <button
            className="btn btn-secondary btn-sm flex items-center gap-6"
            onClick={() => {
              if (onNavigate) {
                onNavigate('controlcenter');
              } else {
                setViewMode('dashboard');
              }
            }}
          >
            <ArrowLeft size={13} /> Control Center
          </button>

          <button
            className="btn btn-secondary btn-sm flex items-center gap-6"
            onClick={() => handleOpenEditModal(formId)}
            title="Edit Master Data for this Register"
          >
            <Edit3 size={13} /> Edit Data
          </button>
        </div>

        <div>
          <h1 className="page-title" style={{ fontSize: 18, marginBottom: 2 }}>{selectedForm?.title}</h1>
          <p className="page-subtitle" style={{ fontSize: 12 }}>{selectedForm?.description}</p>
        </div>

        {/* Register Locking Banner */}
        {foundationStatus && !foundationStatus.registersUnlocked && (
          <div className="alert alert-error mb-12" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: '12px 14px' }}>
            <div className="flex items-center gap-8 fw-700 text-sm">
              <Lock size={16} /> 🔒 Registers Locked
            </div>
            <div className="text-xs">
              Form registers are locked until both <strong>Society Master</strong> and <strong>Common Member Master</strong> are complete for the active society.
            </div>
          </div>
        )}

        {/* Master data warning */}
        {hasMasterData === false && (
          <div className="alert alert-error">
            <AlertTriangle size={14} />
            <div className="text-sm">No records available for this society. Upload master data or generate blank forms below.</div>
          </div>
        )}

        {/* Sheet Source Details */}
        {formDetails && (
          <div style={{
            background: 'var(--surface-2)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            padding: '10px 12px',
            fontSize: 11,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
            <div className="flex justify-between">
              <span className="text-secondary">Excel Sheet:</span>
              <span className="fw-600">[{formDetails.sheetName}]</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Available Records:</span>
              <span className="fw-600 text-accent">{formDetails.recordCount}</span>
            </div>
          </div>
        )}

        {/* ── SOCIETY PNG LOGO UPLOAD WIDGET ── */}
        <div style={{
          background: 'var(--surface-2)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          padding: '10px 12px',
        }}>
          <div className="flex items-center justify-between mb-8">
            <span className="text-xs fw-700 text-primary">🖼️ Society Logo (Header Top-Left)</span>
            <span className="badge badge-secondary" style={{ fontSize: 9 }}>PNG Only</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {activeSociety?.logoBase64 ? (
              <div style={{ width: 40, height: 40, borderRadius: 6, border: '1px solid var(--border)', overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <img src={activeSociety.logoBase64} alt="Society Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
            ) : (
              <div style={{ width: 40, height: 40, borderRadius: 6, border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--text-muted)', flexShrink: 0, textAlign: 'center', lineHeight: 1.1 }}>
                No Logo
              </div>
            )}
            <div style={{ flex: 1 }}>
              <input
                type="file"
                accept="image/png"
                id="header-logo-upload"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!file.type.includes('png')) {
                    alert('Please select a PNG format image only.');
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = async () => {
                    const b64 = reader.result as string;
                    if (activeSociety && api?.society?.updateLogo) {
                      await api.society.updateLogo(activeSociety.id, b64);
                      await loadDashboardContext();
                      setActiveSociety((prev: any) => prev ? { ...prev, logoBase64: b64 } : prev);
                      setPreviewPdfUrl(null);
                    }
                  };
                  reader.readAsDataURL(file);
                }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <label
                  htmlFor="header-logo-upload"
                  className="btn btn-secondary btn-xs flex items-center gap-4"
                  style={{ cursor: 'pointer', fontSize: 10, padding: '3px 8px' }}
                >
                  {activeSociety?.logoBase64 ? 'Change PNG' : 'Upload PNG'}
                </label>
                {activeSociety?.logoBase64 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-error"
                    style={{ fontSize: 10, padding: '3px 6px' }}
                    onClick={async () => {
                      if (activeSociety && api?.society?.updateLogo) {
                        await api.society.updateLogo(activeSociety.id, '');
                        await loadDashboardContext();
                        setActiveSociety((prev: any) => prev ? { ...prev, logoBase64: '' } : prev);
                        setPreviewPdfUrl(null);
                      }
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="text-secondary mt-2" style={{ fontSize: 9 }}>
                Square PNG format · Displayed inside official header box
              </div>
            </div>
          </div>
        </div>


        {formId === 'FORM_J' ? (
          <div className="flex flex-col gap-10">
            <div className="card" style={{ padding: '12px 14px', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <div className="form-label flex items-center gap-6" style={{ marginBottom: 8, fontWeight: 700 }}>
                <FileText size={13} className="text-accent" /> Form J Template (2 Styles Available)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, marginBottom: 8 }}>
                {[
                  { id: 'TEMPLATE_1', title: 'Template 1: Standard (Compact)', sub: 'Single-Row per Member · Comma-separated joint members' },
                  { id: 'TEMPLATE_2', title: 'Template 2: HENU OS Default (Joint Members Multi-Row)', sub: 'Separate row per joint member + empty rows' },
                ].map(t => {
                  const isSel = formJTemplateId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`btn btn-sm ${isSel ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setFormJTemplateId(t.id as any)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        textAlign: 'left',
                        padding: '8px 12px',
                        height: 'auto',
                        width: '100%',
                        borderRadius: 8,
                        border: isSel ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700 }}>{t.title}</span>
                      <span style={{ fontSize: 9, opacity: 0.8, marginTop: 2 }}>{t.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="form-label" style={{ marginBottom: 6 }}>Orientation (Selectable for Form J)</div>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', fontWeight: orientation === 'Portrait' ? 700 : 400 }}>
                  <input
                    type="radio"
                    name="orientation"
                    value="Portrait"
                    checked={orientation === 'Portrait'}
                    onChange={() => setOrientation('Portrait')}
                    style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  Portrait
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', fontWeight: orientation === 'Landscape' ? 700 : 400 }}>
                  <input
                    type="radio"
                    name="orientation"
                    value="Landscape"
                    checked={orientation === 'Landscape'}
                    onChange={() => setOrientation('Landscape')}
                    style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  Landscape
                </label>
              </div>
            </div>
          </div>
        ) : formId === 'FORM_PROP' ? (
          <div className="card" style={{ padding: '12px 14px', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <div className="form-label flex items-center gap-6" style={{ marginBottom: 8, fontWeight: 700 }}>
              <Building2 size={13} className="text-accent" /> Property Register Template (2 Styles Available)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, marginBottom: 8 }}>
              {[
                { id: 'TEMPLATE_1', title: 'Template 1: Standard (Compact)', sub: 'Single-Row per Property · Complete tenement details' },
                { id: 'TEMPLATE_2', title: 'Template 2: HENU OS Default (Joint Members Multi-Row)', sub: 'Separate row per joint member + empty rows' },
              ].map(t => {
                const isSel = propRegTemplateId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`btn btn-sm ${isSel ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setPropRegTemplateId(t.id as any)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      textAlign: 'left',
                      padding: '8px 12px',
                      height: 'auto',
                      width: '100%',
                      borderRadius: 8,
                      border: isSel ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{t.title}</span>
                    <span style={{ fontSize: 9, opacity: 0.8, marginTop: 2 }}>{t.sub}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
              Format: Legal Landscape · 13 Columns (Distinguishing No, Land & Const Cost)
            </div>
          </div>
        ) : formId === 'FORM_NOM' ? (
          <div className="card" style={{ padding: '12px 14px', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <div className="form-label flex items-center gap-6" style={{ marginBottom: 8, fontWeight: 700 }}>
              <FileText size={13} className="text-accent" /> Nomination Register Template (2 Styles Available)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, marginBottom: 8 }}>
              {[
                { id: 'TEMPLATE_1', title: 'Template 1: Standard (Compact)', sub: 'Single-Row per Nomination · Complete nominee details' },
                { id: 'TEMPLATE_2', title: 'Template 2: HENU OS Default (Joint Members Multi-Row)', sub: 'Separate row per joint member + empty rows' },
              ].map(t => {
                const isSel = nomRegTemplateId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`btn btn-sm ${isSel ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setNomRegTemplateId(t.id as any)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      textAlign: 'left',
                      padding: '8px 12px',
                      height: 'auto',
                      width: '100%',
                      borderRadius: 8,
                      border: isSel ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{t.title}</span>
                    <span style={{ fontSize: 9, opacity: 0.8, marginTop: 2 }}>{t.sub}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
              Format: Legal Landscape · 8 Columns (Date, Nominee Name & Address, Percentage)
            </div>
          </div>
        ) : formId === 'FORM_SHARE_CERT' ? (
          <div className="card" style={{ padding: '12px 14px', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <div className="form-label flex items-center gap-6" style={{ marginBottom: 8, fontWeight: 700 }}>
              <FileCheck size={13} className="text-accent" /> Share Certificate Templates (3 Styles Available)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, marginBottom: 8 }}>
              {[
                { id: 'HENU_OS_DEFAULT', title: 'HENU OS Default', sub: 'HENU OS Master Style (19" × 13" Landscape · 350 GSM · 3-Panel Red/Gold)', orientation: 'Landscape' },
                { id: 'HENU_OS_2', title: 'Template 1: Master Style', sub: 'Master Style (19" × 13" Landscape · Marathi Devanagari / English · Red/Gold)', orientation: 'Landscape' },
                { id: 'HENU_OS_3', title: 'Template 2: Luxury Master Style', sub: 'Luxury Master Style (13" × 9" Landscape · Purple & Gold · 3-Panel Front & Back)', orientation: 'Landscape' },
              ].map(t => {
                const isSel = shareCertTemplateId === t.id || (shareCertTemplateId === 'DESIGN_A_LANDSCAPE' && t.id === 'HENU_OS_DEFAULT');
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`btn btn-sm ${isSel ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                      setShareCertTemplateId(t.id as any);
                      setOrientation(t.orientation as any);
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      textAlign: 'left',
                      padding: '8px 12px',
                      height: 'auto',
                      width: '100%',
                      borderRadius: 8,
                      border: isSel ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{t.title}</span>
                    <span style={{ fontSize: 9, opacity: 0.8, marginTop: 2 }}>{t.sub}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
              Selected: <strong>{shareCertTemplateId === 'HENU_OS_3' || shareCertTemplateId === 'POLARIS_LUXURY_13X9' ? '13x9 inches (Landscape · Polaris)' : '19x13 inches (Landscape)'}</strong> · 2 Pages (Front & Back)
            </div>

            {/* Custom Image Uploaders for Marathi Template & Custom Certificate */}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>
                Upload Custom Certificate Images (2 Images Supported)
              </div>

              {/* Image 1: Society & Member Copy Header Banner */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-app)', padding: '6px 8px', borderRadius: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {customHeaderImg ? (
                    <img src={customHeaderImg} alt="Header" style={{ height: 28, maxWidth: 80, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 2 }} />
                  ) : (
                    <span style={{ fontSize: 10, opacity: 0.7 }}>Default Banner</span>
                  )}
                  <span style={{ fontSize: 10, fontWeight: 600 }}>Image 1 (Header Banner)</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <label className="btn btn-xs btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
                    Upload
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          const b64 = reader.result as string;
                          setCustomHeaderImg(b64);
                          localStorage.setItem('henu_custom_marathi_header', b64);
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {customHeaderImg && (
                    <button
                      className="btn btn-xs btn-ghost text-danger"
                      onClick={() => {
                        setCustomHeaderImg('');
                        localStorage.removeItem('henu_custom_marathi_header');
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Image 2: Left Acknowledgement Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-app)', padding: '6px 8px', borderRadius: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {customAckImg ? (
                    <img src={customAckImg} alt="Ack" style={{ height: 28, maxWidth: 80, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 2 }} />
                  ) : (
                    <span style={{ fontSize: 10, opacity: 0.7 }}>Default Badge</span>
                  )}
                  <span style={{ fontSize: 10, fontWeight: 600 }}>Image 2 (Ack Header)</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <label className="btn btn-xs btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
                    Upload
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          const b64 = reader.result as string;
                          setCustomAckImg(b64);
                          localStorage.setItem('henu_custom_marathi_ack', b64);
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {customAckImg && (
                    <button
                      className="btn btn-xs btn-ghost text-danger"
                      onClick={() => {
                        setCustomAckImg('');
                        localStorage.removeItem('henu_custom_marathi_ack');
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : formId === 'FORM_SHARE' ? (
          <div className="card" style={{ padding: '12px 14px', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <div className="form-label flex items-center gap-6" style={{ marginBottom: 8, fontWeight: 700 }}>
              <FileCheck size={13} className="text-accent" /> Share Register Template (2 Styles Available)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, marginBottom: 8 }}>
              {[
                { id: '15_COLUMN', title: 'Template 1: Compact (15-Col)', sub: '15 Columns · Standard (Removes Old Share Cert, Old Membership, Distinctive Nos)' },
                { id: '19_COLUMN', title: 'Template 2: HENU OS Default (19-Col Full Register)', sub: '19 Columns · Complete (Includes Old Share Cert, Old Membership, Distinctive Nos)' },
              ].map(t => {
                const isSel = shareRegTemplateId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`btn btn-sm ${isSel ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setShareRegTemplateId(t.id as any)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      textAlign: 'left',
                      padding: '8px 12px',
                      height: 'auto',
                      width: '100%',
                      borderRadius: 8,
                      border: isSel ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{t.title}</span>
                    <span style={{ fontSize: 9, opacity: 0.8, marginTop: 2 }}>{t.sub}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
              Format: Legal Landscape · Max 14 Rows/Page (Auto-balanced height without bottom blank space)
            </div>
          </div>
        ) : formId === 'FORM_VOUCHER' ? (
          <div className="card" style={{ padding: '12px 14px', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <div className="form-label flex items-center gap-6" style={{ marginBottom: 8, fontWeight: 700 }}>
              <FileText size={13} className="text-accent" /> Voucher Template (2 Styles Available)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, marginBottom: 8 }}>
              {[
                { id: 'TEMPLATE_1', title: 'Template 1: Detailed Financial Calculation', sub: 'Master Aishwarya Heights style · Bill Amount, TDS, CGST, SGST, Net Paid' },
                { id: 'TEMPLATE_2', title: 'Template 2: Open Ledger Grid Style', sub: 'Open ledger narration & financial rows (2 vouchers per A4 sheet)' },
              ].map(t => {
                const isSel = voucherTemplateId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`btn btn-sm ${isSel ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setVoucherTemplateId(t.id as any)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      textAlign: 'left',
                      padding: '8px 12px',
                      height: 'auto',
                      width: '100%',
                      borderRadius: 8,
                      border: isSel ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{t.title}</span>
                    <span style={{ fontSize: 9, opacity: 0.8, marginTop: 2 }}>{t.sub}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
              Orientation: <strong>Portrait</strong> (Fixed format for Payment Voucher · 2 vouchers per A4 sheet)
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            Orientation: <strong>{orientation}</strong> (Fixed legal format for {selectedForm?.title})
          </div>
        )}

        {/* COLOR MODE, GRID LINES & PAPER SIZE / EMPTY ROWS CONTROLS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: ['FORM_SHARE', 'FORM_J', 'FORM_PROP', 'FORM_NOM'].includes(formId)
            ? '1fr 1fr 1.5fr'
            : (formId === 'FORM_VOUCHER' ? '1fr 1fr 1.5fr' : '1fr 1fr'),
          gap: 12
        }}>
          <div>
            <div className="form-label" style={{ marginBottom: 6 }}>Color Mode</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', fontWeight: renderMode === 'Color' ? 700 : 400 }}>
                <input
                  type="radio"
                  name="renderMode"
                  checked={renderMode === 'Color'}
                  onChange={() => setRenderMode('Color')}
                  style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                Color
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', fontWeight: renderMode === 'BW' ? 700 : 400 }}>
                <input
                  type="radio"
                  name="renderMode"
                  checked={renderMode === 'BW'}
                  onChange={() => setRenderMode('BW')}
                  style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                B&W
              </label>
            </div>
          </div>

          <div>
            <div className="form-label" style={{ marginBottom: 6 }}>Grid Lines</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={gridOn}
                  onChange={e => setGridOn(e.target.checked)}
                  style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                {gridOn ? 'Grid ON' : 'Grid OFF'}
              </label>
            </div>
          </div>

          {formId === 'FORM_VOUCHER' && (
            <div>
              <div className="form-label" style={{ marginBottom: 6 }}>Paper Size</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
                  <input
                    type="radio"
                    name="voucherPaperSize"
                    checked={true}
                    readOnly
                    style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  A4 (2 Vouchers / Page)
                </label>
              </div>
            </div>
          )}

          {['FORM_SHARE', 'FORM_J', 'FORM_PROP', 'FORM_NOM'].includes(formId) && (
            <div>
              <div className="form-label" style={{ marginBottom: 6 }}>Empty Rows per Entry (0–6)</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <select
                  value={shareEmptyRows}
                  onChange={e => setShareEmptyRows(Number(e.target.value))}
                  className="input-control text-xs"
                  style={{ width: '100%', height: 32, padding: '4px 8px', background: 'transparent', cursor: 'pointer' }}
                >
                  <option value={0}>0 Empty Rows (Default)</option>
                  <option value={1}>1 Empty Row below names</option>
                  <option value={2}>2 Empty Rows below names</option>
                  <option value={3}>3 Empty Rows below names</option>
                  <option value={4}>4 Empty Rows below names</option>
                  <option value={5}>5 Empty Rows below names</option>
                  <option value={6}>6 Empty Rows below names</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* PDF TYPOGRAPHY / FONT SELECTOR (6 FONTS) */}
        <div className="card" style={{ padding: '12px 14px', border: '1px solid var(--border)', background: 'var(--surface-2)', marginTop: 10 }}>
          <div className="flex items-center justify-between mb-8">
            <div className="form-label flex items-center gap-6" style={{ fontWeight: 700, fontSize: 11, margin: 0 }}>
              <FileText size={13} className="text-accent" /> Document Typography (6 Options)
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Default: <strong>Times-Roman</strong>
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 6 }}>
            {[
              { id: 'Times-Roman', label: 'Times-Roman', sub: 'Classic Serif Standard (Default)' },
              { id: 'Helvetica', label: 'Helvetica', sub: 'Sans-Serif Standard' },
              { id: 'Courier', label: 'Courier', sub: 'Monospace Standard' },
              { id: 'Helvetica-Bold', label: 'Helvetica-Bold', sub: 'Sans-Serif Accent' },
              { id: 'Indie_Flower', label: 'Indie Flower', sub: 'Handwritten Style' },
              { id: 'Merriweather', label: 'Merriweather', sub: 'Modern Editorial Serif' },
            ].map(f => {
              const isSel = selectedFont === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setSelectedFont(f.id);
                    setPreviewPdfUrl(null);
                  }}
                  className={`btn btn-xs ${isSel ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    textAlign: 'left',
                    padding: '6px 8px',
                    height: 'auto',
                    border: isSel ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{f.label}</span>
                  <span style={{ fontSize: 9, opacity: 0.75 }}>{f.sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SCRAPED / INPUT DATA FONT SIZE & COLOR CUSTOMIZATION */}
        {['FORM_SHARE', 'FORM_J', 'FORM_PROP', 'FORM_NOM'].includes(formId) && (
          <div className="card" style={{ padding: '10px 12px', border: '1px solid var(--border)', background: 'var(--surface-2)', marginTop: 10 }}>
            <div className="form-label" style={{ marginBottom: 6, fontWeight: 700, fontSize: 11 }}>
              Scraped / Input Data Styling (Column Headers Fixed at 6.5–7 pt)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div className="text-secondary mb-4" style={{ fontSize: 10 }}>
                  Data Font Size: <strong>{shareDataFontSize} pt</strong> (Limit: 7.5 – 12.5 pt)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="range"
                    min="7.5"
                    max="12.5"
                    step="0.5"
                    value={shareDataFontSize}
                    onChange={e => setShareDataFontSize(parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <span className="badge badge-secondary font-mono" style={{ fontSize: 10, minWidth: 44, textAlign: 'center' }}>
                    {shareDataFontSize} pt
                  </span>
                </div>
              </div>

              <div>
                <div className="text-secondary mb-4" style={{ fontSize: 10 }}>
                  Text Color: <strong>{shareDataTextColor}</strong>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={shareDataTextColor}
                    onChange={e => setShareDataTextColor(e.target.value)}
                    style={{ width: 28, height: 26, border: 'none', background: 'transparent', cursor: 'pointer' }}
                  />
                  {[
                    { label: 'Navy (Default)', color: '#1C355E' },
                    { label: 'Black', color: '#000000' },
                    { label: 'Dark Gray', color: '#333333' },
                  ].map(p => (
                    <button
                      key={p.color}
                      type="button"
                      onClick={() => setShareDataTextColor(p.color)}
                      className="btn btn-ghost btn-xs"
                      style={{
                        fontSize: 9,
                        padding: '2px 5px',
                        border: shareDataTextColor === p.color ? '1px solid var(--primary)' : '1px solid var(--border)',
                        fontWeight: shareDataTextColor === p.color ? 700 : 400,
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SERIAL NUMBER RANGE SELECTION */}
        <div className="card" style={{ padding: '14px 16px', border: '1px solid var(--border)', background: 'var(--surface-2)', marginTop: 12 }}>
          <h3 className="text-xs fw-700 text-primary mb-12 flex items-center gap-6" style={{ letterSpacing: '0.4px', textTransform: 'uppercase' }}>
            <Layers size={14} className="text-accent" /> {formId === 'FORM_VOUCHER' ? 'Voucher Number Range' : 'Serial Number Range'}
          </h3>

          {/* Row 1: From Serial & To Serial */}
          <div className="grid-2 gap-10 mb-10">
            <div>
              <label className="form-label" style={{ fontSize: 11, marginBottom: 4 }}>
                {formId === 'FORM_VOUCHER' ? 'From Voucher No.' : 'From Serial No.'}
              </label>
              <input
                type="text"
                className="input-control text-xs"
                placeholder="e.g. 001"
                value={fromSerial}
                onChange={e => setFromSerial(e.target.value)}
                style={{ height: 34 }}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 11, marginBottom: 4 }}>
                {formId === 'FORM_VOUCHER' ? 'To Voucher No.' : 'To Serial No.'}
              </label>
              <input
                type="text"
                className="input-control text-xs"
                placeholder="e.g. 010"
                value={toSerial}
                onChange={e => setToSerial(e.target.value)}
                style={{ height: 34 }}
              />
            </div>
          </div>

          {/* Row 2: Non-Serial / Blank Forms, Prefix, Separator (Fixed label heights for perfect alignment) */}
          <div className="grid-3 gap-8 mb-12">
            <div>
              <label className="form-label" style={{ fontSize: 10, height: 22, display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                {formId === 'FORM_VOUCHER' ? 'Blank Vouchers' : 'Blank Forms'}
              </label>
              <input
                type="number"
                min="0"
                max="100"
                className="input-control text-xs"
                value={nonSerialCount}
                onChange={e => setNonSerialCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                style={{ height: 34 }}
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: 10, height: 22, display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                Prefix
              </label>
              <input
                type="text"
                className="input-control text-xs"
                placeholder="e.g. HENU"
                value={prefix}
                onChange={e => setPrefix(e.target.value)}
                style={{ height: 34 }}
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: 10, height: 22, display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                Separator
              </label>
              <select
                className="input-control text-xs"
                value={separator}
                onChange={e => setSeparator(e.target.value)}
                style={{ height: 34 }}
              >
                <option value="-">- (Hyphen)</option>
                <option value="_">_ (Underscore)</option>
                <option value=":">: (Colon)</option>
                <option value=".">. (Dot)</option>
                <option value="/">/ (Slash)</option>
              </select>
            </div>
          </div>

          {/* Validation Error Message */}
          {rangeErrorText && (
            <div className="text-xs text-error fw-600 mb-10 flex items-center gap-4">
              <AlertTriangle size={12} /> {rangeErrorText}
            </div>
          )}

          {/* Sleek Metrics Stat Cards (3 Counters) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 8,
            marginBottom: 10
          }}>
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 10px',
              textAlign: 'center',
            }}>
              <div className="text-secondary" style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Total Captured
              </div>
              <div className="fw-700 text-primary" style={{ fontSize: 16, marginTop: 2 }}>
                {preview?.found ?? 0}
              </div>
            </div>

            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 10px',
              textAlign: 'center',
            }}>
              <div className="text-secondary" style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Blank Forms
              </div>
              <div className="fw-700 text-accent" style={{ fontSize: 16, marginTop: 2 }}>
                {nonSerialCount}
              </div>
            </div>

            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 10px',
              textAlign: 'center',
            }}>
              <div className="text-secondary" style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Problem Data
              </div>
              <div className="fw-700 text-error" style={{ fontSize: 16, marginTop: 2 }}>
                {preview?.blank ?? 0}
              </div>
            </div>
          </div>

          {/* Serial Status Overview Matrix Container */}
          <div style={{
            padding: '10px 12px',
            background: 'var(--surface)',
            borderRadius: 8,
            border: '1px solid var(--border)',
            fontSize: 10,
            marginBottom: 10,
            maxHeight: 120,
            overflowY: 'auto'
          }}>
            <div className="text-secondary fw-700 mb-8 flex items-center justify-between" style={{ fontSize: 9, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              <span>Serial Status Overview</span>
              <span className="text-muted font-normal" style={{ fontSize: 9 }}>
                {fromClean && toClean ? `${generateRange(fromClean, toClean, true).length} Selected` : 'None'}
              </span>
            </div>
            {fromClean && toClean ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
                gap: 6
              }}>
                {generateRange(fromClean, toClean, true).map((s) => (
                  <div
                    key={s}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--surface-2)',
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      fontFamily: 'monospace',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    <span>{s}</span>
                    <span style={{ color: 'var(--success, #10b981)', fontSize: 8 }}>●</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-muted" style={{ fontSize: 10 }}>No range selected</span>
            )}
          </div>

          {/* Pre-Generation Summary */}
          <div style={{
            padding: '10px 12px',
            background: 'var(--surface)',
            borderRadius: 8,
            border: '1px solid var(--border)',
            fontSize: 11,
            marginBottom: 4
          }}>
            <div className="fw-700 text-secondary mb-6" style={{ fontSize: 9, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Generation Summary
            </div>
            <div className="grid-2 gap-4">
              <div>Available Records: <strong className="text-primary">{getRecordCountForForm(selectedForm?.id || 'FORM_I')}</strong></div>
              <div>Selected Range: <strong className="text-accent">{fromClean ? `${fromClean}–${toClean}` : 'N/A'}</strong></div>
              <div>Serial Records: <strong>{fromClean ? (generateRange(fromClean, toClean, true).length) : 0}</strong></div>
              <div>Blank Forms: <strong className="text-warning">{nonSerialCount}</strong></div>
              <div>Problem Records: <strong className="text-error">0</strong></div>
              <div>Total Output: <strong className="text-success">{(fromClean ? generateRange(fromClean, toClean, true).length : 0) + nonSerialCount}</strong></div>
            </div>
          </div>
        </div>

        {/* FOUR PRIMARY ACTION BOXES */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <button
            className="btn btn-secondary flex items-center justify-center gap-6"
            onClick={handlePreviewOnly}
            disabled={!isRangeValid || isGenerating}
            style={{ padding: '10px 8px', fontSize: 12, fontWeight: 600 }}
            title="Live Preview PDF"
          >
            {previewLoading ? <Loader size={14} className="spin" /> : <Eye size={14} />}
            {previewLoading ? 'Loading...' : 'Live Preview PDF'}
          </button>

          <button
            className="btn btn-primary flex items-center justify-center gap-6"
            onClick={handleGenerate}
            disabled={!canGenerate}
            style={{ padding: '10px 8px', fontSize: 12, fontWeight: 700 }}
            title={`Generate ${selectedForm?.category || 'Form'} PDF`}
          >
            {isGenerating ? <Loader size={14} className="spin" /> : <Play size={14} />}
            {isGenerating ? 'Generating...' : `Generate ${selectedForm?.category || 'Form'} PDF`}
          </button>

          <button
            className="btn btn-secondary flex items-center justify-center gap-6"
            onClick={async () => {
              try {
                const modMap: Record<string, string> = {
                  'FORM_I': 'FORM_I',
                  'FORM_J': 'FORM_J',
                  'FORM_SHARE': 'FORM_SHARE',
                  'FORM_NOM': 'FORM_NOM',
                  'FORM_PROP': 'FORM_PROP',
                  'FORM_BANK': 'FORM_BANK',
                  'FORM_SHARE_CERT': 'FORM_SHARE_CERT',
                  'FORM_VOUCHER': 'FORM_VOUCHER',
                };
                const targetMod = (modMap[formId] || formId) as any;
                if (api?.masterData?.exportModule) {
                  await api.masterData.exportModule(targetMod);
                } else if (api?.masterData?.exportIndividualModule) {
                  await api.masterData.exportIndividualModule(targetMod);
                }
              } catch (err: any) {
                alert(`Excel export error: ${err.message}`);
              }
            }}
            style={{ padding: '10px 8px', fontSize: 12, fontWeight: 600 }}
            title="Download Excel / CSV file for active form"
          >
            <Download size={14} /> Download Excel / CSV
          </button>

          {/* Download Options Dropdown (PNG, JPG, CDR, Print) */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary flex items-center justify-center gap-6"
              onClick={() => setIsDownloadMenuOpen(prev => !prev)}
              style={{ width: '100%', padding: '10px 8px', fontSize: 12, fontWeight: 600 }}
              title="Download format options (PNG, JPG, CDR)"
            >
              <Download size={14} /> 💾 Download Options ▾
            </button>

            {isDownloadMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  right: 0,
                  marginBottom: 6,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  zIndex: 100,
                  minWidth: 220,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: 11 }}
                  onClick={async () => {
                    setIsDownloadMenuOpen(false);
                    if (previewPdfUrl) {
                      const link1 = document.createElement('a');
                      link1.href = previewPdfUrl;
                      link1.download = `SHARE_CERT_PAGE_1_FRONT.png`;
                      link1.click();
                      setTimeout(() => {
                        const link2 = document.createElement('a');
                        link2.href = previewPdfUrl;
                        link2.download = `SHARE_CERT_PAGE_2_BACK.png`;
                        link2.click();
                      }, 400);
                    } else {
                      await handlePreviewOnly();
                    }
                  }}
                >
                  🖼 Download PNG (Front & Back)
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: 11 }}
                  onClick={async () => {
                    setIsDownloadMenuOpen(false);
                    if (previewPdfUrl) {
                      const link1 = document.createElement('a');
                      link1.href = previewPdfUrl;
                      link1.download = `SHARE_CERT_PAGE_1_FRONT.jpg`;
                      link1.click();
                      setTimeout(() => {
                        const link2 = document.createElement('a');
                        link2.href = previewPdfUrl;
                        link2.download = `SHARE_CERT_PAGE_2_BACK.jpg`;
                        link2.click();
                      }, 400);
                    } else {
                      await handlePreviewOnly();
                    }
                  }}
                >
                  🖼 Download JPG (Front & Back)
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: 11 }}
                  onClick={async () => {
                    setIsDownloadMenuOpen(false);
                    if (previewPdfUrl) {
                      const link = document.createElement('a');
                      link.href = previewPdfUrl;
                      link.download = `SHARE_CERTIFICATE_13X19_VECTOR.cdr`;
                      link.click();
                    } else {
                      await handleGenerate();
                    }
                  }}
                >
                  📐 Download CDR / Vector
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: 11, borderTop: '1px solid var(--border)' }}
                  onClick={() => {
                    setIsDownloadMenuOpen(false);
                    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
                    if (iframe && iframe.contentWindow) {
                      iframe.contentWindow.print();
                    } else if (previewPdfUrl) {
                      const win = window.open(previewPdfUrl, '_blank');
                      if (win) {
                        win.focus();
                        win.print();
                      }
                    } else {
                      window.print();
                    }
                  }}
                >
                  🖨 Print Certificate
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status / Output Messages */}
        {phase === 'done' && result?.success && (
          <div className="alert alert-success" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8, marginTop: 10 }}>
            <div className="flex items-center gap-8 fw-700">
              <CheckCircle size={16} /> Generation Complete!
            </div>
            <div className="text-xs">Generated {result.totalGenerated || result.generatedCount || selectedCount} PDF records & ZIP package created.</div>
            {result.zipPath && (
              <div className="flex items-center gap-8 mt-4" style={{ width: '100%', flexWrap: 'wrap' }}>
                <span className="text-xs font-mono text-secondary" style={{ flex: 1, minWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  ZIP: {result.zipPath}
                </span>
                {(api?.file?.openPath || (api as any)?.system?.openPath) && (
                  <button
                    className="btn btn-secondary btn-xs flex items-center gap-4"
                    onClick={() => ((api?.file?.openPath || (api as any)?.system?.openPath)(result.zipPath))}
                    style={{ fontSize: 11, fontWeight: 600 }}
                  >
                    📂 Open ZIP File
                  </button>
                )}
                {(api?.file?.showItemInFolder || (api as any)?.system?.showItemInFolder) && (
                  <button
                    className="btn btn-primary btn-xs flex items-center gap-4"
                    onClick={() => ((api?.file?.showItemInFolder || (api as any)?.system?.showItemInFolder)(result.zipPath))}
                    style={{ fontSize: 11, fontWeight: 700 }}
                  >
                    📁 Show in Folder
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {phase === 'error' && result?.errorMessage && (
          <div className="alert alert-error text-xs" style={{ whiteSpace: 'pre-wrap' }}>
            <XCircle size={16} /> {result.errorMessage}
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL — PDF Live Viewer ──────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-app)', minWidth: 0 }}>
        {previewPdfUrl ? (
          <PdfViewer pdfUrl={previewPdfUrl} />
        ) : (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-secondary)', padding: 40, textAlign: 'center'
          }}>
            <Eye size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <h3 className="text-md fw-600 mb-6">PDF Live Preview</h3>
            <p className="text-xs text-secondary mb-16" style={{ maxWidth: 400 }}>
              Adjust serial range numbers, color mode, or grid settings on the left and click <strong>Live Preview PDF</strong> to inspect the exact output.
            </p>
          </div>
        )}
      </div>

      {/* Edit Data Modal */}
      <EditDataModal
        isOpen={isEditModalOpen}
        moduleId={editModuleId}
        onClose={() => setIsEditModalOpen(false)}
        onSaved={async () => {
          await loadDashboardContext();
          await fetchFormDetails();
          setPreviewPdfUrl(null);
        }}
      />
    </div>
  );
}
