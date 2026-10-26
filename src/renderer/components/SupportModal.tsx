import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  AlertTriangle,
  Copy,
  Check,
  Send,
  ExternalLink,
  ShieldCheck,
  Headphones,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeSociety?: {
    societyName?: string;
    registrationNo?: string;
  } | null;
}

interface Template {
  id: string;
  icon: string;
  badge: string;
  title: string;
  desc: string;
  defaultText: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'emergency',
    icon: '🚨',
    badge: 'Emergency',
    title: 'Emergency Technical Issue',
    desc: 'System error, data loading issue, or urgent blockage',
    defaultText:
      'Hello HENU OS Support,\n\nI need urgent technical help with my Records Management system.\nTicket: {ticket}\nSociety: {society}\nIssue Description: ',
  },
  {
    id: 'print_layout',
    icon: '📄',
    badge: 'Register & Print',
    title: 'Statutory Register & Legal Print Layout',
    desc: 'Alignment, 1.5 cm Legal margin, or page number options',
    defaultText:
      'Hello HENU OS Support,\n\nI need assistance regarding statutory register printing layout and legal paper margins (1.5 cm).\nTicket: {ticket}\nSociety: {society}\nRegister Form (Form I / J / Share / Property / Nomination / Bank Lien): ',
  },
  {
    id: 'master_data',
    icon: '📊',
    badge: 'Master Data',
    title: 'Master Data & Excel Member Import',
    desc: 'Member records, column mapping, or flat/wing details',
    defaultText:
      'Hello HENU OS Support,\n\nI have a question regarding Master Data Excel template import, member records, and flat/wing mapping.\nTicket: {ticket}\nSociety: {society}\nQuery Details: ',
  },
  {
    id: 'compliance',
    icon: '💼',
    badge: 'Compliance',
    title: 'General Support & Compliance Query',
    desc: 'MCS Act compliance, societies setup, or feature request',
    defaultText:
      'Hello HENU OS Support,\n\nI would like to request support for HENU OS Records Management & statutory compliance.\nTicket: {ticket}\nSociety: {society}\nDetails: ',
  },
];

