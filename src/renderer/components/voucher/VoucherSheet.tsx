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

function splitTwoLinesByCharCount(text: string | undefined, line1MaxChars: number): { line1: string; line2: string } {
  if (!text) return { line1: '', line2: '' };
  const str = text.trim();
  if (str.length <= line1MaxChars) return { line1: str, line2: '' };

  const words = str.split(/\s+/);
  let l1 = '';
  let wordIdx = 0;
  for (; wordIdx < words.length; wordIdx++) {
    const test = l1 ? `${l1} ${words[wordIdx]}` : words[wordIdx];
    if (test.length <= line1MaxChars) {
      l1 = test;
    } else {
      break;
    }
  }
  if (!l1 && words.length > 0) {
    l1 = str.substring(0, line1MaxChars);
    return { line1: l1, line2: str.substring(line1MaxChars).trim() };
  }
  return { line1: l1, line2: words.slice(wordIdx).join(' ').trim() };
}

export const SingleVoucherCard: React.FC<{
  voucher: VoucherRecord;
  society: SocietyMaster | null;
  templateId?: 'TEMPLATE_1' | 'TEMPLATE_2' | string;
  logoBase64?: string;
}> = ({ voucher, society, templateId, logoBase64 }) => {
  const isTemplate2 = templateId === 'TEMPLATE_2';
  const socName = voucher.societyName || society?.societyName || (isTemplate2 ? 'SAI RACHNA CO-OP. HOUSING SOCIETY LTD.' : 'Aishwarya Heights Co-op. Housing Society Ltd.');
  const socNo = voucher.socNumber || society?.registrationNo || '';
  const regDate = society?.registrationDate || '';
  const socAddress = voucher.societyAddress || society?.address || '';

  const activeLogo = logoBase64 || society?.logoBase64;

  const paySplit = splitTwoLinesByCharCount(voucher.toPayee, 38);
  const chgSplit = splitTwoLinesByCharCount(voucher.chargeTo, 26);

  const finRows = [
    { label: 'Bill Amount', percent: '', val: voucher.billAmount, bold: false },
    { label: 'Bill Amount', percent: '', val: voucher.billAmount2 || '', bold: false },
    { label: 'Adv. Less or Paid', percent: '', val: voucher.advLessPaid, bold: false },
    { label: 'Total', percent: '', val: voucher.subTotal1, bold: true },
    { label: 'Less TDS @', percent: voucher.tdsPercent ? `${voucher.tdsPercent} %` : '    %', val: voucher.tdsAmount, bold: false },
    { label: 'Total', percent: '', val: voucher.subTotal2, bold: true },
    { label: 'Add CGST @', percent: voucher.cgstPercent ? `${voucher.cgstPercent} %` : '    %', val: voucher.cgstAmount, bold: false },
    { label: 'Add SGST @', percent: voucher.sgstPercent ? `${voucher.sgstPercent} %` : '    %', val: voucher.sgstAmount, bold: false },
    { label: 'Round off (+/-)', percent: '', val: voucher.roundOff, bold: false },
    { label: 'Net Paid =', percent: '', val: voucher.netPaid, bold: true, highlight: true },
  ];

  const totalAmount = voucher.netPaid || voucher.billAmount || '';
  const { rs: t2Rs, ps: t2Ps } = splitRupeesPaise(totalAmount);

  return (
    <div style={{
      width: '100%',
      height: '356px',
      boxSizing: 'border-box',
      border: 'none',
      padding: '6px 4px',
      fontFamily: isTemplate2 ? 'Arial, Helvetica, sans-serif' : '"Times New Roman", Times, serif',
      color: '#000000',
      background: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'relative',
    }}>
      {/* ─── 1. Header Section ─── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {/* Society Details (Left: Line 1 left-aligned, Lines 2-3 centered under title) */}
          <div style={{
            flex: 1,
            paddingRight: '16px',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <h1 style={{
              margin: '0 0 2px 0',
              fontFamily: isTemplate2 ? 'Arial, Helvetica, sans-serif' : '"Times New Roman", Times, serif',
              fontStyle: isTemplate2 ? 'normal' : 'italic',
              fontWeight: isTemplate2 ? 900 : 'bold',
              fontSize: isTemplate2 ? '15.5px' : '16px',
              letterSpacing: isTemplate2 ? '0.6px' : '0.2px',
              textTransform: isTemplate2 ? 'uppercase' : 'none',
              lineHeight: 1.15,
              textAlign: isTemplate2 ? 'center' : 'left',
            }}>
              {socName}
            </h1>
            <div style={{
              fontSize: '9px',
              fontWeight: 'bold',
              lineHeight: '1.3',
              textAlign: 'center',
            }}>
              {isTemplate2
                ? (socNo ? `Reg. No. MUM / SRA / HSG / (TC) / ${socNo}${regDate ? ' Dated-' + regDate : ''}` : 'Reg. No. MUM / SRA / HSG / (TC) / 13334 / Year-2022-23 Dated-05 / 08 / 2022')
                : (socNo ? `Reg. No. : ${socNo}${regDate ? ' Dated ' + regDate : ''}` : 'Reg. No. : M.U.M./S.R.A./H.S.G./(T.C.)/13372/YEAR-2023 Dated 02.01.2023')}
            </div>
            <div style={{
              fontSize: '8px',
              fontWeight: 'bold',
              lineHeight: '1.25',
              color: '#111',
              textAlign: 'center',
            }}>
              {isTemplate2
                ? (socAddress || 'CTS No.747(P) of Village Mulund, Dumping Road, P. D. Road, Opp. Babu Jagjivan Ram Nagar,\nMulund (West), Mumbai – 400 080.')
                : (socAddress || 'CTS No. 1020 (Part), Mithagar Road, Near L.I.C. Colony, Mulund (East), Mumbai - 400 081.')}
            </div>
          </div>

          {/* Voucher No & Date (Right Column) */}
          <div style={{
            width: '155px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            flexShrink: 0
          }}>
            {/* Voucher No Box */}
            <div style={{
              border: '1.5px solid #000000',
              width: '100%',
              height: '26px',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              padding: '0 6px',
              fontSize: '10px',
              fontWeight: 'bold',
              justifyContent: 'space-between',
            }}>
              <span>Voucher No.</span>
              <span style={{ fontWeight: 'normal', fontFamily: 'sans-serif', fontSize: '10.5px' }}>
                {voucher.voucherNo || ''}
              </span>
            </div>

            {/* Date Line with Double Underline */}
            <div style={{
              marginTop: '8px',
              fontSize: '9.5px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'flex-end',
              width: '100%',
              justifyContent: 'space-between',
              paddingBottom: '2px',
            }}>
              <span>Date :</span>
              <span style={{
                display: 'inline-block',
                borderBottom: '1.5px double #000000',
                minWidth: '95px',
                textAlign: 'center',
                fontSize: '9.5px',
                lineHeight: '1.1',
              }}>
                {voucher.voucherDate || '\u00A0\u00A0\u00A0/\u00A0\u00A0\u00A0/\u00A0\u00A0\u00A0'}
              </span>
            </div>
          </div>
        </div>

        {/* Top Separator Line */}
        <div style={{ borderBottom: '1.5px solid #000000', marginTop: '6px' }} />
      </div>

      {/* ─── 2. Pay To / Charge To Section ─── */}
      <div style={{
        display: 'flex',
        borderBottom: '2.5px double #000000',
        padding: '2px 0 4px 0',
      }}>
        {/* Left Column: PAY To (57%) */}
        <div style={{
          flex: '0 0 57%',
          paddingRight: '8px',
          borderRight: '1.5px solid #000000',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '2px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '9.5px', whiteSpace: 'nowrap' }}>PAY To,</span>
            <span style={{
              flex: 1,
              borderBottom: '1px solid #000000',
              marginLeft: '4px',
              paddingLeft: '4px',
              fontSize: '9px',
              fontWeight: 'bold',
              minHeight: '13px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {paySplit.line1}
            </span>
          </div>
          <div style={{
            borderBottom: '1px solid #000000',
            height: '12px',
            marginLeft: '0',
            paddingLeft: '2px',
            fontSize: '9px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'flex',
            alignItems: 'flex-end',
          }}>
            {paySplit.line2}
          </div>
        </div>

        {/* Right Column: CHARGE To (43%) */}
        <div style={{
          flex: '0 0 43%',
          paddingLeft: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '2px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '9.5px', whiteSpace: 'nowrap' }}>CHARGE To,</span>
            <span style={{
              flex: 1,
              borderBottom: '1px solid #000000',
              marginLeft: '4px',
              paddingLeft: '4px',
              fontSize: '9px',
              fontWeight: 'bold',
              minHeight: '13px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {chgSplit.line1}
            </span>
          </div>
          <div style={{
            borderBottom: '1px solid #000000',
            height: '12px',
            marginLeft: '0',
            paddingLeft: '2px',
            fontSize: '9px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'flex',
            alignItems: 'flex-end',
          }}>
            {chgSplit.line2}
          </div>
        </div>
      </div>

      {/* ─── 3. Main Ledger Table ─── */}
      {isTemplate2 ? (
        /* TEMPLATE 2: 3-COLUMN LEDGER TABLE (76.5% | 16% | 7.5%) */
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1.5px solid #000000',
          borderRight: '1.5px solid #000000',
          borderBottom: '2px solid #000000',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}>
          {/* Header Row */}
          <div style={{
            display: 'flex',
            borderBottom: '1.5px solid #000000',
            fontWeight: 'bold',
            textAlign: 'center',
            fontSize: '9.5px',
            alignItems: 'stretch',
          }}>
            <div style={{ flex: '0 0 76.5%', letterSpacing: '4px', borderRight: '1.5px solid #000000', padding: '2px 0' }}>
              Particulars
            </div>
            <div style={{ flex: '0 0 16%', borderRight: '1.5px solid #000000', padding: '2px 0', fontSize: '10px' }}>
              ₹
            </div>
            <div style={{ flex: '0 0 7.5%', borderRight: '1.5px solid #000000', padding: '2px 0' }}>
              Ps.
            </div>
          </div>

          {/* Table Body: 11 Rows */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* 8 Open Entry Rows */}
            {(() => {
              const t2FinValues = [
                voucher.billAmount,
                voucher.billAmount2,
                voucher.advLessPaid,
                voucher.subTotal1,
                voucher.tdsAmount,
                voucher.subTotal2,
                voucher.cgstAmount,
                voucher.sgstAmount,
              ];
              return Array.from({ length: 8 }).map((_, idx) => {
                const val = t2FinValues[idx];
                const { rs: rRs, ps: rPs } = (val && String(val).trim() !== '' && String(val).trim() !== '0')
                  ? splitRupeesPaise(String(val))
                  : { rs: '', ps: '' };
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      flex: 1,
                      borderBottom: '1px solid #000000',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{
                      flex: '0 0 76.5%',
                      height: '100%',
                      borderRight: '1.5px solid #000000',
                      padding: '0 6px',
                      boxSizing: 'border-box',
                      fontSize: '8.5px',
                      display: 'flex',
                      alignItems: 'center',
                    }}>
                      {idx === 0 ? (voucher.particulars ? voucher.particulars.substring(0, 60) : '') :
                       idx === 1 ? (voucher.particulars && voucher.particulars.length > 60 ? voucher.particulars.substring(60, 120) : '') : ''}
                    </div>
                    <div style={{
                      flex: '0 0 16%',
                      height: '100%',
                      borderRight: '1.5px solid #000000',
                      textAlign: 'right',
                      padding: '0 4px',
                      boxSizing: 'border-box',
                      fontSize: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      fontWeight: 'bold',
                    }}>
                      {rRs}
                    </div>
                    <div style={{
                      flex: '0 0 7.5%',
                      height: '100%',
                      borderRight: '1.5px solid #000000',
                      textAlign: 'center',
                      boxSizing: 'border-box',
                      fontSize: '7.5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                    }}>
                      {rPs}
                    </div>
                  </div>
                );
              });
            })()}

            {/* Row 9: Bank Name Row */}
            {(() => {
              const { rs: roRs, ps: roPs } = (voucher.roundOff && String(voucher.roundOff).trim() !== '' && String(voucher.roundOff).trim() !== '0')
                ? splitRupeesPaise(String(voucher.roundOff))
                : { rs: '', ps: '' };
              return (
                <div style={{
                  display: 'flex',
                  flex: 1,
                  borderBottom: '1px solid #000000',
                  alignItems: 'center',
                }}>
                  <div style={{
                    flex: '0 0 76.5%',
                    height: '100%',
                    borderRight: '1.5px solid #000000',
                    padding: '0 6px',
                    boxSizing: 'border-box',
                    fontSize: '8.5px',
                    display: 'flex',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontWeight: 'bold' }}>Bank Name</span>
                    <span style={{ marginLeft: '8px', fontWeight: 'bold' }}>{voucher.bankName || ''}</span>
                  </div>
                  <div style={{
                    flex: '0 0 16%',
                    height: '100%',
                    borderRight: '1.5px solid #000000',
                    textAlign: 'right',
                    padding: '0 4px',
                    boxSizing: 'border-box',
                    fontSize: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    fontWeight: 'bold',
                  }}>
                    {roRs}
                  </div>
                  <div style={{
                    flex: '0 0 7.5%',
                    height: '100%',
                    borderRight: '1.5px solid #000000',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                    fontSize: '7.5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                  }}>
                    {roPs}
                  </div>
                </div>
              );
            })()}

            {/* Row 10: Che. No. / Date Row */}
            <div style={{
              display: 'flex',
              flex: 1,
              borderBottom: '1px solid #000000',
              alignItems: 'center',
            }}>
              <div style={{
                flex: '0 0 76.5%',
                height: '100%',
                borderRight: '1.5px solid #000000',
                padding: '0 6px',
                boxSizing: 'border-box',
                fontSize: '8.5px',
                display: 'flex',
                alignItems: 'center',
              }}>
                <span style={{ fontWeight: 'bold' }}>Che. No.</span>
                <span style={{
                  borderBottom: '1px solid #000000',
                  minWidth: '100px',
                  margin: '0 8px 0 4px',
                  paddingLeft: '4px',
                  fontWeight: 'bold',
                }}>
                  {voucher.chequeNo || ''}
                </span>
                <span style={{ fontWeight: 'bold' }}>Date</span>
                <span style={{
                  borderBottom: '1.5px double #000000',
                  minWidth: '95px',
                  textAlign: 'center',
                  marginLeft: '4px',
                  fontWeight: 'bold',
                }}>
                  {voucher.voucherDate || '\u00A0\u00A0/\u00A0\u00A0/\u00A0\u00A0'}
                </span>
              </div>
              <div style={{
                flex: '0 0 16%',
                height: '100%',
                borderRight: '1.5px solid #000000',
                textAlign: 'right',
                padding: '0 4px',
                boxSizing: 'border-box',
                fontSize: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }} />
              <div style={{
                flex: '0 0 7.5%',
                height: '100%',
                borderRight: '1.5px solid #000000',
                textAlign: 'center',
                boxSizing: 'border-box',
                fontSize: '7.5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }} />
            </div>

            {/* Row 11: ₹. (Total / Final Amount) Row */}
            <div style={{
              display: 'flex',
              flex: 1,
              alignItems: 'center',
            }}>
              <div style={{
                flex: '0 0 76.5%',
                height: '100%',
                borderRight: '1.5px solid #000000',
                padding: '0 6px',
                boxSizing: 'border-box',
                fontSize: '9.5px',
                display: 'flex',
                alignItems: 'center',
              }}>
                <span style={{ fontWeight: 'bold', fontSize: '11px' }}>₹.</span>
                <span style={{ marginLeft: '6px', fontSize: '9px', fontWeight: 'bold' }}>
                  {totalAmount ? `${t2Rs}/-` : ''}
                </span>
              </div>
              <div style={{
                flex: '0 0 16%',
                height: '100%',
                borderRight: '1.5px solid #000000',
                textAlign: 'right',
                padding: '0 4px',
                boxSizing: 'border-box',
                fontWeight: 'bold',
                fontSize: '8.5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}>
                {t2Rs}
              </div>
              <div style={{
                flex: '0 0 7.5%',
                height: '100%',
                borderRight: '1.5px solid #000000',
                textAlign: 'center',
                boxSizing: 'border-box',
                fontWeight: 'bold',
                fontSize: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {t2Ps}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* TEMPLATE 1: 4-COLUMN DETAILED LEDGER TABLE (57% | 20% | 16% | 7%) */
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1.5px solid #000000',
          borderRight: '1.5px solid #000000',
          borderBottom: '2px solid #000000',
          fontFamily: '"Times New Roman", Times, serif',
        }}>
          {/* Table Header */}
          <div style={{
            display: 'flex',
            borderBottom: '1.5px solid #000000',
            fontSize: '9.5px',
            fontWeight: 'bold',
            textAlign: 'center',
            alignItems: 'stretch',
          }}>
            <div style={{ flex: '0 0 57%', borderRight: '1.5px solid #000000', padding: '2px 0', letterSpacing: '4px' }}>
              Particulars
            </div>
            <div style={{ flex: '0 0 20%', borderRight: '1.5px solid #000000' }} />
            <div style={{ flex: '0 0 16%', borderRight: '1.5px solid #000000', padding: '2px 0', fontSize: '10px' }}>
              ₹
            </div>
            <div style={{ flex: '0 0 7%', padding: '2px 0' }}>Ps.</div>
          </div>

          {/* Table Body - 10 Rows */}
          <div style={{ flex: 1, display: 'flex' }}>
            {/* Particulars Left Column (57% Width) */}
            <div style={{ flex: '0 0 57%', borderRight: '1.5px solid #000000', display: 'flex', flexDirection: 'column' }}>
              {/* Rows 0 to 4: Narration */}
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ flex: 1, borderBottom: '1px solid #000000', padding: '0 6px', fontSize: '8.5px', display: 'flex', alignItems: 'center' }}>
                  {i === 0 ? (voucher.particulars ? voucher.particulars.substring(0, 50) : '') :
                   i === 1 ? (voucher.particulars && voucher.particulars.length > 50 ? voucher.particulars.substring(50, 100) : '') :
                   i === 2 ? (voucher.particulars && voucher.particulars.length > 100 ? voucher.particulars.substring(100, 150) : '') : ''}
                </div>
              ))}

              {/* Row 5: Bill No. */}
              <div style={{ flex: 1, borderBottom: '1px solid #000000', padding: '0 6px', fontSize: '8.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontWeight: 'bold' }}>Bill No.:</span>
                <span style={{ fontWeight: 'bold' }}>{voucher.billNo || ''}</span>
              </div>

              {/* Row 6: Bank Name : */}
              <div style={{ flex: 1, borderBottom: '1px solid #000000', padding: '0 6px', fontSize: '8.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 'bold' }}>Bank Name :</span>
                <span style={{ fontWeight: 'bold' }}>{voucher.bankName || ''}</span>
              </div>

              {/* Row 7: Cheque No. + Date */}
              <div style={{ flex: 1, borderBottom: '1px solid #000000', padding: '0 6px', fontSize: '8.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Cheque No.</span>
                <span style={{ borderBottom: '1px solid #000000', flex: 1, fontWeight: 'bold', paddingLeft: '4px' }}>
                  {voucher.chequeNo || ''}
                </span>
                <span style={{ fontWeight: 'bold' }}>Date</span>
                <span style={{ borderBottom: '1.5px double #000000', minWidth: '70px', textAlign: 'center', fontWeight: 'bold' }}>
                  {voucher.voucherDate || ''}
                </span>
              </div>

              {/* Row 8: Rupee Line */}
              <div style={{ flex: 1, borderBottom: '1px solid #000000', padding: '0 6px', fontSize: '8.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '11px' }}>₹.</span>
                <span style={{ borderBottom: '1px solid #000000', flex: 1, fontWeight: 'bold', fontSize: '9px', paddingLeft: '4px' }}>
                  {voucher.netPaid ? `${splitRupeesPaise(voucher.netPaid).rs}/-` : (totalAmount ? `${splitRupeesPaise(totalAmount).rs}/-` : '')}
                </span>
              </div>

              {/* Row 9: Open Space */}
              <div style={{ flex: 1, padding: '0 6px' }} />
            </div>

            {/* Financial Breakdown Rows (43% Total Width: 20% Desc + 16% Rs + 7% Ps) */}
            <div style={{ flex: '0 0 43%', display: 'flex', flexDirection: 'column' }}>
              {finRows.map((fr, idx) => {
                const { rs, ps } = splitRupeesPaise(fr.val);
                const isTdsRow = fr.label.includes('TDS');
                const isCgstRow = fr.label.includes('CGST');
                const isSgstRow = fr.label.includes('SGST');
                const hasPercent = isTdsRow || isCgstRow || isSgstRow;

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      flex: 1,
                      alignItems: 'center',
                      borderBottom: idx < finRows.length - 1 ? '1px solid #000000' : 'none',
                      fontSize: '8px',
                      lineHeight: 1
                    }}
                  >
                    {/* Description Column (20/43 = 46.5%) */}
                    <div style={{
                      flex: '0 0 46.5%',
                      padding: '0 5px',
                      fontWeight: fr.bold ? 'bold' : 'normal',
                      color: '#000',
                      borderRight: '1.5px solid #000000',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: hasPercent ? 'space-between' : (fr.highlight || fr.label === 'Total' ? 'flex-end' : 'flex-start'),
                      fontSize: '8px',
                    }}>
                      <span>{fr.label}</span>
                      {hasPercent && (
                        <span>{fr.percent}</span>
                      )}
                    </div>
                    {/* Rupees Column (16/43 = 37.2%) */}
                    <div style={{
                      flex: '0 0 37.2%',
                      borderRight: '1.5px solid #000000',
                      padding: '0 4px',
                      textAlign: 'right',
                      fontWeight: fr.bold ? 'bold' : 'normal',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      fontSize: '8px',
                    }}>
                      {rs}
                    </div>
                    {/* Paise Column (7/43 = 16.3%) */}
                    <div style={{
                      flex: '0 0 16.3%',
                      textAlign: 'center',
                      fontWeight: fr.bold ? 'bold' : 'normal',
                      fontSize: '7.5px',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {ps}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── 4. Signatures & Revenue Stamp Section ─── */}
      <div style={{
        marginTop: '6px',
        position: 'relative',
        fontFamily: isTemplate2 ? 'Arial, Helvetica, sans-serif' : '"Times New Roman", Times, serif',
      }}>
        {/* Revenue Stamp Box */}
        <div style={{
          position: 'absolute',
          right: '12px',
          bottom: '16px',
          width: '42px',
          height: '24px',
          border: '1.2px solid #000000',
        }} />

        {/* Signature Labels */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          fontWeight: 'bold',
          fontSize: isTemplate2 ? '9.5px' : '9px',
          paddingTop: '36px',
        }}>
          <div style={{ width: '18%', textAlign: 'left' }}>Chairman</div>
          <div style={{ width: '18%', textAlign: 'center' }}>Secretary</div>
          <div style={{ width: '18%', textAlign: 'center' }}>Treasurer</div>
          <div style={{ width: '26%', textAlign: 'right' }}>Receiver's Signature</div>
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


