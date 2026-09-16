import React, { useState, useRef } from 'react';
import { Building2, X, Check, Upload, Image as ImageIcon, Trash2, Calendar, MapPin, Hash, Sparkles } from 'lucide-react';
import { AddSocietyPayload } from '../../main/types';

interface AddSocietyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSocietyAdded?: () => void;
}

export default function AddSocietyModal({ isOpen, onClose, onSuccess, onSocietyAdded }: AddSocietyModalProps) {
  const [formData, setFormData] = useState<AddSocietyPayload>({
    societyName: '',
    registrationNo: '',
    registrationDate: '',
    fullAddress: '',
    city: '',
    state: '',
    pinCode: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes('png')) {
      setError('Please upload a PNG format image only.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      setFormData(prev => ({ ...prev, logoBase64: res }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.societyName.trim()) {
      setError('Society Name is required.');
      return;
    }
    if (!formData.registrationNo.trim()) {
      setError('Registration Number is required.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const api = (window as any).api;
      if (api && api.society) {
        await api.society.create(formData);
      }
      if (onSuccess) onSuccess();
      if (onSocietyAdded) onSocietyAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save society');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1.5px solid var(--border, #e2e8f0)',
    backgroundColor: 'var(--surface, #ffffff)',
    color: 'var(--text-primary, #0f172a)',
    fontSize: '13.5px',
    outline: 'none',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
  };

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary, #475569)',
    marginBottom: '6px',
    letterSpacing: '0.01em',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '580px',
          backgroundColor: 'var(--surface, #ffffff)',
          borderRadius: '18px',
          border: '1px solid var(--border, rgba(226, 232, 240, 0.9))',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.03)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px 18px',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            background: 'linear-gradient(to right, var(--surface, #ffffff), var(--surface-2, #f8fafc))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                color: '#ffffff',
              }}
            >
              <Building2 size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
                Add Society
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', margin: '2px 0 0 0' }}>
                Create a new society profile & registration records
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-muted, #64748b)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--surface-2, #f1f5f9)';
              e.currentTarget.style.color = 'var(--text-primary, #0f172a)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted, #64748b)';
            }}
          >
            <X size={19} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div style={{ padding: '22px 24px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#dc2626',
                fontSize: '13px',
                fontWeight: 500,
                marginBottom: '18px',
              }}
            >
              <span style={{ fontSize: '15px' }}>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form id="add-society-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Society Name */}
            <div>
              <label style={labelStyle}>
                Society Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                name="societyName"
                value={formData.societyName}
                onChange={handleChange}
                placeholder="e.g. GREEN VALLEY CO-OPERATIVE HOUSING SOCIETY LTD."
                required
                style={inputStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = '#7C3AED';
                  e.target.style.boxShadow = '0 0 0 3px rgba(124, 58, 237, 0.12)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border, #e2e8f0)';
                  e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
                }}
              />
            </div>

            {/* Registration No & Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
              <div>
                <label style={labelStyle}>
                  Registration Number <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  name="registrationNo"
                  value={formData.registrationNo}
                  onChange={handleChange}
                  placeholder="e.g. BOM/HSG/12345/2024"
                  required
                  style={inputStyle}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#7C3AED';
                    e.target.style.boxShadow = '0 0 0 3px rgba(124, 58, 237, 0.12)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border, #e2e8f0)';
                    e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
                  }}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Registration Date
                </label>
                <input
                  type="text"
                  name="registrationDate"
                  value={formData.registrationDate}
                  onChange={handleChange}
                  placeholder="e.g. 15/01/2024"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#7C3AED';
                    e.target.style.boxShadow = '0 0 0 3px rgba(124, 58, 237, 0.12)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border, #e2e8f0)';
                    e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
                  }}
                />
              </div>
            </div>

            {/* Full Address */}
            <div>
              <label style={labelStyle}>
                Full Address
              </label>
              <textarea
                name="fullAddress"
                value={formData.fullAddress}
                onChange={handleChange}
                placeholder="Plot No. 12, Sector 15, Link Road"
                rows={2}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  minHeight: '60px',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#7C3AED';
                  e.target.style.boxShadow = '0 0 0 3px rgba(124, 58, 237, 0.12)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border, #e2e8f0)';
                  e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
                }}
              />
            </div>

            {/* City, State, PIN */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="e.g. Mumbai"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#7C3AED';
                    e.target.style.boxShadow = '0 0 0 3px rgba(124, 58, 237, 0.12)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border, #e2e8f0)';
                    e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
                  }}
                />
              </div>
              <div>
                <label style={labelStyle}>State</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="e.g. Maharashtra"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#7C3AED';
                    e.target.style.boxShadow = '0 0 0 3px rgba(124, 58, 237, 0.12)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border, #e2e8f0)';
                    e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
                  }}
                />
              </div>
              <div>
                <label style={labelStyle}>PIN Code</label>
                <input
                  type="text"
                  name="pinCode"
                  value={formData.pinCode}
                  onChange={handleChange}
                  placeholder="e.g. 400001"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#7C3AED';
                    e.target.style.boxShadow = '0 0 0 3px rgba(124, 58, 237, 0.12)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border, #e2e8f0)';
                    e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
                  }}
                />
              </div>
            </div>

            {/* Logo Upload Box (Modern Dropzone Card) */}
            <div
              style={{
                backgroundColor: 'var(--surface-2, #f8fafc)',
                borderRadius: '12px',
                border: '1.5px dashed var(--border, #cbd5e1)',
                padding: '14px 16px',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #475569)' }}>
                  Official Society Logo
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#7C3AED',
                    backgroundColor: 'rgba(124, 58, 237, 0.08)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                  }}
                >
                  PNG Format Only
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {formData.logoBase64 ? (
                  <div
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '10px',
                      border: '1.5px solid rgba(124, 58, 237, 0.3)',
                      overflow: 'hidden',
                      backgroundColor: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
                      flexShrink: 0,
                    }}
                  >
                    <img src={formData.logoBase64} alt="Society Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                ) : (
                  <div
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '10px',
                      border: '1.5px dashed #94a3b8',
                      backgroundColor: 'rgba(255, 255, 255, 0.6)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94a3b8',
                      flexShrink: 0,
                    }}
                  >
                    <ImageIcon size={20} />
                    <span style={{ fontSize: '9px', fontWeight: 600, marginTop: '2px' }}>No Logo</span>
                  </div>
                )}

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border, #cbd5e1)',
                        backgroundColor: '#ffffff',
                        color: 'var(--text-primary, #0f172a)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#7C3AED';
                        e.currentTarget.style.color = '#7C3AED';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border, #cbd5e1)';
                        e.currentTarget.style.color = 'var(--text-primary, #0f172a)';
                      }}
                    >
                      <Upload size={13} />
                      {formData.logoBase64 ? 'Change PNG Logo' : 'Upload PNG Logo'}
                    </button>

                    {formData.logoBase64 && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, logoBase64: undefined }))}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          backgroundColor: 'rgba(239, 68, 68, 0.06)',
                          color: '#ef4444',
                          fontSize: '12px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    )}
                  </div>
                  <p style={{ fontSize: '10.5px', color: 'var(--text-muted, #64748b)', margin: '6px 0 0 0', lineHeight: 1.3 }}>
                    Recommended: Square PNG (e.g. 200×200 px). Displayed on top-left of official headers & forms.
                  </p>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            padding: '16px 24px',
            borderTop: '1px solid var(--border, #e2e8f0)',
            backgroundColor: 'var(--surface-2, #f8fafc)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              border: '1.5px solid var(--border, #cbd5e1)',
              backgroundColor: '#ffffff',
              color: 'var(--text-secondary, #475569)',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!submitting) e.currentTarget.style.backgroundColor = 'var(--surface-2, #f1f5f9)';
            }}
            onMouseLeave={(e) => {
              if (!submitting) e.currentTarget.style.backgroundColor = '#ffffff';
            }}
          >
            Cancel
          </button>

          <button
            type="submit"
            form="add-society-form"
            disabled={submitting}
            style={{
              padding: '9px 22px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)',
              color: '#ffffff',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)',
              transition: 'all 0.15s ease',
              opacity: submitting ? 0.75 : 1,
            }}
            onMouseEnter={(e) => {
              if (!submitting) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(124, 58, 237, 0.45)';
              }
            }}
            onMouseLeave={(e) => {
              if (!submitting) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(124, 58, 237, 0.35)';
              }
            }}
          >
            {submitting ? (
              <>Saving...</>
            ) : (
              <>
                <Check size={16} strokeWidth={2.5} /> Save Society
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

