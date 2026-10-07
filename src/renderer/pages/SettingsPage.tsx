import React, { useEffect, useState } from 'react';
import {
  Settings, Save, Palette, Type, AlignLeft, AlignCenter, AlignRight,
  FileText, Check, RotateCcw, Sliders, Eye, Grid
} from 'lucide-react';
import { FormDesignSettings, DEFAULT_FORM_DESIGN_SETTINGS } from '../../main/types';
import { VoucherOcrSettingsSection } from './voucher-ocr/components/VoucherOcrSettingsSection';

interface Props {
  onNavigate: (page: string) => void;
}

const TABS: { id: string; label: string }[] = [
  { id: 'global', label: 'Global Defaults' },
  { id: 'FORM_I', label: 'Form I — Register of Members' },
  { id: 'FORM_J', label: 'Form J — List of Members' },
  { id: 'FORM_SHARE', label: 'Share Register' },
  { id: 'FORM_NOM', label: 'Nomination Register' },
  { id: 'FORM_PROP', label: 'Property Register' },
  { id: 'FORM_BANK', label: 'Bank Lien Mark' },
  { id: 'voucher_ocr', label: 'HENU Voucher OCR' },
];

export default function SettingsPage({ onNavigate }: Props) {
  const [activeTab, setActiveTab] = useState<string>('global');
  const [settings, setSettings] = useState<FormDesignSettings>(DEFAULT_FORM_DESIGN_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);
  const [saved, setSaved] = useState<boolean>(false);
  const [activeSociety, setActiveSociety] = useState<any | null>(null);

  const api = (window as any).api;

  useEffect(() => {
    api.society?.getActive().then((soc: any) => {
      if (soc) setActiveSociety(soc);
    }).catch(() => {});
  }, []);

  const loadTabSettings = async (tabId: string) => {
    if (tabId === 'voucher_ocr') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.settings.getFormSettings(tabId);
      if (data) {
        setSettings({ ...DEFAULT_FORM_DESIGN_SETTINGS, ...data });
      } else {
        setSettings({ ...DEFAULT_FORM_DESIGN_SETTINGS });
      }
    } catch {
      setSettings({ ...DEFAULT_FORM_DESIGN_SETTINGS });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTabSettings(activeTab);
  }, [activeTab]);

  const handleSave = async () => {
    if (activeTab === 'voucher_ocr') {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      return;
    }
    // Enforce limits before saving
    const clamped: FormDesignSettings = {
      ...settings,
      fontSize: Math.min(12, Math.max(7, Number(settings.fontSize) || 7.5)),
      headerFontSize: Math.min(14, Math.max(8, Number(settings.headerFontSize) || 11)),
      gridOpacity: Math.min(100, Math.max(0, Number(settings.gridOpacity) ?? 100)),
    };
    setSettings(clamped);
    await api.settings.saveFormSettings(activeTab, clamped);

    // Propagate Branding BOX Footer to all 6 forms
    const allForms = ['FORM_I', 'FORM_J', 'FORM_SHARE', 'FORM_NOM', 'FORM_PROP', 'FORM_BANK'];
    for (const fId of allForms) {
      try {
        const existing = await api.settings.getFormSettings(fId);
        const updated = {
          ...existing,
          brandingText: clamped.brandingText,
          brandingAlign: clamped.brandingAlign,
          pageNumberAlign: clamped.pageNumberAlign,
          customFooterText: clamped.customFooterText,
          customFooterAlign: clamped.customFooterAlign,
        };
        await api.settings.saveFormSettings(fId, updated);
      } catch (e) {}
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleResetForm = async () => {
    if (activeTab === 'global') {
      const def = await api.settings.resetGlobalSettings();
      setSettings(def);
    } else {
      const def = await api.settings.resetFormSettings(activeTab);
      setSettings(def);
    }
  };

  const handleResetGlobal = async () => {
    const def = await api.settings.resetGlobalSettings();
    if (activeTab === 'global') setSettings(def);
    else await loadTabSettings(activeTab);
  };

  const updateSetting = <K extends keyof FormDesignSettings>(field: K, val: FormDesignSettings[K]) => {
    setSettings(prev => ({ ...prev, [field]: val }));
  };

  return (
    <div className="page-wrapper" style={{ padding: '28px 36px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header flex items-center justify-between mb-24">
        <div>
          <div className="flex items-center gap-10">
            <Settings className="icon-accent" size={26} />
            <h1 className="page-title" style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
              Form Design Configuration Engine
            </h1>
          </div>
          <p className="page-subtitle text-xs text-secondary mt-4">
            Independent per-form typography, cell alignment, background colors, and accounting grid opacity (Prompt 01).
          </p>
        </div>

        <div className="flex items-center gap-10">
          <button className="btn btn-ghost btn-sm" onClick={() => {
            const previewEl = document.getElementById('live-style-preview');
            if (previewEl) previewEl.scrollIntoView({ behavior: 'smooth' });
          }}>
            <Eye size={14} /> Preview Style
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleResetForm} title="Reset active form defaults to global">
            <RotateCcw size={14} /> Reset Form Defaults
          </button>
          <button className="btn btn-secondary btn-sm text-error" onClick={handleResetGlobal} title="Reset global defaults to system initial defaults">
            Reset Global Defaults
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>
            {saved ? <Check size={14} /> : <Save size={14} />}
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-8 mb-24 flex-wrap" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab(tab.id)}
            style={{ fontSize: 12, padding: '7px 16px', borderRadius: 'var(--radius-sm)' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: 48 }}>
          <div className="spinner" />
        </div>
      ) : activeTab === 'voucher_ocr' ? (
        <VoucherOcrSettingsSection />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 24 }}>
          {/* Left Column: Form Controls */}
          <div className="flex flex-col gap-20">
            {/* 1. Typography & Font Options */}
            <div className="card" style={{ padding: 22 }}>
              <h3 className="text-sm fw-700 text-primary flex items-center gap-8 mb-16">
                <Type size={16} className="icon-accent" /> Text & Typography Settings
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="mb-16">
                <div className="form-group">
                  <label className="form-label">Font Family (PDF Standard)</label>
                  <select
                    className="form-select text-xs"
                    value={settings.fontFamily}
                    onChange={e => updateSetting('fontFamily', e.target.value as any)}
                  >
                    <option value="Helvetica">Helvetica (Sans-Serif Standard)</option>
                    <option value="Times-Roman">Times-Roman (Classic Serif Standard)</option>
                    <option value="Courier">Courier (Monospace Standard)</option>
                    <option value="Helvetica-Bold">Helvetica-Bold (Sans-Serif Accent)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Body Font Size (Min 7pt, Max 12pt)</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      min={7}
                      max={12}
                      step={0.5}
                      className="form-input text-xs"
                      value={settings.fontSize}
                      onChange={e => updateSetting('fontSize', Math.min(12, Math.max(7, parseFloat(e.target.value) || 7.5)))}
                    />
                    <span style={{ position: 'absolute', right: 10, top: 8, fontSize: 11, color: 'var(--text-muted)' }}>pt</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }} className="mb-16">
                <div className="form-group">
                  <label className="form-label">Header Size (8–14pt)</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      min={8}
                      max={14}
                      className="form-input text-xs"
                      value={settings.headerFontSize}
                      onChange={e => updateSetting('headerFontSize', Math.min(14, Math.max(8, parseFloat(e.target.value) || 11)))}
                    />
                    <span style={{ position: 'absolute', right: 10, top: 8, fontSize: 11, color: 'var(--text-muted)' }}>pt</span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Text Rotation</label>
                  <select
                    className="form-select text-xs"
                    value={settings.textRotation}
                    onChange={e => updateSetting('textRotation', Number(e.target.value) as any)}
                  >
                    <option value={0}>0° (Horizontal)</option>
                    <option value={90}>90° (Vertical Up)</option>
                    <option value={180}>180° (Upside Down)</option>
                    <option value={270}>270° (Vertical Down)</option>
                  </select>
                </div>

                <div className="form-group flex flex-col justify-end">
                  <div className="flex items-center gap-16 mb-6">
                    <label className="flex items-center gap-6 cursor-pointer text-xs fw-600">
                      <input
                        type="checkbox"
                        checked={settings.bold}
                        onChange={e => updateSetting('bold', e.target.checked)}
                      /> Bold
                    </label>
                    <label className="flex items-center gap-6 cursor-pointer text-xs fw-600">
                      <input
                        type="checkbox"
                        checked={settings.italic}
                        onChange={e => updateSetting('italic', e.target.checked)}
                      /> Italic
                    </label>
                  </div>
                  <label className="flex items-center gap-6 cursor-pointer text-xs fw-600">
                    <input
                      type="checkbox"
                      checked={settings.textWrapping}
                      onChange={e => updateSetting('textWrapping', e.target.checked)}
                    /> Text Wrapping
                  </label>
                </div>
              </div>
            </div>

            {/* 2. Cell Alignment Controls */}
            <div className="card" style={{ padding: 22 }}>
              <h3 className="text-sm fw-700 text-primary flex items-center gap-8 mb-16">
                <Sliders size={16} className="icon-accent" /> Cell Alignment Controls
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <label className="form-label">Horizontal Alignment</label>
                  <div className="flex items-center gap-4" style={{ background: 'var(--surface-2)', padding: 4, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    {(['left', 'center', 'right'] as const).map(align => (
                      <button
                        key={align}
                        type="button"
                        className={`btn btn-xs flex-1 justify-center ${settings.horizontalAlign === align ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => updateSetting('horizontalAlign', align)}
                        style={{ fontSize: 11, padding: '6px 8px' }}
                      >
                        {align === 'left' && <AlignLeft size={13} />}
                        {align === 'center' && <AlignCenter size={13} />}
                        {align === 'right' && <AlignRight size={13} />}
                        {align}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="form-label">Vertical Alignment</label>
                  <div className="flex items-center gap-4" style={{ background: 'var(--surface-2)', padding: 4, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    {(['top', 'middle', 'bottom'] as const).map(align => (
                      <button
                        key={align}
                        type="button"
                        className={`btn btn-xs flex-1 justify-center ${settings.verticalAlign === align ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => updateSetting('verticalAlign', align)}
                        style={{ fontSize: 11, padding: '6px 8px' }}
                      >
                        {align}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Colors, Grid & Opacity Settings */}
            <div className="card" style={{ padding: 22 }}>
              <h3 className="text-sm fw-700 text-primary flex items-center gap-8 mb-16">
                <Palette size={16} className="icon-accent" /> Color Mode, Grid & Line Thickness Engine
              </h3>

              {/* Color Mode Option ([ Color ] [ B&W ]) */}
              <div className="form-group mb-16">
                <label className="form-label" style={{ fontSize: 11 }}>Color Mode</label>
                <div className="flex items-center gap-8" style={{ background: 'var(--surface-2)', padding: 6, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    className={`btn btn-xs flex-1 justify-center ${settings.colorMode === 'Color' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => updateSetting('colorMode', 'Color')}
                    style={{ fontSize: 11, padding: '6px 12px' }}
                  >
                    🎨 Color
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs flex-1 justify-center ${settings.colorMode === 'BW' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => updateSetting('colorMode', 'BW')}
                    style={{ fontSize: 11, padding: '6px 12px' }}
                  >
                    🏁 B&W (Monochrome Print-Safe)
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }} className="mb-16">
                {/* Text Color */}
                <div className="form-group">
                  <label className="form-label">Text Color</label>
                  <div className="flex items-center gap-8" style={{ background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <input
                      type="color"
                      style={{ width: 26, height: 26, border: 'none', background: 'none', cursor: 'pointer' }}
                      value={settings.textColor}
                      onChange={e => updateSetting('textColor', e.target.value)}
                      disabled={settings.colorMode === 'BW'}
                    />
                    <span className="text-xs fw-600 text-primary uppercase">{settings.textColor}</span>
                  </div>
                </div>

                {/* Header Background */}
                <div className="form-group">
                  <label className="form-label">Header Fill</label>
                  <div className="flex items-center gap-8" style={{ background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <input
                      type="color"
                      style={{ width: 26, height: 26, border: 'none', background: 'none', cursor: 'pointer' }}
                      value={settings.headerBgColor}
                      onChange={e => updateSetting('headerBgColor', e.target.value)}
                      disabled={settings.colorMode === 'BW'}
                    />
                    <span className="text-xs fw-600 text-primary uppercase">{settings.headerBgColor}</span>
                  </div>
                </div>

                {/* Cell Background */}
                <div className="form-group">
                  <label className="form-label">Cell Fill</label>
                  <div className="flex items-center gap-8" style={{ background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <input
                      type="color"
                      style={{ width: 26, height: 26, border: 'none', background: 'none', cursor: 'pointer' }}
                      value={settings.cellBgColor}
                      onChange={e => updateSetting('cellBgColor', e.target.value)}
                      disabled={settings.colorMode === 'BW'}
                    />
                    <span className="text-xs fw-600 text-primary uppercase">{settings.cellBgColor}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="mb-16">
                {/* Border/Grid Color */}
                <div className="form-group">
                  <label className="form-label">Border / Grid Color</label>
                  <div className="flex items-center gap-8" style={{ background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <input
                      type="color"
                      style={{ width: 26, height: 26, border: 'none', background: 'none', cursor: 'pointer' }}
                      value={settings.borderColor}
                      onChange={e => updateSetting('borderColor', e.target.value)}
                      disabled={settings.colorMode === 'BW'}
                    />
                    <span className="text-xs fw-600 text-primary uppercase">{settings.borderColor}</span>
                  </div>
                </div>

                {/* Grid ON/OFF */}
                <div className="form-group flex flex-col justify-end">
                  <label className="flex items-center gap-8 cursor-pointer text-xs fw-700">
                    <input
                      type="checkbox"
                      checked={settings.gridOn}
                      onChange={e => updateSetting('gridOn', e.target.checked)}
                    /> Grid ON / OFF
                  </label>
                </div>
              </div>

              {/* Grid Line Thickness (0.25pt, 0.50pt, 0.75pt, 1.00pt) */}
              <div className="form-group mb-16">
                <label className="form-label" style={{ fontSize: 11 }}>Grid Size / Line Thickness</label>
                <div className="flex items-center gap-6" style={{ background: 'var(--surface-2)', padding: 4, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  {[
                    { val: 0.25, label: '0.25 pt (Very Fine)' },
                    { val: 0.5,  label: '0.50 pt (Normal)' },
                    { val: 0.75, label: '0.75 pt (Medium)' },
                    { val: 1.0,  label: '1.00 pt (Strong)' }
                  ].map(item => (
                    <button
                      key={item.val}
                      type="button"
                      className={`btn btn-xs flex-1 justify-center ${settings.gridThickness === item.val ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => updateSetting('gridThickness', item.val)}
                      style={{ fontSize: 10, padding: '4px 6px' }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid Opacity Slider (0 to 100%) */}
              <div className="form-group">
                <div className="flex items-center justify-between mb-6">
                  <label className="form-label" style={{ margin: 0 }}>Grid Opacity (Accounting Register Style)</label>
                  <span className="text-xs fw-700 text-accent">{settings.gridOpacity}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                  value={settings.gridOpacity}
                  onChange={e => updateSetting('gridOpacity', Number(e.target.value))}
                />
              </div>

              {activeTab === 'FORM_J' && (
                <div className="form-group mt-16 pt-16" style={{ borderTop: '1px solid var(--border)' }}>
                  <label className="form-label fw-700 text-primary mb-6" style={{ fontSize: 11 }}>
                    Rows per Page (Form J List of Members)
                  </label>
                  <div className="flex items-center gap-10">
                    <input
                      type="number"
                      min={4}
                      max={25}
                      className="input-control text-xs"
                      style={{ width: 100 }}
                      value={settings.rowsPerPage || 10}
                      onChange={e => updateSetting('rowsPerPage', Math.min(25, Math.max(4, parseInt(e.target.value, 10) || 10)))}
                    />
                    <span className="text-xs text-secondary">
                      Controls how many member rows display per page on Form J (Min: 4, Max: 25, Default: 10).
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 3.1 Header Logo Position (X, Y Axis & Size) */}
            <div className="card" style={{ padding: 22 }}>
              <h3 className="text-sm fw-700 text-primary flex items-center gap-8 mb-16">
                <Sliders size={16} className="icon-accent" /> 🖼️ Society Header Logo Position (X, Y Axis & Size)
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                {/* Logo Size */}
                <div className="form-group">
                  <div className="flex items-center justify-between mb-6">
                    <label className="form-label" style={{ fontSize: 11 }}>Logo Size (Square)</label>
                    <span className="badge badge-secondary font-mono" style={{ fontSize: 10 }}>
                      {settings.logoSize || 44} pt
                    </span>
                  </div>
                  <input
                    type="range"
                    min={24}
                    max={54}
                    step={2}
                    value={settings.logoSize || 44}
                    onChange={e => updateSetting('logoSize', Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <div className="text-xs text-secondary mt-4" style={{ fontSize: 9 }}>
                    Square side dimension (24 to 54 pt).
                  </div>
                </div>

                {/* X-Axis Offset */}
                <div className="form-group">
                  <div className="flex items-center justify-between mb-6">
                    <label className="form-label" style={{ fontSize: 11 }}>X-Axis Offset (Horizontal)</label>
                    <span className="badge badge-secondary font-mono" style={{ fontSize: 10 }}>
                      {settings.logoOffsetX || 0} pt
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-10}
                    max={80}
                    step={2}
                    value={settings.logoOffsetX || 0}
                    onChange={e => updateSetting('logoOffsetX', Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <div className="text-xs text-secondary mt-4" style={{ fontSize: 9 }}>
                    Shift logo horizontally inside the header.
                  </div>
                </div>

                {/* Y-Axis Offset */}
                <div className="form-group">
                  <div className="flex items-center justify-between mb-6">
                    <label className="form-label" style={{ fontSize: 11 }}>Y-Axis Offset (Vertical)</label>
                    <span className="badge badge-secondary font-mono" style={{ fontSize: 10 }}>
                      {settings.logoOffsetY || 0} pt
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-15}
                    max={25}
                    step={1}
                    value={settings.logoOffsetY || 0}
                    onChange={e => updateSetting('logoOffsetY', Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <div className="text-xs text-secondary mt-4" style={{ fontSize: 9 }}>
                    Shift logo vertically inside the header.
                  </div>
                </div>
              </div>

              <div className="text-xs text-secondary mt-10" style={{ background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 4 }}>
                🔒 <strong>Boundary Constraint:</strong> Logo placement is restricted exclusively within the official Header Section box.
              </div>
            </div>

            {/* 4. Branding BOX Footer */}
            <div className="card" style={{ padding: 22 }}>
              <h3 className="text-sm fw-700 text-primary flex items-center gap-8 mb-16">
                <FileText size={16} className="icon-accent" /> 🏷️ Branding BOX Footer
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                {/* Branding Text Field */}
                <div>
                  <label className="form-label" style={{ fontSize: 11 }}>Branding Text (Default: "HENU OS - Records Management")</label>
                  <input
                    type="text"
                    className="input-control text-xs"
                    placeholder="HENU OS - Records Management"
                    value={settings.brandingText !== undefined ? settings.brandingText : 'HENU OS - Records Management'}
                    onChange={e => updateSetting('brandingText', e.target.value)}
                  />
                  <div className="text-xs text-secondary mt-4" style={{ fontSize: 9 }}>
                    Appears in the footer of all register forms (Form I, Form J, Share Register, Property, Nomination, Bank Lien Mark).
                  </div>
                </div>

                {/* Custom Left Footer Text Field */}
                <div>
                  <label className="form-label" style={{ fontSize: 11 }}>Custom Left Footer Text (Optional)</label>
                  <input
                    type="text"
                    className="input-control text-xs"
                    placeholder="e.g. Confidential / Internal Use Only"
                    value={settings.customFooterText || ''}
                    onChange={e => updateSetting('customFooterText', e.target.value)}
                  />
                  <div className="text-xs text-secondary mt-4" style={{ fontSize: 9 }}>
                    Optional additional text displayed on the opposite side of the footer.
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 11 }}>Page Number Alignment</label>
                  <div className="flex items-center gap-4 mb-8" style={{ background: 'var(--surface-2)', padding: 4, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    {(['left', 'center', 'right'] as const).map(align => (
                      <button
                        key={align}
                        type="button"
                        className={`btn btn-xs flex-1 justify-center ${settings.pageNumberAlign === align ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => updateSetting('pageNumberAlign', align)}
                        style={{ fontSize: 10, padding: '4px 6px' }}
                      >
                        {align}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 11 }}>Branding Alignment</label>
                  <div className="flex items-center gap-4 mb-8" style={{ background: 'var(--surface-2)', padding: 4, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    {(['left', 'center', 'right'] as const).map(align => (
                      <button
                        key={align}
                        type="button"
                        className={`btn btn-xs flex-1 justify-center ${settings.brandingAlign === align ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => updateSetting('brandingAlign', align)}
                        style={{ fontSize: 10, padding: '4px 6px' }}
                      >
                        {align}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 11 }}>Custom Footer Alignment</label>
                  <div className="flex items-center gap-4 mb-8" style={{ background: 'var(--surface-2)', padding: 4, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    {(['left', 'center', 'right'] as const).map(align => (
                      <button
                        key={align}
                        type="button"
                        className={`btn btn-xs flex-1 justify-center ${settings.customFooterAlign === align ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => updateSetting('customFooterAlign', align)}
                        style={{ fontSize: 10, padding: '4px 6px' }}
                      >
                        {align}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Visual Settings Preview Card */}
          <div>
            <div id="live-style-preview" className="card" style={{ padding: 22, position: 'sticky', top: 20 }}>
              <div className="flex items-center justify-between mb-16">
                <h3 className="text-sm fw-700 text-primary flex items-center gap-8">
                  <Eye size={16} className="icon-accent" /> Live Style Preview
                </h3>
                <span className="badge badge-accent" style={{ fontSize: 10 }}>
                  Real-time Render
                </span>
              </div>

              {/* Sample Table Container */}
              {(() => {
                const isBW = settings.colorMode === 'BW';
                const headerBg = isBW ? '#E2E8F0' : settings.headerBgColor;
                const textColor = isBW ? '#000000' : settings.textColor;
                const cellBg = isBW ? '#FFFFFF' : settings.cellBgColor;
                const borderColor = isBW ? '#000000' : settings.borderColor;
                const borderWidth = settings.gridOn ? `${settings.gridThickness || 0.5}pt` : '0px';
                const borderOpacity = settings.gridOn ? (settings.gridOpacity / 100) : 0;
                const gridBorderStyle = settings.gridOn ? `${borderWidth} solid ${borderColor}` : 'none';

                const socName = (activeSociety?.societyName || 'HENU OS PVT LTD CO-SOC').toUpperCase();
                const regNo = (activeSociety?.registrationNo || '').trim();
                const regDate = (activeSociety?.registrationDate || '').trim();
                const regInfo = (regNo || regDate) ? `${regNo || '[REGISTRATION NO.]'}.: ${regDate || '[DATE]'}` : '[REGISTRATION NO].: [DATE]';
                const address = activeSociety?.address || 'Home Bhagesar, 10B-204 Second Floor, Pali AASAN home, Pali, Rajasthan 306401';
                const fontCss = settings.fontFamily === 'Courier' ? 'Courier New, monospace' : settings.fontFamily === 'Times-Roman' ? 'Times New Roman, serif' : 'sans-serif';
                const alignCss = settings.horizontalAlign || 'center';

                return (
                  <div style={{
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: 12,
                    background: '#FAFAFA',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    {/* Standardized Form Header Box */}
                    <div style={{
                      position: 'relative',
                      border: `1px solid ${borderColor}`,
                      borderRadius: 4,
                      padding: '10px 12px',
                      marginBottom: 12,
                      textAlign: alignCss as any,
                      fontFamily: fontCss,
                      fontWeight: settings.bold ? 'bold' : 'normal',
                      fontStyle: settings.italic ? 'italic' : 'normal',
                    }}>
                      {/* Live Society Logo Preview positioned with X, Y offsets and Size */}
                      {activeSociety?.logoBase64 ? (
                        <div style={{
                          position: 'absolute',
                          left: `${12 + (settings.logoOffsetX || 0)}px`,
                          top: `calc(50% - ${(settings.logoSize || 44) / 2}px + ${-(settings.logoOffsetY || 0)}px)`,
                          width: `${settings.logoSize || 44}px`,
                          height: `${settings.logoSize || 44}px`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px dashed rgba(0,0,0,0.15)',
                          borderRadius: 4,
                          background: 'rgba(255,255,255,0.85)',
                          overflow: 'hidden',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                          pointerEvents: 'none',
                        }}>
                          <img
                            src={activeSociety.logoBase64}
                            alt="Logo Preview"
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                          />
                        </div>
                      ) : (
                        <div style={{
                          position: 'absolute',
                          left: `${12 + (settings.logoOffsetX || 0)}px`,
                          top: `calc(50% - ${(settings.logoSize || 44) / 2}px + ${-(settings.logoOffsetY || 0)}px)`,
                          width: `${settings.logoSize || 44}px`,
                          height: `${settings.logoSize || 44}px`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px dashed var(--primary)',
                          borderRadius: 4,
                          background: 'rgba(41, 98, 255, 0.08)',
                          fontSize: 9,
                          color: 'var(--primary)',
                          fontWeight: 700,
                          pointerEvents: 'none',
                        }}>
                          LOGO
                        </div>
                      )}

                      {/* LINE 1: Society Registration Name */}
                      <div style={{
                        fontSize: `${settings.headerFontSize}pt`,
                        fontWeight: 'bold',
                        color: textColor,
                        marginBottom: 3
                      }}>
                        {socName}
                      </div>

                      {/* LINE 2: {Society Registration No}.: {Date} */}
                      <div style={{
                        fontSize: `${Math.max(7.5, settings.headerFontSize - 3)}pt`,
                        color: textColor,
                        marginBottom: 3
                      }}>
                        {regInfo}
                      </div>

                      {/* LINE 3: Society Registered Address */}
                      <div style={{
                        fontSize: `${Math.max(7.5, settings.headerFontSize - 3)}pt`,
                        color: textColor,
                        wordBreak: 'break-word',
                        lineHeight: 1.3,
                        marginBottom: 6
                      }}>
                        {address}
                      </div>

                      <div style={{ borderTop: `1px solid ${borderColor}`, margin: '6px 0' }} />

                      {/* Form Title */}
                      <div style={{
                        fontSize: `${settings.headerFontSize}pt`,
                        fontWeight: 'bold',
                        color: textColor,
                        marginTop: 4
                      }}>
                        {TABS.find(t => t.id === activeTab)?.label || 'REGISTER FORM'}
                      </div>
                    </div>

                    {/* FORM SPECIFIC PREVIEW CONTENT */}
                    {activeTab === 'global' || activeTab === 'FORM_I' ? (
                      /* FORM I: Register of Members Schema */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: `${settings.fontSize}pt` }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                          <div style={{ border: gridBorderStyle, opacity: borderOpacity, background: headerBg, color: textColor, padding: '4px 6px', fontWeight: 'bold', fontSize: `${Math.max(6.5, settings.fontSize - 1)}pt` }}>1. Serial Number</div>
                          <div style={{ border: gridBorderStyle, opacity: borderOpacity, background: headerBg, color: textColor, padding: '4px 6px', fontWeight: 'bold', fontSize: `${Math.max(6.5, settings.fontSize - 1)}pt` }}>2. Date of admission</div>
                          <div style={{ border: gridBorderStyle, opacity: borderOpacity, background: headerBg, color: textColor, padding: '4px 6px', fontWeight: 'bold', fontSize: `${Math.max(6.5, settings.fontSize - 1)}pt` }}>3. Date of entrance fee</div>
                          <div style={{ border: gridBorderStyle, opacity: borderOpacity, background: cellBg, color: textColor, padding: '4px 6px' }}>HENU-MEM-001</div>
                          <div style={{ border: gridBorderStyle, opacity: borderOpacity, background: cellBg, color: textColor, padding: '4px 6px' }}>02/12/2025</div>
                          <div style={{ border: gridBorderStyle, opacity: borderOpacity, background: cellBg, color: textColor, padding: '4px 6px' }}>02/12/2025</div>
                        </div>

                        <div style={{ border: gridBorderStyle, opacity: borderOpacity, background: headerBg, color: textColor, padding: '4px 6px', fontWeight: 'bold', fontSize: `${Math.max(6.5, settings.fontSize - 1)}pt` }}>4. Full Name of Member</div>
                        <div style={{ border: gridBorderStyle, opacity: borderOpacity, background: cellBg, color: textColor, padding: '4px 6px', fontWeight: settings.bold ? 'bold' : 'normal' }}>Ramesh Patel</div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <div style={{ border: gridBorderStyle, opacity: borderOpacity, background: headerBg, color: textColor, padding: '4px 6px', fontWeight: 'bold', fontSize: `${Math.max(6.5, settings.fontSize - 1)}pt` }}>5. Residential Address</div>
                          <div style={{ border: gridBorderStyle, opacity: borderOpacity, background: headerBg, color: textColor, padding: '4px 6px', fontWeight: 'bold', fontSize: `${Math.max(6.5, settings.fontSize - 1)}pt` }}>5. Permanent Address</div>
                          <div style={{ border: gridBorderStyle, opacity: borderOpacity, background: cellBg, color: textColor, padding: '4px 6px' }}>Home Bhagesar, 10B-204, Pali</div>
                          <div style={{ border: gridBorderStyle, opacity: borderOpacity, background: cellBg, color: textColor, padding: '4px 6px' }}>Home Bhagesar, 10B-204, Pali</div>
                        </div>

                        <div style={{ marginTop: 4, fontWeight: 'bold', fontSize: `${Math.max(7, settings.fontSize)}pt`, color: textColor }}>PARTICULARS OF SHARES HELD</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: `${Math.max(6.5, settings.fontSize - 1)}pt` }}>
                          <thead>
                            <tr style={{ background: headerBg, color: textColor }}>
                              <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px 6px' }}>Date</th>
                              <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px 6px' }}>App. / Allotment</th>
                              <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px 6px' }}>Amount (Rs)</th>
                              <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px 6px' }}>No. Shares</th>
                              <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px 6px' }}>From - To</th>
                              <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px 6px' }}>Cert No.</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ background: cellBg, color: textColor }}>
                              <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px 6px', textAlign: 'center' }}>02/12/2025</td>
                              <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px 6px', textAlign: 'center' }}>Allotment</td>
                              <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px 6px', textAlign: 'right' }}>Rs 5,000</td>
                              <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px 6px', textAlign: 'center' }}>100</td>
                              <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px 6px', textAlign: 'center' }}>001 – 100</td>
                              <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px 6px', textAlign: 'center' }}>HENU-SH-001</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : activeTab === 'FORM_J' ? (
                      /* FORM J: List of Members Schema */
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: `${settings.fontSize}pt` }}>
                        <thead>
                          <tr style={{ background: headerBg, color: textColor }}>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', fontSize: `${settings.headerFontSize}pt`, fontWeight: 'bold' }}>1. Sr. No.</th>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', fontSize: `${settings.headerFontSize}pt`, fontWeight: 'bold' }}>2. Full Name of Member</th>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', fontSize: `${settings.headerFontSize}pt`, fontWeight: 'bold' }}>3. Address</th>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', fontSize: `${settings.headerFontSize}pt`, fontWeight: 'bold' }}>4. Class of Member</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ background: cellBg, color: textColor }}>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', textAlign: alignCss as any }}>HENU-MEM-001</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', textAlign: alignCss as any }}>Ramesh Patel</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', textAlign: alignCss as any }}>Home Bhagesar, 10B-204, Pali</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', textAlign: 'center' }}>Active Member</td>
                          </tr>
                        </tbody>
                      </table>
                    ) : activeTab === 'FORM_SHARE' ? (
                      /* SHARE REGISTER: Two-Tier Accounting Schema */
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: `${Math.max(6.5, settings.fontSize - 1)}pt` }}>
                        <thead>
                          <tr style={{ background: headerBg, color: textColor }}>
                            <th rowSpan={2} style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px' }}>Sr. No.</th>
                            <th rowSpan={2} style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px' }}>Folio / App</th>
                            <th rowSpan={2} style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px' }}>Date</th>
                            <th rowSpan={2} style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px' }}>Share Holder Name & Address</th>
                            <th rowSpan={2} style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px' }}>Shares</th>
                            <th colSpan={2} style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px' }}>Distinctive Nos.</th>
                            <th rowSpan={2} style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px' }}>Entry Date</th>
                            <th rowSpan={2} style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px' }}>Paid Up</th>
                            <th colSpan={2} style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px' }}>Remarks</th>
                          </tr>
                          <tr style={{ background: headerBg, color: textColor }}>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '3px' }}>From</th>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '3px' }}>To</th>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '3px' }}>Trans No</th>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '3px' }}>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ background: cellBg, color: textColor }}>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px', textAlign: 'center' }}>001</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px', textAlign: 'center' }}>FL-101</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px', textAlign: 'center' }}>02/12/2025</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px' }}>Ramesh Patel (Home Bhagesar, Pali)</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px', textAlign: 'center' }}>100</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px', textAlign: 'center' }}>001</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px', textAlign: 'center' }}>100</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px', textAlign: 'center' }}>02/12/2025</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px', textAlign: 'center' }}>FULL</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px', textAlign: 'center' }}>—</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '4px', textAlign: 'center' }}>—</td>
                          </tr>
                        </tbody>
                      </table>
                    ) : activeTab === 'FORM_NOM' ? (
                      /* NOMINATION REGISTER Schema */
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: `${settings.fontSize}pt` }}>
                        <thead>
                          <tr style={{ background: headerBg, color: textColor }}>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', fontSize: `${settings.headerFontSize}pt`, fontWeight: 'bold' }}>1. Sr. No.</th>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', fontSize: `${settings.headerFontSize}pt`, fontWeight: 'bold' }}>2. Member Name</th>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', fontSize: `${settings.headerFontSize}pt`, fontWeight: 'bold' }}>3. Flat No.</th>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', fontSize: `${settings.headerFontSize}pt`, fontWeight: 'bold' }}>4. Nominee Name</th>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', fontSize: `${settings.headerFontSize}pt`, fontWeight: 'bold' }}>5. Relationship</th>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', fontSize: `${settings.headerFontSize}pt`, fontWeight: 'bold' }}>6. Share (%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ background: cellBg, color: textColor }}>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', textAlign: alignCss as any }}>001</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', textAlign: alignCss as any }}>Ramesh Patel</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', textAlign: alignCss as any }}>A-101</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', textAlign: alignCss as any }}>Daya Ramesh Patel</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', textAlign: alignCss as any }}>Wife</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', textAlign: 'center' }}>100%</td>
                          </tr>
                        </tbody>
                      </table>
                    ) : activeTab === 'FORM_PROP' ? (
                      /* PROPERTY REGISTER Schema */
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: `${Math.max(7, settings.fontSize)}pt` }}>
                        <thead>
                          <tr style={{ background: headerBg, color: textColor }}>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', fontWeight: 'bold' }}>1. Sr. No.</th>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', fontWeight: 'bold' }}>2. Property / Flat Description</th>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', fontWeight: 'bold' }}>3. Area (Sq.Ft)</th>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', fontWeight: 'bold' }}>4. Owner Member Name</th>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', fontWeight: 'bold' }}>5. Encumbrances / Lien Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ background: cellBg, color: textColor }}>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', textAlign: alignCss as any }}>001</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', textAlign: alignCss as any }}>Flat A-101 (2 BHK Residential)</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', textAlign: 'center' }}>850 Sq.Ft</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', textAlign: alignCss as any }}>Ramesh Patel</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', textAlign: alignCss as any }}>State Bank of India (Lien: Rs 25,00,000)</td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      /* BANK LIEN MARK Schema */
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: `${settings.fontSize}pt` }}>
                        <thead>
                          <tr style={{ background: headerBg, color: textColor }}>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', fontSize: `${settings.headerFontSize}pt`, fontWeight: 'bold' }}>1. Sr. No.</th>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', fontSize: `${settings.headerFontSize}pt`, fontWeight: 'bold' }}>2. Member Name</th>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', fontSize: `${settings.headerFontSize}pt`, fontWeight: 'bold' }}>3. Bank / Financial Institution</th>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', fontSize: `${settings.headerFontSize}pt`, fontWeight: 'bold' }}>4. Loan Acc. No.</th>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', fontSize: `${settings.headerFontSize}pt`, fontWeight: 'bold' }}>5. Lien Amount (Rs)</th>
                            <th style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', fontSize: `${settings.headerFontSize}pt`, fontWeight: 'bold' }}>6. Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ background: cellBg, color: textColor }}>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', textAlign: alignCss as any }}>001</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', textAlign: alignCss as any }}>Ramesh Patel</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', textAlign: alignCss as any }}>State Bank of India</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', textAlign: alignCss as any }}>LN-987654321</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', textAlign: 'right' }}>Rs 25,00,000</td>
                            <td style={{ border: gridBorderStyle, opacity: borderOpacity, padding: '6px 8px', textAlign: 'center' }}>Active Lien</td>
                          </tr>
                        </tbody>
                      </table>
                    )}

                    {/* Page Footer Preview */}
                    <div style={{
                      marginTop: 16,
                      fontSize: '7pt',
                      fontFamily: fontCss,
                      color: textColor
                    }}>
                      {/* Page number positioned just above the footer line in center */}
                      <div style={{ textAlign: (settings.pageNumberAlign || 'center') as any, marginBottom: 3, fontWeight: 600 }}>
                        {settings.pageNumberPrefix !== undefined ? settings.pageNumberPrefix : ''}1
                      </div>
                      <div style={{
                        paddingTop: 6,
                        borderTop: `1px solid ${borderColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <div style={{ textAlign: (settings.customFooterAlign || 'left') as any }}>
                          {settings.customFooterText || ''}
                        </div>
                        <div style={{ textAlign: (settings.brandingAlign || 'right') as any, marginLeft: 'auto' }}>
                          {settings.brandingText || 'HENU OS - Records Management'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="alert alert-info text-xs mt-16" style={{ margin: '16px 0 0' }}>
                ⓘ Live preview updates instantly as you adjust font family, font size, bold, italic, Color/B&W mode, grid thickness, color pickers, and grid opacity sliders.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
