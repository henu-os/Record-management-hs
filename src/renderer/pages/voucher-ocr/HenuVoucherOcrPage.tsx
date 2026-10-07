/**
 * HENU VOUCHER OCR — MAIN PAGE MODULE
 * Enterprise Accounting & Multilingual OCR Workspace
 * Supports dual-mode execution: [ HENU AI ] (USB Local Engine) and [ APIs ] (Configured External AI API).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Inbox, Activity, Table, Bot,
  ShieldCheck, ArrowLeft, RefreshCw, Eye, Sparkles, AlertCircle, Cpu, Power,
  Globe, Disc, Zap, CheckCircle2, Settings
} from 'lucide-react';
import { VoucherDashboard } from './components/VoucherDashboard';
import { VoucherInbox } from './components/VoucherInbox';
import { VoucherProcessingView } from './components/VoucherProcessingView';
import { VoucherDataTable } from './components/VoucherDataTable';
import { VoucherReviewScreen } from './components/VoucherReviewScreen';
import { VoucherDetailModal } from './components/VoucherDetailModal';
import { VoucherAssistantDrawer } from './components/VoucherAssistantDrawer';
import { OcrApiConfigModal } from './components/OcrApiConfigModal';
import { ClientOcrApiBridge } from './services/ClientOcrApiBridge';
import { VoucherProcessingRecord } from '../../../modules/henu-voucher-ocr/schema/types';
import './voucher-ocr.css';

interface HenuVoucherOcrPageProps {
  onNavigate?: (pageId: string) => void;
}

type MainTab = 'dashboard' | 'inbox' | 'processing' | 'table';

export const HenuVoucherOcrPage: React.FC<HenuVoucherOcrPageProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<MainTab>('dashboard');
  const [records, setRecords] = useState<VoucherProcessingRecord[]>([]);
  const [activeReviewRecord, setActiveReviewRecord] = useState<VoucherProcessingRecord | null>(null);
  const [activeDetailRecord, setActiveDetailRecord] = useState<VoucherProcessingRecord | null>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string>('Ready');
  const [isApiConfigModalOpen, setIsApiConfigModalOpen] = useState<boolean>(false);

  // Dual OCR Execution Mode State: 'HENU_AI' | 'APIS'
  const [ocrMode, setOcrMode] = useState<'HENU_AI' | 'APIS'>('HENU_AI');
  const [apiActiveProvider, setApiActiveProvider] = useState<string>('gemini');
  const [apiActiveModel, setApiActiveModel] = useState<string>('gemini-2.5-flash-lite');

  // Authoritative USB Engine state
  const [engineStatus, setEngineStatus] = useState<{
    state: string;
    isEngineOn: boolean;
    isUsbConnected: boolean;
    usbDriveLetter: string;
    statusMessage: string;
  }>({
    state: 'USB_NOT_DETECTED',
    isEngineOn: false,
    isUsbConnected: false,
    usbDriveLetter: '',
    statusMessage: 'Checking HENU AI Engine status...',
  });

  const api = (typeof window !== 'undefined' ? (window as any).api : null);

  const refreshOcrApiConfig = useCallback(async () => {
    try {
      const config = await ClientOcrApiBridge.getConfig();
      if (config) {
        setOcrMode(config.mode || 'HENU_AI');
        if (config.activeProvider) {
          setApiActiveProvider(config.activeProvider);
          const prov = config.providers?.[config.activeProvider];
          if (prov?.model) {
            const cleanModel = (prov.model.includes('1.5') || prov.model === 'gemini-pro-latest') ? 'gemini-2.5-flash-lite' : prov.model;
            setApiActiveModel(cleanModel);
          }
        }
      }
    } catch {}
  }, []);

  const refreshEngineStatus = useCallback(async () => {
    if (api?.henuAi?.getStatus) {
      try {
        const res = await api.henuAi.getStatus();
        if (res) {
          setEngineStatus({
            state: res.state || 'USB_NOT_DETECTED',
            isEngineOn: res.isEngineOn ?? false,
            isUsbConnected: res.isUsbConnected ?? false,
            usbDriveLetter: res.usbDriveLetter || '',
            statusMessage: res.statusMessage || 'Checking HENU AI Engine status...',
          });
          return;
        }
      } catch {}
    }

    // Direct USB daemon check for browser / web mode
    try {
      const res = await fetch('http://127.0.0.1:8080/health', { signal: AbortSignal.timeout(2000) }).catch(() => null);
      if (res && res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json.status === 'ENGINE_READY' || json.status === 'READY') {
          const driveLetter = json.usb_root ? json.usb_root.substring(0, 2) : 'D:';
          setEngineStatus({
            state: 'ENGINE_READY',
            isEngineOn: true,
            isUsbConnected: true,
            usbDriveLetter: driveLetter,
            statusMessage: 'HENU AI Engine is fully operational and ready.',
          });
          return;
        }
      }
    } catch {}

    setEngineStatus({
      state: 'USB_NOT_DETECTED',
      isEngineOn: false,
      isUsbConnected: false,
      usbDriveLetter: '',
      statusMessage: 'HENU AI USB NOT CONNECTED. Connect the HENU AI USB to continue.',
    });
  }, [api]);

  useEffect(() => {
    refreshEngineStatus();
    refreshOcrApiConfig();
    const interval = setInterval(() => {
      refreshEngineStatus();
      refreshOcrApiConfig();
    }, 3000);
    return () => clearInterval(interval);
  }, [refreshEngineStatus, refreshOcrApiConfig]);

  // Handle Mode Toggle between [ HENU AI ] and [ APIs ]
  const handleModeChange = async (newMode: 'HENU_AI' | 'APIS') => {
    setOcrMode(newMode);
    try {
      const updated = await ClientOcrApiBridge.setMode(newMode);
      if (updated?.mode) setOcrMode(updated.mode);
    } catch (err) {
      console.error('Failed to change OCR mode:', err);
    }
  };

  const handleRecordsUpdated = (updated: VoucherProcessingRecord[]) => {
    setRecords(updated);
  };

  const handleSaveReview = (updatedRecord: VoucherProcessingRecord) => {
    setRecords(prev => prev.map(r => (r.id === updatedRecord.id ? updatedRecord : r)));
    setActiveReviewRecord(null);
  };

  const handleDeleteRecord = (id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all extracted voucher records in this batch?')) {
      setRecords([]);
      setActiveReviewRecord(null);
      setActiveDetailRecord(null);
    }
  };

  const handleApproveFromModal = (rec: VoucherProcessingRecord) => {
    const updated: VoucherProcessingRecord = {
      ...rec,
      reviewRequired: false,
      lifecycleStatus: 'approved',
      approvalInfo: {
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: 'User (Detail Modal)',
      },
    };
    setRecords(prev => prev.map(r => (r.id === rec.id ? updated : r)));
    setActiveDetailRecord(null);
  };

  const handleRejectFromModal = (rec: VoucherProcessingRecord, reason: string) => {
    const updated: VoucherProcessingRecord = {
      ...rec,
      lifecycleStatus: 'rejected',
      approvalInfo: {
        status: 'rejected',
        rejectionReason: reason || 'Returned for correction',
      },
    };
    setRecords(prev => prev.map(r => (r.id === rec.id ? updated : r)));
    setActiveDetailRecord(null);
  };

  return (
    <div className="voucher-ocr-container">
      {/* Top Header & Navigation Bar */}
      <div className="voucher-ocr-header">
        <div className="voucher-ocr-title-area">
          <div style={{
            width: 36,
            height: 36,
            minWidth: 36,
            minHeight: 36,
            maxWidth: 36,
            maxHeight: 36,
            borderRadius: 8,
            background: 'var(--accent, #7c3aed)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            flexShrink: 0,
            alignSelf: 'center',
          }}>
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                HENU Voucher OCR
              </h2>
              {/* Status indicator badge */}
              {ocrMode === 'HENU_AI' ? (
                engineStatus.isUsbConnected && engineStatus.state === 'ENGINE_READY' ? (
                  <span className="voucher-ocr-badge" style={{ borderColor: '#10B981', color: '#10B981', fontWeight: 700 }}>
                    <Disc size={12} /> 🟢 READY (USB: {engineStatus.usbDriveLetter || 'Connected'})
                  </span>
                ) : engineStatus.state === 'SERVICE_STARTING' || engineStatus.state === 'MODEL_LOADING' ? (
                  <span className="voucher-ocr-badge" style={{ borderColor: '#F59E0B', color: '#F59E0B', fontWeight: 700 }}>
                    <Disc size={12} /> 🟡 {engineStatus.state === 'SERVICE_STARTING' ? 'STARTING AI...' : 'LOADING MODEL...'} (USB: {engineStatus.usbDriveLetter || 'Connected'})
                  </span>
                ) : engineStatus.state === 'ENGINE_OFF' ? (
                  <span className="voucher-ocr-badge" style={{ borderColor: '#6B7280', color: '#6B7280', fontWeight: 700 }}>
                    <Power size={12} /> ⚪ ENGINE OFF
                  </span>
                ) : (
                  <span className="voucher-ocr-badge" style={{ borderColor: '#EF4444', color: '#EF4444', fontWeight: 700 }}>
                    <AlertCircle size={12} /> 🔴 NOT CONNECTED
                  </span>
                )
              ) : (
                <span className="voucher-ocr-badge" style={{ borderColor: '#3B82F6', color: '#3B82F6', fontWeight: 700 }}>
                  <Globe size={12} /> 🟢 HENU VISION — ONLINE ({apiActiveModel})
                </span>
              )}
            </div>

            {/* Subtitle */}
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              {ocrMode === 'HENU_AI'
                ? 'HENU AI processes vouchers directly via the physically connected USB AI Brain.'
                : `Online AI Vision Mode: Extracting 26 canonical fields directly via HENU Vision Online API (${apiActiveModel}).`}
            </p>
          </div>
        </div>

        {/* Mode Selector + Primary Tabs + Assistant Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Provider Switcher Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--surface-2)',
            padding: 3,
            borderRadius: 8,
            border: '1px solid var(--border)',
            gap: 4,
          }}>
            <button
              type="button"
              onClick={() => handleModeChange('HENU_AI')}
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: ocrMode === 'HENU_AI' ? 'var(--accent, #7c3aed)' : 'transparent',
                color: ocrMode === 'HENU_AI' ? '#fff' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
              }}
            >
              <Disc size={12} /> HENU AI (USB Offline)
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('APIS')}
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: ocrMode === 'APIS' ? '#10B981' : 'transparent',
                color: ocrMode === 'APIS' ? '#fff' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
              }}
            >
              <Globe size={12} /> HENU Vision (Online API)
            </button>
            <button
              type="button"
              onClick={() => setIsApiConfigModalOpen(true)}
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                border: '1px solid var(--border)',
                cursor: 'pointer',
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
                boxShadow: 'var(--shadow-sm)',
              }}
              title="Configure API Keys & Models"
            >
              <Settings size={13} style={{ color: 'var(--accent, #7c3aed)' }} /> API Settings
            </button>
          </div>

          {!activeReviewRecord && (
            <div className="voucher-ocr-nav-tabs">
              <button
                className={`voucher-ocr-tab${activeTab === 'dashboard' ? ' active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
              >
                <LayoutDashboard size={14} /> Dashboard
              </button>
              <button
                className={`voucher-ocr-tab${activeTab === 'inbox' ? ' active' : ''}`}
                onClick={() => setActiveTab('inbox')}
              >
                <Inbox size={14} /> Voucher Inbox ({records.length})
              </button>
              <button
                className={`voucher-ocr-tab${activeTab === 'processing' ? ' active' : ''}`}
                onClick={() => setActiveTab('processing')}
              >
                <Activity size={14} /> Live Processing
              </button>
              <button
                className={`voucher-ocr-tab${activeTab === 'table' ? ' active' : ''}`}
                onClick={() => setActiveTab('table')}
              >
                <Table size={14} /> Data Table
              </button>
            </div>
          )}

          {/* Assistant Toggle Button */}
          <button
            className={`btn btn-sm ${isAssistantOpen ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setIsAssistantOpen(!isAssistantOpen)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
          >
            <Bot size={14} /> Voucher Assistant
          </button>
        </div>
      </div>

      {/* HENU AI USB Warning Banner if Disconnected in HENU_AI Mode */}
      {ocrMode === 'HENU_AI' && !engineStatus.isUsbConnected && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #EF4444',
          borderRadius: 8,
          padding: '12px 18px',
          color: '#EF4444',
          fontSize: 13,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 16,
        }}>
          <AlertCircle size={20} />
          <span>HENU AI USB NOT CONNECTED. CONNECT THE HENU AI USB TO CONTINUE. (Or switch to HENU Vision (Online API) above)</span>
        </div>
      )}

      {/* HENU Vision API Banner in APIS Mode */}
      {ocrMode === 'APIS' && (
        <div style={{
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: 8,
          padding: '10px 18px',
          color: '#60A5FA',
          fontSize: 12,
          fontWeight: 600,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={16} />
            <span><strong>ONLINE API MODE ACTIVE:</strong> Using HENU Vision ({apiActiveModel}) for multimodal voucher image transcription.</span>
          </div>
          <button
            type="button"
            onClick={() => setIsApiConfigModalOpen(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#93C5FD',
              fontSize: 11,
              fontWeight: 700,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            Change Model / API Key →
          </button>
        </div>
      )}

      {/* Main Content Workspace + Assistant Drawer */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, gap: 16 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto' }}>
          {activeReviewRecord ? (
            <VoucherReviewScreen
              record={activeReviewRecord}
              onSave={handleSaveReview}
              onBack={() => setActiveReviewRecord(null)}
            />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <VoucherDashboard
                  records={records}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  onReviewRecord={(rec) => setActiveReviewRecord(rec)}
                  onViewDetail={(rec) => setActiveDetailRecord(rec)}
                />
              )}

              {activeTab === 'inbox' && (
                <VoucherInbox
                  records={records}
                  engineStatus={engineStatus}
                  ocrMode={ocrMode}
                  onRecordsUpdated={handleRecordsUpdated}
                  onReviewRecord={(rec) => setActiveReviewRecord(rec)}
                  onViewDetail={(rec) => setActiveDetailRecord(rec)}
                  onProcessingStarted={() => {
                    setIsProcessing(true);
                    setProcessingStatus('Ingesting & running OCR...');
                  }}
                />
              )}

              {activeTab === 'processing' && (
                <VoucherProcessingView
                  records={records}
                  isProcessing={isProcessing}
                  currentStatus={processingStatus}
                  onReviewRecord={(rec) => setActiveReviewRecord(rec)}
                />
              )}

              {activeTab === 'table' && (
                <VoucherDataTable
                  records={records}
                  onReviewRecord={(rec) => setActiveReviewRecord(rec)}
                  onDeleteRecord={handleDeleteRecord}
                  onClearAll={handleClearAll}
                />
              )}
            </>
          )}
        </div>

        {/* Assistant Drawer */}
        {isAssistantOpen && (
          <VoucherAssistantDrawer
            activeRecord={activeReviewRecord || activeDetailRecord || records[0] || null}
            onClose={() => setIsAssistantOpen(false)}
          />
        )}
      </div>

      {/* 8-Tab Detail Modal */}
      {activeDetailRecord && (
        <VoucherDetailModal
          record={activeDetailRecord}
          onClose={() => setActiveDetailRecord(null)}
          onApprove={handleApproveFromModal}
          onReject={handleRejectFromModal}
        />
      )}

      {/* OCR API Models & Provider Configuration Modal */}
      <OcrApiConfigModal
        isOpen={isApiConfigModalOpen}
        onClose={() => setIsApiConfigModalOpen(false)}
        onConfigSaved={refreshOcrApiConfig}
        onNavigateToSettings={() => onNavigate?.('settings')}
      />
    </div>
  );
};

export default HenuVoucherOcrPage;
