import React from 'react';
import { VoucherRecord, SocietyMaster } from '../../../main/types';

interface VoucherSheetProps {
  voucher: VoucherRecord;
  society: SocietyMaster | null;
  templateId?: 'TEMPLATE_1' | 'TEMPLATE_2' | string;
  paperSize?: 'LEGAL' | 'A4' | string;
  logoBase64?: string;
}

function splitRupeesPaise(valStr: string | undefined): { rs: string; ps: string } {
  if (!valStr) return { rs: '', ps: '' };
  const clean = valStr.replace(/[^0-9.-]/g, '').trim();
  if (!clean) return { rs: '', ps: '' };
  const num = parseFloat(clean);
  if (isNaN(num)) return { rs: valStr, ps: '' };
  const parts = Math.abs(num).toFixed(2).split('.');
  const intPart = parts[0];
  const psPart = parts[1] === '00' ? '00' : parts[1];
  const lastThree = intPart.substring(intPart.length - 3);
  const otherNumbers = intPart.substring(0, intPart.length - 3);
  const formatted = otherNumbers !== ''
    ? otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
    : lastThree;
  const prefix = num < 0 ? '-' : '';
  return { rs: `${prefix}${formatted}`, ps: psPart };
}

export const SingleVoucherCard: React.FC<{
  voucher: VoucherRecord;
  society: SocietyMaster | null;
  templateId?: 'TEMPLATE_1' | 'TEMPLATE_2' | string;
  logoBase64?: string;
}> = ({ voucher, society, logoBase64 }) => {
  const socName = voucher.societyName || society?.societyName || 'Aishwarya Heights Co-op. Housing Society Ltd.';
  const socNo = voucher.socNumber || society?.registrationNo || 'M.U.M./S.R.A./H.S.G./(T.C.)/13372/YEAR-2023';
  const regDate = society?.registrationDate || '02.01.2023';
  const socAddress = voucher.societyAddress || society?.address || 'CTS No. 1020 (Part), Mithagar Road, Near L.I.C. Colony, Mulund (East), Mumbai - 400 081.';

  const activeLogo = logoBase64 || society?.logoBase64;

  const finRows = [
    { label: 'Bill Amount', percent: '', val: voucher.billAmount, bold: false },
    { label: 'Bill Amount', percent: '', val: voucher.billAmount2 || '', bold: false },
    { label: 'Adv. Less or Paid', percent: '', val: voucher.advLessPaid, bold: false },
    { label: 'Total', percent: '', val: voucher.subTotal1, bold: true },
    { label: 'Less TDS @', percent: voucher.tdsPercent ? `${voucher.tdsPercent}%` : '  %', val: voucher.tdsAmount, bold: false },
    { label: 'Total', percent: '', val: voucher.subTotal2, bold: true },
    { label: 'Add CGST @', percent: voucher.cgstPercent ? `${voucher.cgstPercent}%` : '  %', val: voucher.cgstAmount, bold: false },
    { label: 'Add SGST @', percent: voucher.sgstPercent ? `${voucher.sgstPercent}%` : '  %', val: voucher.sgstAmount, bold: false },
    { label: 'Round off (+/-)', percent: '', val: voucher.roundOff, bold: false },
    { label: 'Net Paid =', percent: '', val: voucher.netPaid, bold: true, highlight: true },
  ];

  return (
    <div style={{
      width: '100%',
      height: '350px',
      boxSizing: 'border-box',
      padding: '10px 14px 10px 24px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#000',
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'relative',
    }}>
      {/* 1. Header with Society details and Voucher No / Date */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, paddingRight: 10, display: 'flex', gap: '8px', alignItems: 'center' }}>
            {activeLogo && (
              <img
                src={activeLogo}
                alt="Logo"
                style={{ width: '32px', height: '32px', objectFit: 'contain', flexShrink: 0 }}
              />
            )}
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, fontStyle: 'italic', fontFamily: 'Georgia, Cambria, "Times New Roman", serif', lineHeight: 1.15 }}>
                {socName}
              </div>
              <div style={{ fontSize: '8.5px', fontWeight: 700, marginTop: '2px' }}>
                Reg. No. : {socNo} Dated {regDate}
              </div>
              <div style={{ fontSize: '8px', fontWeight: 500, marginTop: '1px', color: '#111' }}>
                {socAddress}
              </div>
            </div>
          </div>

          <div style={{ width: '145px', textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              border: '1.2px solid #000',
              padding: '3px 8px',
              fontSize: '9.5px',
              fontWeight: 700,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px'
            }}>
              <span>Voucher No.</span>
              <span style={{ fontSize: '10px', fontWeight: 700 }}>{voucher.voucherNo || ''}</span>
            </div>
            <div style={{ fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
              <span>Date :</span>
              <span style={{ borderBottom: '3px double #000', minWidth: '95px', textAlign: 'center', display: 'inline-block', letterSpacing: '1px' }}>
                {voucher.voucherDate || '      /      /            '}
              </span>
            </div>
          </div>
        </div>

        {/* Continuous Horizontal Rule directly below Address Line */}
        <div style={{ borderBottom: '1px solid #000', marginTop: '6px', width: '100%' }} />
      </div>

      {/* 2. PAY To / CHARGE To Container with continuous border-right & double border */}
      <div style={{
        borderTop: '1px solid #000',
        borderBottom: '3px double #000',
        padding: '3px 0',
        marginTop: '2px'
      }}>
        <div style={{ display: 'flex', fontSize: '9.5px', fontWeight: 700 }}>
          {/* Left Column: PAY To */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px', paddingRight: '6px', borderRight: '1px solid #000' }}>
            <span style={{ whiteSpace: 'nowrap' }}>PAY To,</span>
            <span style={{ borderBottom: '1px solid #000', flex: 1, paddingLeft: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {voucher.toPayee || ''}
            </span>
          </div>
          {/* Right Column: CHARGE To */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: '6px' }}>
            <span style={{ whiteSpace: 'nowrap' }}>CHARGE To,</span>
            <span style={{ borderBottom: '1px solid #000', flex: 1, paddingLeft: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {voucher.chargeTo || ''}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Main Data Table with Dedicated "%" Column */}
      <div style={{
        border: '1.2px solid #000',
        flex: 1,
        margin: '2px 0',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* Table Header */}
        <div style={{
          display: 'flex',
          borderBottom: '1.2px solid #000',
          fontSize: '9.5px',
          fontWeight: 800,
          textAlign: 'center',
          background: '#fff'
        }}>
          <div style={{ flex: 1, borderRight: '1.2px solid #000', padding: '2px 0', letterSpacing: '0.35em' }}>P a r t i c u l a r s</div>
          <div style={{ width: '104px', borderRight: '1px solid #000' }} />
          <div style={{ width: '22px', borderRight: '1px solid #000', padding: '2px 0', fontSize: '8px' }}>%</div>
          <div style={{ width: '58px', borderRight: '1px solid #000', padding: '2px 0' }}>₹</div>
          <div style={{ width: '34px', padding: '2px 0' }}>Ps.</div>
        </div>

        {/* Table Body */}
        <div style={{ flex: 1, display: 'flex' }}>
          {/* Particulars Left Column with 3 Matched Ruled Lines */}
          <div style={{ flex: 1, borderRight: '1.2px solid #000', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Top 3 lines matching row height */}
            <div style={{ height: '17px', borderBottom: '0.6px solid #000', padding: '0 6px', fontSize: '8.5px', display: 'flex', alignItems: 'center' }}>
              {voucher.particulars ? voucher.particulars.substring(0, 45) : ''}
            </div>
            <div style={{ height: '17px', borderBottom: '0.6px solid #000', padding: '0 6px', fontSize: '8.5px', display: 'flex', alignItems: 'center' }}>
              {voucher.particulars && voucher.particulars.length > 45 ? voucher.particulars.substring(45, 90) : ''}
            </div>
            <div style={{ height: '17px', borderBottom: '0.6px solid #000', padding: '0 6px', fontSize: '8.5px', display: 'flex', alignItems: 'center' }}>
              {voucher.particulars && voucher.particulars.length > 90 ? voucher.particulars.substring(90, 135) : ''}
            </div>

            {/* Middle open space */}
            <div style={{ flex: 1 }} />

            {/* Bottom Particulars info & Cheque Details */}
            <div style={{ fontSize: '8.5px', padding: '0 6px 2px 6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                <span style={{ fontWeight: 700 }}>Bill No.:</span>
                <span>{voucher.billNo || ''}</span>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <span style={{ fontWeight: 700 }}>Bank Name :</span>
                <span style={{ fontWeight: 600 }}>{voucher.bankName || ''}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '4px', flex: 1.2 }}>
                  <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Cheque No.</span>
                  <span style={{ borderBottom: '1px solid #000', flex: 1 }}>{voucher.chequeNo || ''}</span>
                </div>
                <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                  <span style={{ fontWeight: 700 }}>Date</span>
                  <span style={{ borderBottom: '1px solid #000', flex: 1, textAlign: 'center' }}>{voucher.voucherDate || ''}</span>
                </div>
              </div>
            </div>

            {/* Full-width horizontal rule separating cheque details from bottom Amount line */}
            <div style={{ borderBottom: '1px solid #000', width: '100%' }} />

            {/* Bottom Amount Line with continuous underline */}
            <div style={{ padding: '3px 6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 800, fontSize: '13px' }}>₹.</span>
              <span style={{ borderBottom: '1px solid #000', flex: 1, fontWeight: 700, fontSize: '11px', paddingLeft: '4px' }}>
                {voucher.netPaid ? `${splitRupeesPaise(voucher.netPaid).rs}/-` : ''}
              </span>
            </div>
          </div>

          {/* Financial Breakdown Rows Right Column */}
          <div style={{ width: '218px', display: 'flex', flexDirection: 'column' }}>
            {finRows.map((fr, idx) => {
              const { rs, ps } = splitRupeesPaise(fr.val);
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flex: 1,
                    alignItems: 'center',
                    borderBottom: idx < finRows.length - 1 ? (fr.bold ? '1px solid #000' : '0.6px solid #000') : 'none',
                    fontSize: '8px',
                    lineHeight: 1
                  }}
                >
                  {/* Description */}
                  <div style={{
                    width: '104px',
                    padding: '0 4px',
                    fontWeight: fr.bold ? 700 : 400,
                    color: '#000',
                    borderRight: '1px solid #000',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: fr.highlight || fr.label === 'Total' ? 'flex-end' : 'flex-start',
                  }}>
                    {fr.label}
                  </div>
                  {/* Dedicated % Column */}
                  <div style={{
                    width: '22px',
                    borderRight: '1px solid #000',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '7.5px',
                    color: '#000'
                  }}>
                    {fr.percent}
                  </div>
                  {/* Rupees Column */}
                  <div style={{
                    width: '58px',
                    borderRight: '1px solid #000',
                    padding: '0 3px',
                    textAlign: 'right',
                    fontWeight: fr.bold ? 700 : 400,
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end'
                  }}>
                    {rs}
                  </div>
                  {/* Paise Column */}
                  <div style={{
                    width: '34px',
                    textAlign: 'center',
                    fontWeight: fr.bold ? 700 : 400,
                    fontSize: '7.5px'
                  }}>
                    {ps}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Signatures Footer with Centered Stamp Box */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '9px', fontWeight: 700, marginTop: '4px' }}>
        <div>Chairman</div>
        <div>Secretary</div>
        <div>Treasurer</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ border: '1px solid #000', width: '38px', height: '20px', marginBottom: '2px' }} />
          <div>Receiver's Signature</div>
        </div>
      </div>
    </div>
  );
};

export default function VoucherSheet({ voucher, society, templateId, paperSize = 'LEGAL', logoBase64 }: VoucherSheetProps) {
  const isA4 = String(paperSize).toUpperCase() === 'A4';
  return (
    <div style={{
      width: '100%',
      maxWidth: isA4 ? '595px' : '612px',
      margin: '0 auto',
      background: '#fff',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      display: 'flex',
      flexDirection: 'column',
      gap: isA4 ? '16px' : '8px',
      padding: '16px',
      boxSizing: 'border-box'
    }}>
      <SingleVoucherCard voucher={voucher} society={society} templateId={templateId} logoBase64={logoBase64} />
      <div style={{ borderBottom: '1px dashed #999', margin: '2px 0' }} />
      <SingleVoucherCard voucher={voucher} society={society} templateId={templateId} logoBase64={logoBase64} />
      {!isA4 && (
        <>
          <div style={{ borderBottom: '1px dashed #999', margin: '2px 0' }} />
          <SingleVoucherCard voucher={voucher} society={society} templateId={templateId} logoBase64={logoBase64} />
        </>
      )}
    </div>
  );
}


