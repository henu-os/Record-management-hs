/**
 * HENU VOUCHER OCR — API CONFIGURATION & MODEL MANAGER MODAL
 * Allows configuring and testing API keys and models for:
 * 1. Google Gemini
 * 2. xAI Grok
 * 3. DeepSeek
 * 4. OpenRouter
 */

import React, { useState, useEffect } from 'react';
import {
  X, Globe, Key, Zap, CheckCircle2, AlertTriangle, RefreshCw, Eye, EyeOff,
  Lock, Settings, ExternalLink
} from 'lucide-react';
import type { ApiProviderId, ProviderSettings, ConnectionTestResult } from '../../../../main/services/ocr-api/types';

interface OcrApiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
  onNavigateToSettings?: () => void;
}

const PROVIDER_METADATA: Record<ApiProviderId, {
  name: string;
  tagline: string;
  defaultModel: string;
  recommendedModels: string[];
  docUrl: string;
  isVisionSupported: boolean;
}> = {
  gemini: {
    name: 'Google Gemini',
    tagline: 'High-speed multimodal vision model for document transcription',
    defaultModel: 'gemini-2.5-flash-lite',
    recommendedModels: ['gemini-2.5-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3-flash-preview', 'gemini-pro-latest'],
    docUrl: 'https://aistudio.google.com/',
    isVisionSupported: true,
  },
  grok: {
    name: 'xAI Grok',
    tagline: 'Vision multimodal reasoning engine',
    defaultModel: 'grok-2-vision-1212',
    recommendedModels: ['grok-2-vision-1212', 'grok-vision-beta'],
    docUrl: 'https://console.x.ai/',
    isVisionSupported: true,
  },
  deepseek: {
    name: 'DeepSeek',
    tagline: 'Cost-effective reasoning & chat API (Text-only default model)',
    defaultModel: 'deepseek-chat',
    recommendedModels: ['deepseek-chat', 'deepseek-reasoner'],
    docUrl: 'https://platform.deepseek.com/',
    isVisionSupported: false,
  },
  openrouter: {
    name: 'OpenRouter',
    tagline: 'Universal gateway for multimodal models (Claude, Gemini, GPT-4o)',
    defaultModel: 'google/gemini-flash-1.5',
    recommendedModels: ['google/gemini-flash-1.5', 'anthropic/claude-3-5-sonnet', 'openai/gpt-4o-mini'],
    docUrl: 'https://openrouter.ai/keys',
    isVisionSupported: true,
  },
};

import { ClientOcrApiBridge } from '../services/ClientOcrApiBridge';

