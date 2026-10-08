/**
 * HENU CHECK OCR — MAIN PAGE MODULE
 * Enterprise Bank Cheque OCR & Verification Workspace
 * Supports dual-mode execution: [ HENU AI ] (USB Local Engine) and [ APIs ] (Configured External AI API).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Inbox, Activity, Table, Bot,
  ShieldCheck, ArrowLeft, RefreshCw, Eye, Sparkles, AlertCircle, Cpu, Power,
  Globe, Disc, Zap, CheckCircle2, Settings, CreditCard
} from 'lucide-react';
import { CheckDashboard } from './components/CheckDashboard';
import { CheckInbox } from './components/CheckInbox';
import { CheckProcessingView } from './components/CheckProcessingView';
import { CheckDataTable } from './components/CheckDataTable';
import { CheckReviewScreen } from './components/CheckReviewScreen';
import { CheckDetailModal } from './components/CheckDetailModal';
import { CheckAssistantDrawer } from './components/CheckAssistantDrawer';
import { OcrApiConfigModal } from '../voucher-ocr/components/OcrApiConfigModal';
import { ClientOcrApiBridge } from '../voucher-ocr/services/ClientOcrApiBridge';
import { CheckProcessingRecord } from '../../../modules/henu-check-ocr/schema/types';
import { OcrSecurityLock } from '../../components/OcrSecurityLock';
import './check-ocr.css';

interface HenuCheckOcrPageProps {
  onNavigate?: (pageId: string) => void;
}

type MainTab = 'dashboard' | 'inbox' | 'processing' | 'table';

export const HenuCheckOcrPage: React.FC<HenuCheckOcrPageProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<MainTab>('dashboard');
  const [records, setRecords] = useState<CheckProcessingRecord[]>([]);
  const [activeReviewRecord, setActiveReviewRecord] = useState<CheckProcessingRecord | null>(null);
  const [activeDetailRecord, setActiveDetailRecord] = useState<CheckProcessingRecord | null>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string>('Ready');
  const [isApiConfigModalOpen, setIsApiConfigModalOpen] = useState<boolean>(false);

  // Dual OCR Execution Mode State: 'HENU_AI' | 'APIS'
  const [ocrMode, setOcrMode] = useState<'HENU_AI' | 'APIS'>('HENU_AI');
  const [apiActiveProvider, setApiActiveProvider] = useState<string>('gemini');
  const [apiActiveModel, setApiActiveModel] = useState<string>('gemini-2.5-flash-lite');

  // USB Engine state
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

  const handleModeChange = async (newMode: 'HENU_AI' | 'APIS') => {
    setOcrMode(newMode);
    try {
      const updated = await ClientOcrApiBridge.setMode(newMode);
      if (updated?.mode) setOcrMode(updated.mode);
    } catch (err) {
      console.error('Failed to change OCR mode:', err);
    }
  };

  const handleRecordsUpdated = (updated: CheckProcessingRecord[]) => {
    setRecords(updated);
  };

  const handleSaveReview = (updatedRecord: CheckProcessingRecord) => {
    setRecords(prev => prev.map(r => (r.id === updatedRecord.id ? updatedRecord : r)));
    setActiveReviewRecord(null);
  };

  const handleDeleteRecord = (id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all extracted cheque records in this batch?')) {
      setRecords([]);
      setActiveReviewRecord(null);
      setActiveDetailRecord(null);
    }
  };

  const handleApproveFromModal = (rec: CheckProcessingRecord) => {
    const updated: CheckProcessingRecord = {
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

  const handleRejectFromModal = (rec: CheckProcessingRecord, reason: string) => {
    const updated: CheckProcessingRecord = {
      ...rec,
      lifecycleStatus: 'rejected',
      approvalInfo: {
        status: 'rejected',
        rejectionReason: reason || 'Flagged in detail modal',
      },
    };
    setRecords(prev => prev.map(r => (r.id === rec.id ? updated : r)));
    setActiveDetailRecord(null);
  };

  return (
    <OcrSecurityLock module="check-ocr" moduleTitle="CHECK OCR">
      <div className="check-ocr-container">
      {/* Top Header & Navigation Bar */}
      <div className="check-ocr-header">
        <div className="check-ocr-title-area">
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
            <CreditCard size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                CHECK OCR
              </h2>
              {/* Status indicator badge */}
              {ocrMode === 'HENU_AI' ? (
                engineStatus.isUsbConnected && engineStatus.state === 'ENGINE_READY' ? (
                  <span className="check-ocr-badge" style={{ borderColor: '#10B981', color: '#10B981', fontWeight: 700 }}>
                    <Disc size={12} /> 🟢 READY (USB: {engineStatus.usbDriveLetter || 'Connected'})
                  </span>
                ) : engineStatus.state === 'SERVICE_STARTING' || engineStatus.state === 'MODEL_LOADING' ? (
                  <span className="check-ocr-badge" style={{ borderColor: '#F59E0B', color: '#F59E0B', fontWeight: 700 }}>
                    <Disc size={12} /> 🟡 {engineStatus.state === 'SERVICE_STARTING' ? 'STARTING AI...' : 'LOADING MODEL...'} (USB: {engineStatus.usbDriveLetter || 'Connected'})
                  </span>
                ) : engineStatus.state === 'ENGINE_OFF' ? (
                  <span className="check-ocr-badge" style={{ borderColor: '#6B7280', color: '#6B7280', fontWeight: 700 }}>
                    <Power size={12} /> ⚪ ENGINE OFF
                  </span>
                ) : (
                  <span className="check-ocr-badge" style={{ borderColor: '#EF4444', color: '#EF4444', fontWeight: 700 }}>
                    <AlertCircle size={12} /> 🔴 NOT CONNECTED
                  </span>
                )
              ) : (
                <span className="check-ocr-badge" style={{ borderColor: '#3B82F6', color: '#3B82F6', fontWeight: 700 }}>
                  <Globe size={12} /> 🟢 HENU VISION — ONLINE ({apiActiveModel})
                </span>
              )}
            </div>

            {/* Subtitle */}
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              {ocrMode === 'HENU_AI'
                ? 'HENU AI processes checks directly via the physically connected USB AI Brain.'
                : `Online AI Vision Mode: Extracting 10 canonical fields directly via HENU Vision Online API (${apiActiveModel}).`}
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

            {/* API Settings Modal Trigger */}
            <button
              type="button"
              onClick={() => setIsApiConfigModalOpen(true)}
              title="Configure OCR APIs & Keys"
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
            >
              <Settings size={13} style={{ color: 'var(--accent, #7c3aed)' }} /> API Settings
            </button>
          </div>

          {/* Primary View Navigation Tabs */}
          {!activeReviewRecord && (
            <div className="check-ocr-nav-tabs">
              <button
                className={`check-ocr-tab${activeTab === 'dashboard' ? ' active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
              >
                <LayoutDashboard size={14} /> Dashboard
              </button>
              <button
                className={`check-ocr-tab${activeTab === 'inbox' ? ' active' : ''}`}
                onClick={() => setActiveTab('inbox')}
              >
                <Inbox size={14} /> Check Inbox ({records.length})
              </button>
              <button
                className={`check-ocr-tab${activeTab === 'processing' ? ' active' : ''}`}
                onClick={() => setActiveTab('processing')}
              >
                <Activity size={14} /> Live Processing
              </button>
              <button
                className={`check-ocr-tab${activeTab === 'table' ? ' active' : ''}`}
                onClick={() => setActiveTab('table')}
              >
                <Table size={14} /> Data Table
              </button>
            </div>
          )}

          {/* Check Assistant Drawer Trigger */}
          <button
            className={`btn btn-sm ${isAssistantOpen ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setIsAssistantOpen(!isAssistantOpen)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
          >
            <Bot size={14} /> Check Assistant
          </button>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {activeReviewRecord ? (
          <CheckReviewScreen
            record={activeReviewRecord}
            onSave={handleSaveReview}
            onBack={() => setActiveReviewRecord(null)}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <CheckDashboard
                records={records}
                ocrMode={ocrMode}
                apiActiveModel={apiActiveModel}
                engineStatus={engineStatus}
                onChequeProcessed={rec => {
                  setRecords(prev => [rec, ...prev]);
                  setActiveTab('inbox');
                }}
                onBatchCompleted={batch => {
                  setRecords(prev => [...batch, ...prev]);
                  setActiveTab('inbox');
                }}
                onReviewRecord={rec => setActiveReviewRecord(rec)}
                onViewAll={() => setActiveTab('table')}
              />
            )}

            {activeTab === 'inbox' && (
              <CheckInbox
                records={records}
                engineStatus={engineStatus}
                ocrMode={ocrMode}
                onRecordsUpdated={handleRecordsUpdated}
                onReviewRecord={rec => setActiveReviewRecord(rec)}
                onViewDetail={rec => setActiveDetailRecord(rec)}
                onProcessingStarted={() => {
                  setIsProcessing(true);
                  setProcessingStatus('Ingesting and processing cheque batch...');
                }}
              />
            )}

            {activeTab === 'processing' && (
              <CheckProcessingView
                records={records}
                isProcessing={isProcessing}
                processingStatus={processingStatus}
              />
            )}

            {activeTab === 'table' && (
              <CheckDataTable
                records={records}
                onReviewRecord={rec => setActiveReviewRecord(rec)}
                onDeleteRecord={handleDeleteRecord}
                onClearAll={handleClearAll}
              />
            )}
          </>
        )}
      </div>

      {/* Quick Detail Modal */}
      {activeDetailRecord && (
        <CheckDetailModal
          record={activeDetailRecord}
          onClose={() => setActiveDetailRecord(null)}
          onApprove={handleApproveFromModal}
          onReject={handleRejectFromModal}
        />
      )}

      {/* Check Assistant Drawer */}
      <CheckAssistantDrawer
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        records={records}
        onSelectRecord={rec => {
          setActiveReviewRecord(rec);
        }}
      />

      {/* Shared OCR API Settings Modal */}
      <OcrApiConfigModal
        isOpen={isApiConfigModalOpen}
        onClose={() => {
          setIsApiConfigModalOpen(false);
          refreshOcrApiConfig();
        }}
        onConfigSaved={() => {
          refreshOcrApiConfig();
        }}
      />
    </div>
    </OcrSecurityLock>
  );
};

export default HenuCheckOcrPage;
