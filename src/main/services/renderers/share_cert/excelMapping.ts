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
    const shares = isBlank ? '' : (rec?.noOfShares || '');
    const flat = isBlank ? '' : (rec?.flatNo ? (rec?.wingNo ? `${rec.wingNo}/${rec.flatNo}` : rec.flatNo) : '');

    const socName = (society?.societyName || '').toUpperCase();
    const socAddr = (society?.headerAddress || society?.address || '').toUpperCase();
    const regActNo = society?.registrationNo || '';
    const regDate = society?.registrationDate || '';

    const authCap = society?.authorisedCapital || '';
    const totalShares = society?.totalAuthorisedShares || '';
    const faceVal = society?.faceValue || '';

    // Member names
    const m1 = isBlank ? '' : (rec?.member1 || rec?.memberName || '');
    const m2 = isBlank ? '' : (rec?.member2 || '');
    const m3 = isBlank ? '' : (rec?.member3 || '');

    const primaryName = [m1, m2, m3].filter(Boolean).join(', ');

    const fromNum = isBlank ? '' : (rec?.sharesFrom || '');
    const toNum = isBlank ? '' : (rec?.sharesTo || '');
    const valShares = isBlank ? '' : (rec?.valueOfShares ? (String(rec.valueOfShares).endsWith('/-') ? String(rec.valueOfShares) : `${rec.valueOfShares}/-`) : '');

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

      issueCity: (rec as any)?.issueCity || '',
      issueDate: (rec as any)?.issueDate || '',

      oldCertificateNo: isBlank ? '' : ((rec as any)?.oldShareCertNo || ''),
      oldSharesFrom: fromNum,
      oldSharesTo: toNum,
    };
  }
}
