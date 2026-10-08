import React, { useState, useEffect, useRef } from 'react';
import { Lock, Unlock, ShieldAlert, Loader2, HelpCircle } from 'lucide-react';

interface OcrSecurityLockProps {
  module: 'voucher-ocr' | 'check-ocr';
  moduleTitle: string;
  children: React.ReactNode;
}

export const OcrSecurityLock: React.FC<OcrSecurityLockProps> = ({
  module,
  moduleTitle,
  children,
}) => {
  const [isUnlocked, setIsUnlocked] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lockedSeconds, setLockedSeconds] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const api = (window as any).api;

  useEffect(() => {
    // Check initial unlock session status
    if (api?.security?.getOcrSessionStatus) {
      api.security.getOcrSessionStatus(module).then((res: any) => {
        setIsUnlocked(!!res?.unlocked);
      }).catch(() => {
        setIsUnlocked(false);
      });
    } else {
      setIsUnlocked(false);
    }
  }, [module]);

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

  const handleUnlock = async () => {
    if (!password || isVerifying || lockedSeconds > 0) return;
    setIsVerifying(true);
    setErrorMessage('');

    try {
      const res = await api?.security?.verifyOcrPassword(password, module);
      setPassword('');

      if (res?.success) {
        setIsUnlocked(true);
      } else {
        if (res?.locked && res?.lockSeconds) {
          setLockedSeconds(res.lockSeconds);
          setErrorMessage(res.error || `Module locked for ${res.lockSeconds}s.`);
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

  const handleLock = async () => {
    try {
      await api?.security?.lockOcrSession(module);
    } catch {}
    setIsUnlocked(false);
    setPassword('');
    setErrorMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleUnlock();
    }
  };

  if (isUnlocked === null) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '450px',
        color: 'var(--text-muted, #94a3b8)',
        fontSize: '14px',
        gap: '10px',
      }}>
        <Loader2 size={20} className="animate-spin" />
        <span>Initializing security layer...</span>
      </div>
    );
  }

  if (isUnlocked) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* Discreet Lock Header Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
          <button
            type="button"
            onClick={handleLock}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-secondary, #64748b)',
              backgroundColor: 'var(--surface, #ffffff)',
              border: '1px solid var(--border, #e2e8f0)',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease',
            }}
            title="Lock this OCR module session immediately"
          >
            <Lock size={13} color="#7C3AED" />
            <span>Lock Module</span>
          </button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 120px)',
      padding: '24px',
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: 'var(--surface, #ffffff)',
        borderRadius: '18px',
        border: '1px solid var(--border, #e2e8f0)',
        boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04)',
        overflow: 'hidden',
        textAlign: 'center',
      }}>
        {/* Top accent border */}
        <div style={{
          height: '4px',
          background: 'linear-gradient(90deg, #7C3AED 0%, #6366F1 50%, #EC4899 100%)',
        }} />

        <div style={{ padding: '32px 28px 28px' }}>
          {/* Lock Icon Badge */}
          <div style={{
            width: '56px',
            height: '56px',
            margin: '0 auto 18px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.12) 0%, rgba(99, 102, 241, 0.12) 100%)',
            border: '1px solid rgba(124, 58, 237, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#7C3AED',
            boxShadow: '0 4px 14px rgba(124, 58, 237, 0.15)',
          }}>
            <Lock size={26} strokeWidth={2.2} />
          </div>

          <h2 style={{
            fontSize: '19px',
            fontWeight: 800,
            color: 'var(--text-primary, #0f172a)',
            margin: '0 0 4px 0',
            letterSpacing: '-0.2px',
          }}>
            {moduleTitle}
          </h2>

          <div style={{
            display: 'inline-block',
            fontSize: '11px',
            fontWeight: 700,
            color: '#7C3AED',
            backgroundColor: 'rgba(124, 58, 237, 0.08)',
            padding: '3px 10px',
            borderRadius: '20px',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            margin: '6px 0 14px 0',
          }}>
            This module is protected
          </div>

          <p style={{
            fontSize: '13px',
            color: 'var(--text-muted, #64748b)',
            margin: '0 0 24px 0',
            lineHeight: 1.5,
          }}>
            Please enter your authorized HENU OCR password to unlock the workspace.
          </p>

          <div style={{ textAlign: 'left' }}>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--text-secondary, #475569)',
              marginBottom: '6px',
            }}>
              Enter HENU OCR Password
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
                placeholder="••••••••••••"
                autoComplete="off"
                autoFocus
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
                  transition: 'border-color 0.15s ease',
                }}
              />
            </div>

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

            <button
              type="button"
              onClick={handleUnlock}
              disabled={!password.trim() || isVerifying || lockedSeconds > 0}
              style={{
                width: '100%',
                height: '42px',
                borderRadius: '10px',
                border: 'none',
                background: !password.trim() || isVerifying || lockedSeconds > 0
                  ? 'var(--border, #cbd5e1)'
                  : 'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: !password.trim() || isVerifying || lockedSeconds > 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: !password.trim() || isVerifying || lockedSeconds > 0 ? 'none' : '0 4px 14px rgba(124, 58, 237, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              {isVerifying ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Unlocking...</span>
                </>
              ) : (
                <>
                  <Unlock size={16} />
                  <span>Unlock Module</span>
                </>
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: '16px' }}>
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
                  padding: '4px',
                }}
              >
                <HelpCircle size={13} />
                <span>Forgotten password?</span>
              </button>

              {showHelp && (
                <div style={{
                  marginTop: '10px',
                  padding: '10px 12px',
                  backgroundColor: 'var(--surface-2, #f8fafc)',
                  border: '1px solid var(--border, #e2e8f0)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--text-secondary, #475569)',
                  textAlign: 'left',
                }}>
                  Please contact <strong style={{ color: 'var(--text-primary, #0f172a)' }}>HENU OS Support</strong> for OCR credential assistance.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
