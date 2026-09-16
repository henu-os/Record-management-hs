// ============================================================
// HENU OS — Share Certificate Excel / Master Mapping Service
// Normalizes Master Workbook data to ShareCertificateFieldData
// ============================================================

import { MasterWorkbook, NormalizedMemberRecord, SocietyMaster } from '../../../types';
import { formatSharesWithWords } from '../../utils/NumberToWords';
import { ShareCertificateFieldData } from './certificateFields';

export class ShareCertificateExcelMapping {
  /**
   * Normalizes member and society records to a strictly typed ShareCertificateFieldData
   */
  static mapToCertificateData(
    rec: NormalizedMemberRecord | null,
    society: SocietyMaster | null,
    serial: string
  ): ShareCertificateFieldData {
    const isBlank = !rec || (!rec.srNo && !rec.member1 && !rec.memberName);

    const sNo = isBlank ? '' : (rec?.srNo || serial);
    const certNo = isBlank ? '' : (rec?.shareCertificateNo || serial);
    const regNo = isBlank ? '' : (rec?.membershipNo || serial);
    const shares = isBlank ? '' : (rec?.noOfShares || '10');
    const flat = isBlank ? '' : (rec?.flatNo ? (rec?.wingNo ? `${rec.wingNo}/${rec.flatNo}` : rec.flatNo) : '');

    const socName = (society?.societyName || 'CO-OPERATIVE HOUSING SOCIETY LTD.').toUpperCase();
    const socAddr = (society?.headerAddress || society?.address || 'MUMBAI').toUpperCase();
    const regActNo = society?.registrationNo || 'BOM/HSG/0000';
    const regDate = society?.registrationDate || '01.01.2000';

    const authCap = society?.authorisedCapital || '1,00,000/-';
    const totalShares = society?.totalAuthorisedShares || '2000';
    const faceVal = society?.faceValue || '50';

    // Member names
    const m1 = isBlank ? '' : (rec?.member1 || rec?.memberName || '');
    const m2 = isBlank ? '' : (rec?.member2 || '');
    const m3 = isBlank ? '' : (rec?.member3 || '');

    const primaryName = [m1, m2, m3].filter(Boolean).join(', ');

    const fromNum = isBlank ? '001' : (rec?.sharesFrom || '001');
    const toNum = isBlank ? '010' : (rec?.sharesTo || '010');
    const valShares = isBlank ? '500/-' : (rec?.valueOfShares ? `${rec.valueOfShares}/-` : '500/-');

    return {
      serialNo: sNo,
      shareCertificateNo: certNo,
      memberRegisterNo: regNo,
      noOfShares: shares,
      sharesInWords: shares ? formatSharesWithWords(shares) : '',
      flatNo: flat,
      wingNo: rec?.wingNo || '',

      societyName: socName,
      societyLegalName: socName,
      societyAddress: socAddr,
      registrationNo: regActNo,
      registrationDate: regDate,
      authorisedCapital: authCap,
      totalAuthorisedShares: totalShares,
      faceValue: faceVal,

      memberName: primaryName,
      member1: m1,
      member2: m2,
      member3: m3,

      sharesFrom: fromNum,
      sharesTo: toNum,
      valueOfShares: valShares,

      issueCity: (rec as any)?.issueCity || 'MUMBAI',
      issueDate: (rec as any)?.issueDate || '',

      oldCertificateNo: isBlank ? '001' : ((rec as any)?.oldShareCertNo || '001'),
      oldSharesFrom: fromNum,
      oldSharesTo: toNum,
    };
  }
}