export const OcrApiConfigModal: React.FC<OcrApiConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
  onNavigateToSettings,
}) => {
  const [activeProvider, setActiveProvider] = useState<ApiProviderId>('gemini');
  const [providers, setProviders] = useState<Record<string, ProviderSettings>>({});
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelInput, setModelInput] = useState('gemini-1.5-flash');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const loadConfig = async () => {
    try {
      const config = await ClientOcrApiBridge.getConfig();
      if (config) {
        if (config.activeProvider) {
          setActiveProvider(config.activeProvider);
        }
        if (config.providers) {
          setProviders(config.providers);
          const current = config.providers[config.activeProvider || 'gemini'];
          if (current?.model) {
            setModelInput(current.model);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load OCR API config:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      setTestResult(null);
      setStatusMessage('');
      setApiKeyInput('');
    }
  }, [isOpen]);

  const handleProviderSelect = (pId: ApiProviderId) => {
    setActiveProvider(pId);
    setApiKeyInput('');
    setTestResult(null);
    setStatusMessage('');
    const prov = providers[pId];
    if (prov?.model) {
      setModelInput(prov.model);
    } else {
      setModelInput(PROVIDER_METADATA[pId].defaultModel);
    }
  };

  const handleSave = async (makeActive: boolean = true) => {
    setIsSaving(true);
    setStatusMessage('Saving credentials to secure vault...');
    try {
      const configToSave: { apiKey?: string; model?: string } = {
        model: modelInput.trim(),
      };
      if (apiKeyInput.trim()) {
        configToSave.apiKey = apiKeyInput.trim();
      }

      const updated = await ClientOcrApiBridge.saveProviderConfig(activeProvider, configToSave);
      if (makeActive) {
        await ClientOcrApiBridge.setActiveProvider(activeProvider);
        await ClientOcrApiBridge.setMode('APIS');
      }

      if (updated?.providers) {
        setProviders(updated.providers);
      }
      setApiKeyInput('');
      setStatusMessage('✓ Configuration saved securely in credential vault!');
      if (onConfigSaved) onConfigSaved();
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err: any) {
      setStatusMessage(`Error saving: ${err?.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const typedKey = apiKeyInput.trim();
      const typedModel = modelInput.trim();
      if (typedKey || typedModel !== providers[activeProvider]?.model) {
        await handleSave(false);
      }
      const res = await ClientOcrApiBridge.testConnection(
        activeProvider,
        typedKey || undefined,
        typedModel || undefined
      );
      setTestResult(res);
      await loadConfig();
    } catch (err: any) {
      setTestResult({
        success: false,
        provider: activeProvider,
        model: modelInput,
        latencyMs: 0,
        visionSupported: false,
        errorCategory: 'CONNECTION_ERROR',
        errorMessage: err?.message || 'Failed to connect to provider endpoint',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  const currentMeta = PROVIDER_METADATA[activeProvider];
  const currentSetting = providers[activeProvider] || {
    provider: activeProvider,
    model: currentMeta.defaultModel,
    hasApiKey: false,
    visionSupported: currentMeta.isVisionSupported ? 'SUPPORTED' : 'UNSUPPORTED',
    connectionStatus: 'NOT_TESTED',
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 20,
    }}>
      <div style={{
        background: 'var(--surface, #ffffff)',
        borderRadius: 12,
        border: '1px solid var(--border)',
        width: '100%',
        maxWidth: 720,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-lg, 0 20px 40px rgba(0,0,0,0.3))',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--surface-2, #f8fafc)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              background: 'var(--accent, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}>
              <Globe size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                OCR API Models & Provider Configuration
              </h3>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Configure external AI models for automated voucher & cheque extraction
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Provider Tabs */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, display: 'block' }}>
              Select AI Provider
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {(Object.keys(PROVIDER_METADATA) as ApiProviderId[]).map(pId => {
                const meta = PROVIDER_METADATA[pId];
                const isSelected = activeProvider === pId;
                const provSetting = providers[pId];
                return (
                  <button
                    key={pId}
                    type="button"
                    onClick={() => handleProviderSelect(pId)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: 8,
                      border: isSelected ? '2px solid var(--accent, #7c3aed)' : '1px solid var(--border)',
                      background: isSelected ? 'rgba(124, 58, 237, 0.12)' : 'var(--surface-2)',
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{meta.name}</span>
                    <span style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: provSetting?.hasApiKey ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: provSetting?.hasApiKey ? '#10B981' : '#EF4444',
                      fontWeight: 600,
                    }}>
                      {provSetting?.hasApiKey ? 'Key Configured' : 'No Key'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Provider Details Card */}
          <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{currentMeta.name}</span>
                <p style={{ margin: '2px 0 0 0', fontSize: 11, color: 'var(--text-secondary)' }}>{currentMeta.tagline}</p>
              </div>
              <a
                href={currentMeta.docUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 11, color: 'var(--accent, #7c3aed)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontWeight: 600 }}
              >
                Get API Key <ExternalLink size={11} />
              </a>
            </div>

            {/* Model Selection */}
            <div className="form-group" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Vision Model (Automatic Best Match)
                </label>
                <span style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>
                  ● Active: {modelInput || 'gemini-2.5-flash-lite'}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setModelInput('gemini-2.5-flash-lite')}
                  style={{
                    background: (modelInput === 'gemini-2.5-flash-lite' || !modelInput) ? 'var(--accent, #7c3aed)' : 'var(--surface)',
                    color: (modelInput === 'gemini-2.5-flash-lite' || !modelInput) ? '#ffffff' : 'var(--text-primary)',
                    border: (modelInput === 'gemini-2.5-flash-lite' || !modelInput) ? '1px solid var(--accent, #7c3aed)' : '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  ⚡ Auto / Default (gemini-2.5-flash-lite)
                </button>
                {currentMeta.recommendedModels.filter(rm => rm !== 'gemini-2.5-flash-lite').map(rm => (
                  <button
                    key={rm}
                    type="button"
                    onClick={() => setModelInput(rm)}
                    style={{
                      background: modelInput === rm ? 'var(--accent, #7c3aed)' : 'var(--surface)',
                      color: modelInput === rm ? '#ffffff' : 'var(--text-primary)',
                      border: modelInput === rm ? '1px solid var(--accent, #7c3aed)' : '1px solid var(--border)',
                      borderRadius: 4,
                      padding: '4px 8px',
                      fontSize: 10,
                      cursor: 'pointer',
                      fontFamily: 'monospace',
                      fontWeight: 600,
                    }}
                  >
                    {rm}
                  </button>
                ))}
              </div>
            </div>

            {/* API Key Input */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: 12, fontWeight: 700, display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'var(--text-primary)' }}>
                <span>API Secret Key</span>
                <span style={{ fontSize: 10, color: currentSetting.hasApiKey ? '#10B981' : '#EF4444' }}>
                  {currentSetting.hasApiKey ? '● Stored in Local Credential Vault' : '○ Not Saved'}
                </span>
              </label>
              <div style={{ display: 'flex', gap: 6, position: 'relative' }}>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  className="input-control text-xs"
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  placeholder={currentSetting.hasApiKey ? '•••••••••••••••••••••••••••••••• (Leave blank to keep existing key)' : 'Enter API key...'}
                  style={{
                    padding: '8px 36px 8px 12px',
                    fontFamily: 'monospace',
                    flex: 1,
                    background: 'var(--input-bg, var(--surface))',
                    color: 'var(--input-text, var(--text-primary))',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: 4,
                  }}
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Actions: Test Connection */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleTestConnection}
                disabled={isTesting}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, padding: '7px 14px' }}
              >
                {isTesting ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
                Test Connection
              </button>

              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {activeProvider === 'deepseek' && '⚠️ Note: deepseek-chat is text-only.'}
              </div>
            </div>

            {/* Test Result Display */}
            {testResult && (
              <div style={{
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: 11,
                background: testResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${testResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              }}>
                <div style={{ fontWeight: 700, color: testResult.success ? '#10B981' : '#EF4444' }}>
                  {testResult.success ? '✓ Authenticated Connection Passed' : `✗ Connection Failed: ${testResult.errorCategory || 'ERROR'}`}
                </div>
                <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                  {testResult.success
                    ? `Response: ${testResult.latencyMs}ms • Vision: ${testResult.visionSupported ? 'Supported' : 'Unsupported'}`
                    : testResult.errorMessage}
                </div>
              </div>
            )}
          </div>

          {/* Privacy Note */}
          <div style={{
            padding: '8px 12px',
            background: 'rgba(124, 58, 237, 0.08)',
            border: '1px solid rgba(124, 58, 237, 0.2)',
            borderRadius: 6,
            fontSize: 11,
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <Lock size={14} className="text-accent" />
            <span>API keys are stored in encrypted local storage and never sent to browser JavaScript, logs, or Excel exports.</span>
          </div>

          {statusMessage && (
            <div style={{ fontSize: 12, fontWeight: 600, color: statusMessage.includes('Error') ? '#EF4444' : '#10B981' }}>
              {statusMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--surface-2)',
        }}>
          <div>
            {onNavigateToSettings && (
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => {
                  onClose();
                  onNavigateToSettings();
                }}
                style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <Settings size={12} /> Open Full Settings Page
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              style={{ padding: '6px 14px' }}
            >
              Close
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleSave(true)}
              disabled={isSaving}
              style={{ fontWeight: 700, padding: '6px 18px' }}
            >
              {isSaving ? 'Saving...' : 'Save & Set as Active Provider'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
