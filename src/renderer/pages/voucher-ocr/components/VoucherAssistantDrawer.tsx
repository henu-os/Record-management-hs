/**
 * HENU VOUCHER OCR — OFFLINE VOUCHER Q&A ASSISTANT DRAWER
 * 100% offline, deterministic, zero-hallucination factual accounting Q&A.
 */

import React, { useState } from 'react';
import { Bot, Send, X, ShieldCheck, Sparkles, AlertCircle, HelpCircle } from 'lucide-react';
import { VoucherProcessingRecord } from '../../../../modules/henu-voucher-ocr/schema/types';

interface VoucherAssistantDrawerProps {
  activeRecord: VoucherProcessingRecord | null;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export const VoucherAssistantDrawer: React.FC<VoucherAssistantDrawerProps> = ({
  activeRecord,
  onClose,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      sender: 'assistant',
      text: activeRecord
        ? `Hello! I have loaded context for Voucher "${activeRecord.fields.voucher_no?.normalizedValue || 'Unnamed'}". Ask me about payee, amount, taxes, cheque details, or validation issues.`
        : 'Hello! I am the HENU Voucher Offline Assistant. Please select or open a voucher to ask accounting questions.',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [input, setInput] = useState('');

  const answerQuery = (query: string): string => {
    if (!activeRecord) {
      return 'No voucher is currently active. Please select a voucher from your inbox or review screen.';
    }

    const q = query.toLowerCase();
    const f = activeRecord.fields;

    // Amount / Net Paid queries
    if (q.includes('amount') || q.includes('net') || q.includes('total') || q.includes('paid') || q.includes('rupees') || q.includes('price')) {
      if (f.net_paid?.normalizedValue !== null && f.net_paid?.normalizedValue !== undefined) {
        return `The final Net Paid amount is ₹${Number(f.net_paid.normalizedValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}. (Total 1: ₹${f.total_1?.normalizedValue ?? '—'}, Total 2: ₹${f.total_2?.normalizedValue ?? '—'}).`;
      }
      return "I couldn't reliably determine the net amount from this voucher.";
    }

    // Payee / Vendor queries
    if (q.includes('payee') || q.includes('pay to') || q.includes('vendor') || q.includes('who') || q.includes('party')) {
      if (f.pay_to?.normalizedValue) {
        return `The Payee is "${f.pay_to.normalizedValue}". (Confidence: ${f.pay_to.confidence}%).`;
      }
      return "I couldn't reliably determine the payee name from this voucher.";
    }

    // Ledger / Debit / Charge To
    if (q.includes('charge') || q.includes('debit') || q.includes('head') || q.includes('account') || q.includes('category')) {
      if (f.charge_to?.normalizedValue) {
        return `The Debit Account / Charge To head is "${f.charge_to.normalizedValue}".`;
      }
      return "I couldn't reliably determine the debit account head from this voucher.";
    }

    // Voucher Number
    if (q.includes('voucher no') || q.includes('number') || q.includes('vch')) {
      if (f.voucher_no?.normalizedValue) {
        return `The Voucher Number is "${f.voucher_no.normalizedValue}".`;
      }
      return "I couldn't reliably determine the voucher number from this voucher.";
    }

    // Date queries
    if (q.includes('date') || q.includes('when')) {
      if (f.voucher_date?.normalizedValue) {
        return `The Voucher Date is ${f.voucher_date.normalizedValue}.`;
      }
      return "I couldn't reliably determine the voucher date from this voucher.";
    }

    // Taxes / TDS / GST queries
    if (q.includes('tds') || q.includes('tax') || q.includes('gst') || q.includes('cgst') || q.includes('sgst')) {
      const parts = [];
      if (f.tds_percentage?.normalizedValue || f.tds_amount?.normalizedValue) {
        parts.push(`TDS @ ${f.tds_percentage?.normalizedValue ?? 0}% = ₹${f.tds_amount?.normalizedValue ?? 0}`);
      }
      if (f.cgst_percentage?.normalizedValue || f.cgst_amount?.normalizedValue) {
        parts.push(`CGST @ ${f.cgst_percentage?.normalizedValue ?? 0}% = ₹${f.cgst_amount?.normalizedValue ?? 0}`);
      }
      if (f.sgst_percentage?.normalizedValue || f.sgst_amount?.normalizedValue) {
        parts.push(`SGST @ ${f.sgst_percentage?.normalizedValue ?? 0}% = ₹${f.sgst_amount?.normalizedValue ?? 0}`);
      }
      return parts.length > 0 ? parts.join(', ') : 'No TDS or GST tax deductions were detected on this voucher.';
    }

    // Cheque / Bank queries
    if (q.includes('cheque') || q.includes('bank') || q.includes('chq') || q.includes('utr') || q.includes('payment mode')) {
      if (f.bank_name?.normalizedValue || f.cheque_no?.normalizedValue) {
        return `Payment cleared through Bank: "${f.bank_name?.normalizedValue || 'Not detected'}" via Cheque/UTR No: "${f.cheque_no?.normalizedValue || 'Not detected'}".`;
      }
      return "No bank name or cheque number was detected on this voucher.";
    }

    // Validation queries
    if (q.includes('validation') || q.includes('issue') || q.includes('error') || q.includes('warning') || q.includes('valid')) {
      if (activeRecord.validationIssues && activeRecord.validationIssues.length > 0) {
        return `There are ${activeRecord.validationIssues.length} validation issues:\n` +
          activeRecord.validationIssues.map(i => `• [${i.severity.toUpperCase()}] ${i.fieldKey}: ${i.message}`).join('\n');
      }
      return "✓ No validation issues found. All mathematical rules (Subtotals, TDS, GST, Net Paid) match with 100% accuracy.";
    }

    // Particulars / Narration
    if (q.includes('narration') || q.includes('particular') || q.includes('for what') || q.includes('details')) {
      if (f.particulars?.normalizedValue) {
        return `Transaction Particulars: "${f.particulars.normalizedValue}".`;
      }
      return "I couldn't reliably determine the transaction particulars from this voucher.";
    }

    return "I couldn't reliably determine that specific field from the voucher. Please ask about the voucher amount, payee, date, debit head, taxes, cheque, or validation status.";
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: input.trim(),
      timestamp: new Date().toLocaleTimeString(),
    };

    const replyText = answerQuery(input.trim());

    const botMsg: ChatMessage = {
      id: `b-${Date.now()}`,
      sender: 'assistant',
      text: replyText,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages(prev => [...prev, userMsg, botMsg]);
    setInput('');
  };

  return (
    <div style={{
      width: 360,
      background: 'var(--surface)',
      borderLeft: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      boxShadow: 'var(--shadow-md)',
    }}>
      {/* Drawer Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--surface-2)',
      }}>
        <div className="flex items-center gap-8">
          <Bot size={18} className="text-accent" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Voucher Assistant</div>
            <div style={{ fontSize: 10, color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheck size={10} /> 100% Offline / Rule-Based
            </div>
          </div>
        </div>
        <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '2px 6px' }}>
          <X size={14} />
        </button>
      </div>

      {/* Messages List */}
      <div style={{ flex: 1, padding: 14, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map(m => {
          const isUser = m.sender === 'user';
          return (
            <div
              key={m.id}
              style={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: isUser ? 'var(--accent)' : 'var(--surface-2)',
                color: isUser ? '#ffffff' : 'var(--text-primary)',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                lineHeight: 1.4,
                whiteSpace: 'pre-wrap',
                border: isUser ? 'none' : '1px solid var(--border)',
              }}
            >
              {m.text}
              <div style={{
                fontSize: 9,
                opacity: 0.7,
                marginTop: 4,
                textAlign: isUser ? 'right' : 'left',
              }}>
                {m.timestamp}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Question Chips */}
      {activeRecord && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['Amount?', 'Payee?', 'Validation issue?', 'TDS & GST?'].map(q => (
            <button
              key={q}
              onClick={() => {
                const userMsg: ChatMessage = { id: `u-${Date.now()}`, sender: 'user', text: q, timestamp: new Date().toLocaleTimeString() };
                const botMsg: ChatMessage = { id: `b-${Date.now()}`, sender: 'assistant', text: answerQuery(q), timestamp: new Date().toLocaleTimeString() };
                setMessages(prev => [...prev, userMsg, botMsg]);
              }}
              style={{
                fontSize: 10,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                borderRadius: 12,
                padding: '2px 8px',
                cursor: 'pointer',
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input Box */}
      <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <input
          type="text"
          className="input-control"
          placeholder="Ask a question about this voucher..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
          style={{ fontSize: 12, height: 32 }}
        />
        <button className="btn btn-primary" onClick={handleSend} style={{ padding: '0 10px', height: 32 }}>
          <Send size={13} />
        </button>
      </div>
    </div>
  );
};
