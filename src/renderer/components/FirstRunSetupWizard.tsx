import React, { useState, useEffect } from 'react';
import { FolderCheck, HardDrive, CheckCircle2, AlertTriangle, ShieldCheck, FolderOpen, ArrowRight } from 'lucide-react';
import { StorageValidationResult } from '../../main/types';

interface FirstRunSetupWizardProps {
  isOpen: boolean;
  onComplete: () => void;
}

export default function FirstRunSetupWizard({ isOpen, onComplete }: FirstRunSetupWizardProps) {
  const [storagePath, setStoragePath] = useState<string>('');
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [validation, setValidation] = useState<StorageValidationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const api = (window as any).api;

  useEffect(() => {
    if (!isOpen || !api) return;
    // Suggest default path based on system downloads / app data
    api.system?.getPaths?.().then((p: any) => {
      if (p?.downloads) {
        setStoragePath(`${p.downloads}\\HENU OS RECMA`);
      } else {
        setStoragePath('D:\\HENU OS RECMA');
      }
    }).catch(() => {
      setStoragePath('D:\\HENU OS RECMA');
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBrowse = async () => {
    if (!api || !api.system?.openFileDialog) return;
    try {
      const selected = await api.system.openFileDialog({
        title: 'Select HENU OS RECMA Root Storage Directory',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (selected) {
        setStoragePath(selected);
        setValidation(null);
      }
    } catch (err) {
      console.error('Browse error:', err);
    }
  };

  const handleValidate = async () => {
    if (!storagePath.trim() || !api?.henuConfig?.validateStorageLocation) return;
    setIsValidating(true);
    setErrorMessage('');
    try {
      const res: StorageValidationResult = await api.henuConfig.validateStorageLocation(storagePath.trim());
      setValidation(res);
      if (!res.isValid) {
        setErrorMessage(res.errors.join('. ') || 'Selected location is invalid or unwritable.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handleContinue = async () => {
    if (!validation?.isValid || !api?.henuConfig?.completeFirstRun) return;
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const res = await api.henuConfig.completeFirstRun(storagePath.trim());
      if (res.isValid) {
        onComplete();
      } else {
        setErrorMessage(res.errors.join('. '));
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Setup completion failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999990,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 640,
          background: 'var(--surface-1, #0f172a)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 28px',
            borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.12) 0%, rgba(30, 41, 59, 0.4) 100%)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'linear-gradient(135deg, var(--accent, #7c3aed), #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 8px 16px rgba(124, 58, 237, 0.3)',
            }}
          >
            <HardDrive size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
              HENU OS RECORD MANAGEMENT
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              Configure your system storage before you start.
            </p>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 8,
                color: 'var(--text-primary)',
              }}
            >
              Where should HENU OS store society data?
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={storagePath}
                onChange={e => {
                  setStoragePath(e.target.value);
                  setValidation(null);
                }}
                placeholder="e.g. D:\HENU OS RECMA or C:\Data\HENU OS RECMA"
                className="input-control"
                style={{
                  flex: 1,
                  fontFamily: 'monospace',
                  fontSize: 13,
                  padding: '10px 14px',
                  borderRadius: 8,
                }}
              />
              <button
                type="button"
                onClick={handleBrowse}
                className="btn btn-secondary flex items-center gap-6"
                style={{ height: 42, padding: '0 16px', borderRadius: 8, whiteSpace: 'nowrap' }}
              >
                <FolderOpen size={16} /> Browse
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Root storage will store Societies, Backups, Exports, Imports, and Document Indexes. Never hard-coded.
            </div>
          </div>

          {/* Validation Checklist Box */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 12,
              border: `1px solid ${validation?.isValid ? 'rgba(34, 197, 94, 0.3)' : 'var(--border)'}`,
              background: validation?.isValid ? 'rgba(34, 197, 94, 0.05)' : 'var(--surface-2, #1e293b)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: 'var(--text-secondary)' }}>
              STORAGE READINESS AUDIT:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={16} color={validation?.exists ? '#22c55e' : '#64748b'} />
                <span style={{ color: validation?.exists ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  Location available
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={16} color={validation?.isWritable ? '#22c55e' : '#64748b'} />
                <span style={{ color: validation?.isWritable ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  Write permission available
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={16} color={validation?.dbReady ? '#22c55e' : '#64748b'} />
                <span style={{ color: validation?.dbReady ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  Database ready
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={16} color={validation?.fileStorageReady ? '#22c55e' : '#64748b'} />
                <span style={{ color: validation?.fileStorageReady ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  File storage ready
                </span>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertTriangle size={16} className="flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-2, #1e293b)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={handleValidate}
            disabled={isValidating || !storagePath.trim()}
            className="btn btn-secondary flex items-center gap-6"
            style={{ height: 38, padding: '0 18px', borderRadius: 8, fontWeight: 700 }}
          >
            <ShieldCheck size={16} />
            {isValidating ? 'Validating...' : 'Validate Location'}
          </button>

          <button
            type="button"
            onClick={handleContinue}
            disabled={!validation?.isValid || isSubmitting}
            className="btn btn-primary flex items-center gap-6"
            style={{
              height: 38,
              padding: '0 22px',
              borderRadius: 8,
              fontWeight: 800,
              opacity: validation?.isValid ? 1 : 0.45,
              cursor: validation?.isValid ? 'pointer' : 'not-allowed',
            }}
          >
            {isSubmitting ? 'Configuring...' : 'Continue'}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
