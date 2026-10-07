import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Database, FileText,
  History, Settings, ChevronRight, ChevronDown, FileCheck, Building2, Plus, ScanLine, FileImage, CreditCard
} from 'lucide-react';

import Dashboard from './pages/Dashboard';
import MasterData from './pages/MasterData';
import GenerateForms from './pages/GenerateForms';
import GeneratedFiles from './pages/GeneratedFiles';
import SettingsPage from './pages/SettingsPage';
import HenuVoucherOcrPage from './pages/voucher-ocr/HenuVoucherOcrPage';
import { HenuCheckOcrPage } from './pages/check-ocr/HenuCheckOcrPage';
import HenuIdfPage from './pages/henu-idf/HenuIdfPage';
import AddSocietyModal from './components/AddSocietyModal';
import { Society } from '../main/types';

export type PageId =
  | 'dashboard'
  | 'masterdata'
  | 'controlcenter'
  | 'generate'
  | 'generate-FORM_I'
  | 'generate-FORM_J'
  | 'generate-FORM_SHARE'
  | 'generate-FORM_PROP'
  | 'generate-FORM_NOM'
  | 'generate-FORM_BANK'
  | 'generate-FORM_SHARE_CERT'
  | 'generate-FORM_VOUCHER'
  | 'voucher-ocr'
  | 'check-ocr'
  | 'henu-idf'
  | 'history'
  | 'settings';

export interface FormSubItem {
  formId: string;
  label: string;
  navId: PageId;
}

const REGISTER_SUBITEMS: FormSubItem[] = [
  { formId: 'FORM_I', label: 'Form I', navId: 'generate-FORM_I' },
  { formId: 'FORM_J', label: 'Form J', navId: 'generate-FORM_J' },
  { formId: 'FORM_SHARE', label: 'Share Register', navId: 'generate-FORM_SHARE' },
  { formId: 'FORM_PROP', label: 'Property Register', navId: 'generate-FORM_PROP' },
  { formId: 'FORM_NOM', label: 'Nomination Register', navId: 'generate-FORM_NOM' },
  { formId: 'FORM_BANK', label: 'Bank Lien Mark', navId: 'generate-FORM_BANK' },
];

