import React from 'react';
import ReactDOM from 'react-dom/client';
import { ShareCertificateSheet } from './components/share_cert/ShareCertificateSheet';
import './index.css';

const sampleData = {
  serialNo: '172',
  certificateNo: '172',
  memberRegisterNo: '172',
  noOfShares: '10(TEN)',
  wingNo: 'B',
  flatNo: '0901',
  societyName: 'POLARIS CO-OPERATIVE HOUSING SOCIETY LIMITED.',
  societyAddress: 'CTS No. 548, A To G, Nahur Village, L.B.S. Marg, Mulund (West), Mumbai - 400080.',
  holderName: 'SRIHARI SARUNGAN',
  owner1: 'SRIHARI SARUNGAN',
  owner2: '',
  owner3: '',
  shareFrom: '1711',
  shareTo: '1720',
  sharesInWords: 'TEN (10)',
  authorisedCapital: '300000',
  totalShares: '6000',
  faceValue: '50',
  stampValue: '500',
  regdNo: 'MUM/WT/HS/GC/T/1489/YEAR 2024 DT. 10/04/2024',
  sealDay: '29th',
  sealMonthYear: 'September 2024'
};

ReactDOM.createRoot(document.getElementById('preview-root')!).render(
  <React.StrictMode>
    <div style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>
      <ShareCertificateSheet templateId="HENU_OS_3" data={sampleData} view="front" />
    </div>
  </React.StrictMode>
);