export default function SupportModal({ isOpen, onClose, activeSociety }: Props) {
  const [ticketSeq, setTicketSeq] = useState<number>(125);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('emergency');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const api = (window as any).api;

  // Initialize Ticket Sequence from localStorage (starting at 125)
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('henu_support_ticket_seq');
      const seq = saved ? parseInt(saved, 10) : 125;
      setTicketSeq(isNaN(seq) || seq < 125 ? 125 : seq);
      setCustomNotes('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const societyLabel = activeSociety?.societyName
    ? `${activeSociety.societyName}${activeSociety.registrationNo ? ` (${activeSociety.registrationNo})` : ''}`
    : 'HENU OS Client';

  const wTicket = `HENU-${ticketSeq}-Wsupport`;
  const eTicket = `HENU-${ticketSeq}-Esupport`;

  const currentTpl = TEMPLATES.find(t => t.id === selectedTemplate) || TEMPLATES[0];

  const buildMessage = (ticket: string) => {
    const base = currentTpl.defaultText
      .replace('{ticket}', ticket)
      .replace('{society}', societyLabel);
    if (customNotes.trim()) {
      return `${base}\nAdditional Notes: ${customNotes.trim()}`;
    }
    return base;
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(label);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const openUrl = async (url: string) => {
    if (api?.system?.openExternal) {
      await api.system.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleSendWhatsApp = async () => {
    const msg = buildMessage(wTicket);
    const url = `https://wa.me/918155077057?text=${encodeURIComponent(msg)}`;
    await openUrl(url);
    const nextSeq = ticketSeq + 1;
    setTicketSeq(nextSeq);
    localStorage.setItem('henu_support_ticket_seq', String(nextSeq));
  };

  const handleSendEmail = async () => {
    const msg = buildMessage(eTicket);
    const subject = `[${eTicket}] HENU OS Support Request - ${activeSociety?.societyName || 'General'}`;
    const url = `mailto:support.henuos@gmail.com,info@henuos.in?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`;
    await openUrl(url);
    const nextSeq = ticketSeq + 1;
    setTicketSeq(nextSeq);
    localStorage.setItem('henu_support_ticket_seq', String(nextSeq));
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.70)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 820,
          maxHeight: '92vh',
          backgroundColor: 'var(--surface, #ffffff)',
          color: 'var(--text-primary, #0f172a)',
          border: '1px solid var(--border, #e2e8f0)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-lg, 0 25px 50px -12px rgba(0, 0, 0, 0.35))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'all 0.2s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 64,
                height: 64,
                minWidth: 64,
                minHeight: 64,
                borderRadius: 14,
                background: '#ffffff',
                border: '1px solid var(--border, #e2e8f0)',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(124, 58, 237, 0.20)',
                flexShrink: 0,
              }}
            >
              <img
                src="images/henu_support.png"
                alt="HENU OS Support"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
                onError={e => {
                  (e.currentTarget as HTMLImageElement).src = 'henu_support.png';
                }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text-primary, #0f172a)', letterSpacing: '-0.01em' }}>
                  HENU OS Official Support Desk
                </h2>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  ● Active 24/7
                </span>
              </div>
              <p style={{ fontSize: 11, margin: '2px 0 0 0', color: 'var(--text-secondary, #64748b)' }}>
                HENU OS PRIVATE LIMITED • Priority Technical & Legal Compliance Support
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary, #64748b)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: 22, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Active Society & Auto Ticket Info Chips */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 10,
              background: 'var(--surface-2, #f8fafc)',
              border: '1px solid var(--border, #e2e8f0)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <ShieldCheck size={16} style={{ color: 'var(--accent, #7c3aed)' }} />
              <span style={{ color: 'var(--text-secondary, #64748b)' }}>Active Society:</span>
              <strong style={{ color: 'var(--text-primary, #0f172a)' }}>
                {activeSociety?.societyName || 'General Workspace'}
              </strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  background: 'var(--success-bg, rgba(16, 185, 129, 0.15))',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  color: 'var(--success, #10b981)',
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontWeight: 700,
                }}
              >
                {wTicket}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  background: 'var(--info-bg, rgba(59, 130, 246, 0.15))',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  color: 'var(--info, #3b82f6)',
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontWeight: 700,
                }}
              >
                {eTicket}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(`${wTicket} | ${eTicket}`, 'tickets')}
                style={{
                  background: 'var(--surface, #ffffff)',
                  border: '1px solid var(--border, #cbd5e1)',
                  color: 'var(--text-primary, #0f172a)',
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {copiedItem === 'tickets' ? <Check size={12} color="var(--success, #10b981)" /> : <Copy size={12} />}
                {copiedItem === 'tickets' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Emergency Alert Call Box */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 12,
              background: 'var(--error-bg, rgba(239, 68, 68, 0.08))',
              border: '1px solid rgba(239, 68, 68, 0.30)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} color="var(--error, #ef4444)" />
                <strong style={{ fontSize: 13, color: 'var(--error, #ef4444)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Request Support Call — For Emergency Only !
                </strong>
              </div>
              <p style={{ fontSize: 11, margin: '4px 0 0 26px', color: 'var(--text-secondary, #64748b)' }}>
                Direct hotline to HENU OS Core Technical Engineers for critical on-ground society emergencies.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => openUrl('tel:+918155077057')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '7px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.35)',
                }}
              >
                <Phone size={13} />
                +91 81550 77057
              </button>

              <button
                type="button"
                onClick={() => openUrl('tel:+918094100513')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--error, #ef4444)',
                  border: '1px solid rgba(239, 68, 68, 0.40)',
                  borderRadius: 8,
                  padding: '7px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Phone size={13} />
                +91 80941 00513
              </button>
            </div>
          </div>

          {/* Quick-Select Message Templates */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'stretch', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-primary, #0f172a)' }}>
                ⚡ Auto Message Templates (Click to Select & Auto-Fill)
              </label>
              <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>Choose issue type</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              {TEMPLATES.map(t => {
                const isSelected = selectedTemplate === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      background: isSelected ? 'rgba(124, 58, 237, 0.12)' : 'var(--surface-2, #f8fafc)',
                      border: isSelected ? '2px solid var(--accent, #7c3aed)' : '1px solid var(--border, #e2e8f0)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 4px 14px rgba(124, 58, 237, 0.18)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 16 }}>{t.icon}</span>
                      <strong style={{ fontSize: 12, color: isSelected ? 'var(--accent, #7c3aed)' : 'var(--text-primary, #0f172a)' }}>
                        {t.title}
                      </strong>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary, #64748b)', lineHeight: 1.35 }}>
                      {t.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Auto Message Preview & Custom Notes */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                📝 Message Preview & Additional Notes
              </label>
              <button
                type="button"
                onClick={() => handleCopy(buildMessage(wTicket), 'message')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent, #7c3aed)',
                  fontSize: 11,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontWeight: 600,
                }}
              >
                {copiedItem === 'message' ? <Check size={12} color="var(--success, #10b981)" /> : <Copy size={12} />}
                {copiedItem === 'message' ? 'Copied Message' : 'Copy Message'}
              </button>
            </div>

            <div
              style={{
                background: 'var(--surface-2, #f8fafc)',
                border: '1px solid var(--border, #e2e8f0)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 11,
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
                color: 'var(--text-primary, #0f172a)',
                marginBottom: 8,
              }}
            >
              {buildMessage(wTicket)}
            </div>

            <textarea
              className="form-input"
              placeholder="Type any specific details, member sr. no., error message or screenshot note here (optional)..."
              value={customNotes}
              onChange={e => setCustomNotes(e.target.value)}
              rows={2}
              style={{
                width: '100%',
                fontSize: 11,
                resize: 'vertical',
                background: 'var(--surface, #ffffff)',
                border: '1px solid var(--border, #cbd5e1)',
                borderRadius: 8,
                padding: '8px 12px',
                color: 'var(--text-primary, #0f172a)',
              }}
            />
          </div>

          {/* Quick Dispatch Buttons: WhatsApp & Email */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button
              type="button"
              onClick={handleSendWhatsApp}
              style={{
                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 10,
                padding: '12px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(22, 163, 74, 0.25)',
              }}
            >
              <MessageSquare size={16} />
              Send via WhatsApp ({wTicket})
              <Send size={13} style={{ opacity: 0.85 }} />
            </button>

            <button
              type="button"
              onClick={handleSendEmail}
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 10,
                padding: '12px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
              }}
            >
              <Mail size={16} />
              Send via Email ({eTicket})
              <Send size={13} style={{ opacity: 0.85 }} />
            </button>
          </div>

          {/* Book Meeting & Official Channels */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: 12,
              paddingTop: 8,
              borderTop: '1px solid var(--border, #e2e8f0)',
            }}
          >
            {/* Calendly Booking Card */}
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background: 'var(--surface-2, #f8fafc)',
                border: '1px solid var(--border, #e2e8f0)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Calendar size={15} style={{ color: 'var(--accent, #7c3aed)' }} />
                  <strong style={{ fontSize: 12, color: 'var(--text-primary, #0f172a)' }}>
                    Book 30-Min Support Meeting
                  </strong>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)', margin: 0, lineHeight: 1.4 }}>
                  Schedule a 1-on-1 video / phone consultation with our technical onboarding specialists.
                </p>
              </div>

              <button
                type="button"
                onClick={() => openUrl('https://calendly.com/henuos/30min')}
                style={{
                  background: 'rgba(124, 58, 237, 0.12)',
                  border: '1px solid rgba(124, 58, 237, 0.35)',
                  color: 'var(--accent, #7c3aed)',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                Open Calendly Booking (calendly.com/henuos/30min)
                <ExternalLink size={12} />
              </button>
            </div>

            {/* Official Emails Card */}
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background: 'var(--surface-2, #f8fafc)',
                border: '1px solid var(--border, #e2e8f0)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 6,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Headphones size={15} style={{ color: 'var(--info, #3b82f6)' }} />
                  <strong style={{ fontSize: 12, color: 'var(--text-primary, #0f172a)' }}>
                    Official Communication Desk
                  </strong>
                </div>
                <div style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary, #64748b)' }}>Email 1:</span>
                    <a
                      href="mailto:support.henuos@gmail.com"
                      onClick={e => {
                        e.preventDefault();
                        openUrl('mailto:support.henuos@gmail.com');
                      }}
                      style={{ color: 'var(--info, #3b82f6)', textDecoration: 'none', fontWeight: 600 }}
                    >
                      support.henuos@gmail.com
                    </a>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary, #64748b)' }}>Email 2:</span>
                    <a
                      href="mailto:info@henuos.in"
                      onClick={e => {
                        e.preventDefault();
                        openUrl('mailto:info@henuos.in');
                      }}
                      style={{ color: 'var(--info, #3b82f6)', textDecoration: 'none', fontWeight: 600 }}
                    >
                      info@henuos.in
                    </a>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 10, color: 'var(--text-secondary, #64748b)', textAlign: 'right' }}>
                WhatsApp: +91 81550 77057
              </div>
            </div>
          </div>
        </div>

        {/* Footer Brand Banner */}
        <div
          style={{
            padding: '12px 22px',
            borderTop: '1px solid var(--border, #e2e8f0)',
            background: 'var(--surface-2, #f8fafc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src="images/henu.png"
              alt="HENU OS Logo"
              style={{ height: 34, objectFit: 'contain' }}
              onError={e => {
                (e.currentTarget as HTMLImageElement).src = 'henu.png';
              }}
            />
            <img
              src="images/HENU-word.png"
              alt="HENU OS Wordmark"
              style={{ height: 24, objectFit: 'contain' }}
              onError={e => {
                (e.currentTarget as HTMLImageElement).src = 'HENU-word.png';
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted, #94a3b8)' }}>
              • Certified Statutory Co-Operative Records Platform
            </span>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={onClose}
            style={{ fontSize: 11, padding: '5px 12px', fontWeight: 600 }}
          >
            Done / Close
          </button>
        </div>
      </div>
    </div>
  );
}