export default function App() {
  const [page, setPage] = useState<PageId>('dashboard');
  const [generateExpanded, setGenerateExpanded] = useState<boolean>(false);
  const [ocrExpanded, setOcrExpanded] = useState<boolean>(false);
  const [convertersExpanded, setConvertersExpanded] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Startup Video Animation Overlay (10 seconds)
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [isFadingSplash, setIsFadingSplash] = useState<boolean>(false);
  const [splashSecondsLeft, setSplashSecondsLeft] = useState<number>(10);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  const handleFinishSplash = useCallback(() => {
    setIsFadingSplash(true);
    setTimeout(() => {
      setShowSplash(false);
    }, 600);
  }, []);

  useEffect(() => {
    if (!showSplash) return;

    // Autoplay trigger
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {
        if (videoRef.current) {
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {});
        }
      });
    }

    // 10-second countdown
    const interval = setInterval(() => {
      setSplashSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleFinishSplash();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // 10-second completion timer
    const timer = setTimeout(() => {
      handleFinishSplash();
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [showSplash, handleFinishSplash]);

  // Multi-Society active context
  const [societies, setSocieties] = useState<Society[]>([]);
  const [activeSociety, setActiveSociety] = useState<Society | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const api = (window as any).api;

  const loadSocietyContext = useCallback(async () => {
    if (!api || !api.society) return;
    try {
      const [socList, activeSoc] = await Promise.all([
        api.society.list(),
        api.society.getActive(),
      ]);
      const validSocList = (socList || []).filter((s: any) => s && s.societyName && !/^\d{4}-\d{2}-\d{2}T/.test(s.societyName));
      setSocieties(validSocList.length > 0 ? validSocList : (socList || []));
      if (activeSoc && !/^\d{4}-\d{2}-\d{2}T/.test(activeSoc.societyName)) {
        setActiveSociety(activeSoc);
      } else if (validSocList.length > 0) {
        setActiveSociety(validSocList[0]);
      } else {
        setActiveSociety(activeSoc || null);
      }
    } catch (err) {
      console.error('Failed to load society context:', err);
    }
  }, []);

  useEffect(() => {
    loadSocietyContext();
  }, [loadSocietyContext]);

  useEffect(() => {
    if (!api) return;
    api.settings.get('theme', 'light').then((t: any) => {
      const resolved = t === 'dark' ? 'dark' : 'light';
      setTheme(resolved as 'light' | 'dark');
      document.documentElement.setAttribute('data-theme', resolved);
    });
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    api?.settings.set('theme', next);
  };

  const handleNavigate = (p: string) => {
    setPage(p as PageId);
    if (p.startsWith('generate-FORM_') && p !== 'generate-FORM_SHARE_CERT' && p !== 'generate-FORM_VOUCHER') {
      setGenerateExpanded(true);
    } else if (p === 'voucher-ocr' || p === 'check-ocr') {
      setOcrExpanded(true);
    } else if (p === 'henu-idf') {
      setConvertersExpanded(true);
    }
  };

  const handleSelectSociety = async (socId: string) => {
    if (!socId || !api || !api.society) return;
    try {
      const selected = await (api.society.select ? api.society.select(socId) : api.society.setActive(socId));
      if (selected) {
        setActiveSociety(selected);
        window.dispatchEvent(new CustomEvent('society-changed', { detail: selected }));
      }
      await loadSocietyContext();
    } catch (err) {
      console.error('Failed to switch active society:', err);
    }
  };

  const isGenerateActive = page.startsWith('generate');
  const activeGenerateFormId = page.startsWith('generate-')
    ? page.replace('generate-', '')
    : 'FORM_I';

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-name">HENU <span>OS</span></div>
            <div className="sidebar-brand-sub">Records Management</div>
          </div>
          <img
            src="./henu_business.png"
            alt="HENU OS Logo"
            className="sidebar-brand-logo"
          />
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Navigation</div>

          {/* Dashboard */}
          <button
            id="nav-dashboard"
            className={`sidebar-item${page === 'dashboard' ? ' active' : ''}`}
            onClick={() => handleNavigate('dashboard')}
          >
            <LayoutDashboard size={15} />
            Dashboard
            {page === 'dashboard' && <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />}
          </button>

          {/* Master Data */}
          <button
            id="nav-masterdata"
            className={`sidebar-item${page === 'masterdata' ? ' active' : ''}`}
            onClick={() => handleNavigate('masterdata')}
          >
            <Database size={15} />
            Master Data
            {page === 'masterdata' && <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />}
          </button>

          {/* Control Center (Standalone Module) */}
          <button
            id="nav-controlcenter"
            className={`sidebar-item${page === 'controlcenter' ? ' active' : ''}`}
            onClick={() => handleNavigate('controlcenter')}
          >
            <FileText size={15} />
            Control Center
            {page === 'controlcenter' && <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />}
          </button>

          {/* Generate Forms Parent Item */}
          <button
            id="nav-generate"
            className={`sidebar-item${isGenerateActive && page !== 'controlcenter' ? ' active' : ''}`}
            onClick={() => {
              setGenerateExpanded(!generateExpanded);
            }}
          >
            <FileText size={15} />
            Generate Forms
            {generateExpanded ? (
              <ChevronDown size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />
            ) : (
              <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />
            )}
          </button>

          {/* Sub-items for 6 Legal Forms */}
          {generateExpanded && (
            <div style={{ paddingLeft: 18, borderLeft: '2px solid var(--border)', marginLeft: 16, marginTop: 4, marginBottom: 8 }}>
              {REGISTER_SUBITEMS.map(sub => {
                const isSubActive = page === sub.navId;
                return (
                  <button
                    key={sub.navId}
                    id={`nav-${sub.navId}`}
                    className={`sidebar-item${isSubActive ? ' active' : ''}`}
                    onClick={() => handleNavigate(sub.navId)}
                    style={{ fontSize: 12, padding: '6px 10px', marginBottom: 2 }}
                  >
                    <FileCheck size={13} style={{ opacity: isSubActive ? 1 : 0.7 }} />
                    {sub.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Share Certificate (Standalone main item right after Generate Forms sub-items) */}
          <button
            id="nav-sharecert"
            className={`sidebar-item${page === 'generate-FORM_SHARE_CERT' ? ' active' : ''}`}
            onClick={() => handleNavigate('generate-FORM_SHARE_CERT')}
          >
            <FileCheck size={15} />
            Share Certificate
            {page === 'generate-FORM_SHARE_CERT' && <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />}
          </button>

          {/* Voucher (New Register Module - 3 per Legal Sheet) */}
          <button
            id="nav-voucher"
            className={`sidebar-item${page === 'generate-FORM_VOUCHER' ? ' active' : ''}`}
            onClick={() => handleNavigate('generate-FORM_VOUCHER')}
          >
            <FileCheck size={15} />
            Voucher
            {page === 'generate-FORM_VOUCHER' && <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />}
          </button>

          {/* HENU OCR (Expandable Dropdown) */}
          <button
            id="nav-henu-ocr-parent"
            className={`sidebar-item${(page === 'voucher-ocr' || page === 'check-ocr') ? ' active' : ''}`}
            onClick={() => setOcrExpanded(!ocrExpanded)}
          >
            <ScanLine size={15} />
            HENU OCR
            {ocrExpanded ? (
              <ChevronDown size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />
            ) : (
              <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />
            )}
          </button>

          {/* Sub-items for HENU OCR */}
          {ocrExpanded && (
            <div style={{ paddingLeft: 18, borderLeft: '2px solid var(--border)', marginLeft: 16, marginTop: 4, marginBottom: 8 }}>
              <button
                id="nav-voucher-ocr"
                className={`sidebar-item${page === 'voucher-ocr' ? ' active' : ''}`}
                onClick={() => handleNavigate('voucher-ocr')}
                style={{ fontSize: 12, padding: '6px 10px', marginBottom: 2 }}
              >
                <ScanLine size={13} style={{ opacity: page === 'voucher-ocr' ? 1 : 0.7 }} />
                VOUCHER
              </button>
              <button
                id="nav-check-ocr"
                className={`sidebar-item${page === 'check-ocr' ? ' active' : ''}`}
                onClick={() => handleNavigate('check-ocr')}
                style={{ fontSize: 12, padding: '6px 10px', marginBottom: 2 }}
              >
                <CreditCard size={13} style={{ opacity: page === 'check-ocr' ? 1 : 0.7 }} />
                CHECK
              </button>
            </div>
          )}

          {/* HENU CONVERTERS (Expandable Dropdown) */}
          <button
            id="nav-henu-converters-parent"
            className={`sidebar-item${page === 'henu-idf' ? ' active' : ''}`}
            onClick={() => setConvertersExpanded(!convertersExpanded)}
          >
            <FileImage size={15} />
            HENU CONVERTERS
            {convertersExpanded ? (
              <ChevronDown size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />
            ) : (
              <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />
            )}
          </button>

          {/* Sub-items for HENU CONVERTERS */}
          {convertersExpanded && (
            <div style={{ paddingLeft: 18, borderLeft: '2px solid var(--border)', marginLeft: 16, marginTop: 4, marginBottom: 8 }}>
              <button
                id="nav-henu-idf"
                className={`sidebar-item${page === 'henu-idf' ? ' active' : ''}`}
                onClick={() => handleNavigate('henu-idf')}
                style={{ fontSize: 12, padding: '6px 10px', marginBottom: 2 }}
              >
                <FileImage size={13} style={{ opacity: page === 'henu-idf' ? 1 : 0.7 }} />
                HENU IDF
              </button>
            </div>
          )}

          {/* Generated Files */}
          <button
            id="nav-history"
            className={`sidebar-item${page === 'history' ? ' active' : ''}`}
            onClick={() => handleNavigate('history')}
          >
            <History size={15} />
            Generated Files
            {page === 'history' && <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />}
          </button>

          {/* Settings */}
          <button
            id="nav-settings"
            className={`sidebar-item${page === 'settings' ? ' active' : ''}`}
            onClick={() => handleNavigate('settings')}
          >
            <Settings size={15} />
            Settings
            {page === 'settings' && <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />}
          </button>
        </nav>

        <div className="sidebar-footer">
          <button
            className="sidebar-item"
            onClick={toggleTheme}
            style={{ padding: '6px 0' }}
          >
            <span style={{ fontSize: 14 }}>{theme === 'dark' ? '☀️' : '🌙'}</span>
            <span style={{ fontSize: 12 }}>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <div className="sidebar-version" style={{ marginTop: 8 }}>HENU OS v1.0 · HLabs</div>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Persistent Top Active Society Header Bar */}
        <header
          style={{
            background: 'var(--surface-2, #1e293b)',
            borderBottom: '1px solid var(--border)',
            padding: '8px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            zIndex: 20,
            minHeight: 48,
          }}
        >
          <div className="flex items-center gap-8" style={{ flex: 1, minWidth: 0 }}>
            <Building2 size={16} className="text-accent flex-shrink-0" />
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.6px',
                textTransform: 'uppercase',
                color: 'var(--accent-light, #a78bfa)',
                background: 'rgba(124, 58, 237, 0.15)',
                padding: '2px 8px',
                borderRadius: 4,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              Active Society
            </span>
            <span
              className="fw-700 text-primary text-sm truncate"
              style={{ maxWidth: 360 }}
              title={activeSociety?.societyName}
            >
              {activeSociety?.societyName || 'Loading Society...'}
            </span>
            {activeSociety?.registrationNo && (
              <span
                className="text-secondary text-xs truncate"
                style={{ opacity: 0.85 }}
                title={activeSociety.registrationNo}
              >
                ({activeSociety.registrationNo})
              </span>
            )}
          </div>

          <div className="flex items-center gap-10 flex-shrink-0">
            {/* Quick Switcher Dropdown */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <select
                value={activeSociety?.id || ''}
                onChange={e => handleSelectSociety(e.target.value)}
                className="input-control text-xs fw-600"
                style={{
                  paddingLeft: 10,
                  paddingRight: 26,
                  height: 30,
                  backgroundColor: 'var(--bg-card, #0f172a)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  maxWidth: 240,
                }}
              >
                {societies.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.societyName} ({s.registrationNo || 'No Reg'})
                  </option>
                ))}
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: 8, pointerEvents: 'none', opacity: 0.6 }} />
            </div>

            {/* Add Society Action */}
            <button
              className="btn btn-primary btn-sm flex items-center gap-4"
              onClick={() => setIsAddModalOpen(true)}
              style={{ fontSize: 11, padding: '4px 10px', height: 30 }}
            >
              <Plus size={13} /> Add Society
            </button>
          </div>
        </header>

        {/* Dynamic Page Router Container (key={activeSociety?.id} forces clean re-mount on society switch) */}
        <main className="main-content" key={activeSociety?.id || 'empty'}>
          {page === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
          {page === 'controlcenter' && <GenerateForms selectedFormId="CONTROL_CENTER" onNavigate={handleNavigate} />}
          {page === 'masterdata' && <MasterData />}
          {page === 'voucher-ocr' && <HenuVoucherOcrPage onNavigate={handleNavigate} />}
          {page === 'check-ocr' && <HenuCheckOcrPage onNavigate={handleNavigate} />}
          {page === 'henu-idf' && <HenuIdfPage onNavigate={handleNavigate} />}
          {isGenerateActive && <GenerateForms selectedFormId={activeGenerateFormId} onNavigate={handleNavigate} />}
          {page === 'history' && <GeneratedFiles />}
          {page === 'settings' && <SettingsPage onNavigate={handleNavigate} />}
        </main>
      </div>

      {/* Add Society Modal */}
      <AddSocietyModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSocietyAdded={() => {
          loadSocietyContext();
          setIsAddModalOpen(false);
        }}
      />

      {/* ── Startup Video Animation Overlay (10 seconds) ── */}
      {showSplash && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            backgroundColor: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isFadingSplash ? 0 : 1,
            pointerEvents: isFadingSplash ? 'none' : 'auto',
            transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden',
          }}
        >
          {/* Top Progress Bar */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '3px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              zIndex: 1000001,
            }}
          >
            <div
              style={{
                height: '100%',
                backgroundColor: 'var(--primary, #3b82f6)',
                width: `${((10 - splashSecondsLeft) / 10) * 100}%`,
                transition: 'width 1s linear',
                boxShadow: '0 0 8px rgba(59, 130, 246, 0.8)',
              }}
            />
          </div>

          <video
            ref={videoRef}
            src="./starting for dark theme.mp4"
            autoPlay
            playsInline
            preload="auto"
            onEnded={handleFinishSplash}
            onError={handleFinishSplash}
            style={{
              width: '100vw',
              height: '100vh',
              objectFit: 'contain',
              backgroundColor: '#000000',
            }}
          >
            <source src="./starting for dark theme.mp4" type="video/mp4" />
            <source src="./starting animation.mp4" type="video/mp4" />
            <source src="/starting for dark theme.mp4" type="video/mp4" />
            <source src="/starting animation.mp4" type="video/mp4" />
          </video>

          {/* Skip / Countdown Button */}
          <button
            onClick={handleFinishSplash}
            style={{
              position: 'absolute',
              bottom: 28,
              right: 28,
              background: 'rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.28)',
              color: '#ffffff',
              padding: '8px 18px',
              borderRadius: 24,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.6px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
              transition: 'all 0.2s ease',
              zIndex: 1000000,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.25)';
              (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.12)';
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
          >
            Skip Intro ({splashSecondsLeft}s) ➔
          </button>
        </div>
      )}
    </div>
  );
}
