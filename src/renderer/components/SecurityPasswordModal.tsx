import React, { useState, useEffect, useRef } from 'react';
import { Shield, Lock, ShieldAlert, KeyRound, Loader2, HelpCircle } from 'lucide-react';

interface SecurityPasswordModalProps {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  moduleType?: 'admin' | 'ocr';
  ocrModuleName?: 'voucher-ocr' | 'check-ocr';
  onSuccess: () => void;
  onCancel: () => void;
}

export const SecurityPasswordModal: React.FC<SecurityPasswordModalProps> = ({
  isOpen,
  title = 'HENU OS SECURITY',
  subtitle = 'Enter Administrative Password to proceed with this protected operation.',
  moduleType = 'admin',
  ocrModuleName = 'voucher-ocr',
  onSuccess,
  onCancel,
}) => {
  const [password, setPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lockedSeconds, setLockedSeconds] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const api = (window as any).api;

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setErrorMessage('');
      setShowHelp(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    let timer: any;
    if (lockedSeconds > 0) {
      timer = setInterval(() => {
        setLockedSeconds(prev => {
          if (prev <= 1) {
            setErrorMessage('');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockedSeconds]);

  if (!isOpen) return null;

  const handleVerify = async () => {
    if (!password || isVerifying || lockedSeconds > 0) return;
    setIsVerifying(true);
    setErrorMessage('');

    try {
      let res: any;
      if (moduleType === 'admin') {
        res = await api?.security?.verifyAdminPassword(password);
      } else {
        res = await api?.security?.verifyOcrPassword(password, ocrModuleName);
      }

      // Clear password field immediately from state for memory safety
      setPassword('');

      if (res?.success) {
        onSuccess();
      } else {
        if (res?.locked && res?.lockSeconds) {
          setLockedSeconds(res.lockSeconds);
          setErrorMessage(res.error || `Authentication locked for ${res.lockSeconds}s.`);
        } else {
          setErrorMessage(res?.error || 'Invalid password.');
        }
      }
    } catch (err: any) {
      setPassword('');
      setErrorMessage(err?.message || 'Authentication error.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleVerify();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setPassword('');
      onCancel();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isVerifying) {
          setPassword('');
          onCancel();
        }
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: 'var(--surface, #ffffff)',
          borderRadius: '18px',
          border: '1px solid var(--border, #e2e8f0)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Accent Bar */}
        <div style={{
          height: '4px',
          background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 50%, #7C3AED 100%)',
        }} />

        <div style={{ padding: '24px 24px 20px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.15) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#d97706',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)',
                flexShrink: 0,
              }}
            >
              <Shield size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
                {title}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', margin: '2px 0 0 0' }}>
                Authorization Verification Required
              </p>
            </div>
          </div>

          {/* Subtitle / Context Notice */}
          <div style={{
            backgroundColor: 'var(--surface-2, #f8fafc)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: '10px',
            padding: '12px 14px',
            fontSize: '12px',
            color: 'var(--text-secondary, #475569)',
            marginBottom: '18px',
            lineHeight: 1.4,
          }}>
            {subtitle}
          </div>

          {/* Input Area */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--text-secondary, #475569)',
              marginBottom: '6px',
            }}>
              {moduleType === 'admin' ? 'Administrative Password' : 'HENU OCR Password'}
            </label>

            <div style={{ position: 'relative', marginBottom: '14px' }}>
              <div style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: '12px',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
                color: 'var(--text-muted, #94a3b8)',
              }}>
                <Lock size={15} />
              </div>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isVerifying || lockedSeconds > 0}
                placeholder="••••••••••••••••"
                autoComplete="off"
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 14px 0 38px',
                  fontSize: '14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border, #cbd5e1)',
                  backgroundColor: 'var(--input-bg, #ffffff)',
                  color: 'var(--text-primary, #0f172a)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '8px',
                color: '#dc2626',
                fontSize: '12px',
                marginBottom: '14px',
              }}>
                <ShieldAlert size={15} style={{ flexShrink: 0 }} />
                <span>
                  {lockedSeconds > 0
                    ? `Locked due to multiple failed attempts. Retry in ${lockedSeconds}s.`
                    : errorMessage}
                </span>
              </div>
            )}

            {/* Forgotten Password Notice */}
            <div style={{ marginBottom: '14px' }}>
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted, #94a3b8)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                }}
              >
                <HelpCircle size={13} />
                <span>Forgotten password?</span>
              </button>

              {showHelp && (
                <div style={{
                  marginTop: '8px',
                  padding: '10px 12px',
                  backgroundColor: 'var(--surface-2, #f8fafc)',
                  border: '1px solid var(--border, #e2e8f0)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--text-secondary, #475569)',
                }}>
                  Please contact <strong style={{ color: 'var(--text-primary, #0f172a)' }}>HENU OS Support</strong> for administrative credential recovery.
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '18px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border, #e2e8f0)',
          }}>
            <button
              type="button"
              onClick={() => {
                setPassword('');
                onCancel();
              }}
              disabled={isVerifying}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-secondary, #475569)',
                backgroundColor: 'transparent',
                border: '1px solid var(--border, #cbd5e1)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleVerify}
              disabled={!password.trim() || isVerifying || lockedSeconds > 0}
              style={{
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 700,
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                background: !password.trim() || isVerifying || lockedSeconds > 0
                  ? 'var(--border, #cbd5e1)'
                  : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                cursor: !password.trim() || isVerifying || lockedSeconds > 0 ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: !password.trim() || isVerifying || lockedSeconds > 0 ? 'none' : '0 4px 12px rgba(245, 158, 11, 0.3)',
              }}
            >
              {isVerifying ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <KeyRound size={15} />
                  <span>Verify Password</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
