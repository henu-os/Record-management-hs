import React from "react";
import "./ShareCertificate.css";

/**
 * SAI FLORA CO-OPERATIVE HOUSING SOCIETY LTD. — Share Certificate
 * Faithful recreation of the printed form: left Acknowledgement stub,
 * "Society Copy" and "Member Copy" — both identical in content ("same to same").
 *
 * All fields are driven by the `data` prop so this can be reused for any
 * member / share range without touching markup.
 */

export interface ShareCertificateData {
  serialNo: string;
  certificateNo: string;
  memberRegisterNo: string;
  noOfShares: string;
  flatNo: string;
  authorisedCapital: string;
  totalShares: string;
  faceValue: string;
  regdNo: string;
  regdDate: string;
  holderName: string;
  sharesInWords: string;
  sharesCount: string;
  shareFrom: string;
  shareTo: string;
  sealDay: string;
  sealMonthYear: string;
  stampValue: string;
  oldCertificateNo: string;
  oldSharesFrom: string;
  oldSharesTo: string;
  owner1?: string;
  owner2?: string;
  owner3?: string;
  societyName?: string;
  societyAddress?: string;
}

const defaultData: ShareCertificateData = {
  serialNo: "001",
  certificateNo: "001",
  memberRegisterNo: "001",
  noOfShares: "10(Ten)",
  flatNo: "A/101",
  authorisedCapital: "1,00,000/-",
  totalShares: "2000",
  faceValue: "50/-",
  regdNo: "BOM/WT/HSG/(TC)/8847 2003-2004",
  regdDate: "07.04.2003",
  holderName: "MR. SANJAY BABURAO NIKALJI",
  sharesInWords: "TEN (10)",
  sharesCount: "FIFTY",
  shareFrom: "001",
  shareTo: "010",
  sealDay: "28th",
  sealMonthYear: "September 2025",
  stampValue: "500/-",
  oldCertificateNo: "001",
  oldSharesFrom: "001",
  oldSharesTo: "005",
};

function cleanCurrencyStr(val?: string | number, defaultVal = "0"): string {
  if (val === undefined || val === null || val === "") return `${defaultVal}/-`;
  const str = String(val).trim();
  const cleaned = str.replace(/(\/\-|\/|\-|\.00)+$/g, '').trim();
  return `${cleaned || defaultVal}/-`;
}

const AcknowledgementBlock: React.FC<{ receiverName?: string; pan?: string; mob?: string }> = ({ receiverName, pan, mob }) => (
  <div className="ack-block">
    <div className="ack-field">
      <span className="ack-label">Name of Receivers :-</span>
      <span className="ack-line">{receiverName || ""}</span>
    </div>
    <div className="ack-field">
      <span className="ack-label">PAN / Aadhar Card No. :-</span>
      <span className="ack-line">{pan || ""}</span>
    </div>
    <div className="ack-field">
      <span className="ack-label">Mobile No. :-</span>
      <span className="ack-line">{mob || ""}</span>
    </div>
    <div className="ack-field">
      <span className="ack-label">Signature :-</span>
      <span className="ack-line" />
    </div>
  </div>
);

const Acknowledgement: React.FC<{ data: ShareCertificateData }> = ({ data }) => (
  <aside className="ack-panel">
    <div className="polaris-ribbon-img-container" style={{ width: "100%", margin: "4px 0" }}>
      <img src="/images/Share red.png" alt="Share Certificate" className="polaris-ribbon-img" style={{ height: "36px", maxWidth: "200px", objectFit: "contain" }} />
    </div>
    <h1 className="ack-society-name">
      {data.societyName || "MULUND AMIT CO-OPERATIVE HOUSING SOCIETY LTD."}
    </h1>
    <h2 className="ack-heading">ACKNOWLEDGEMENT</h2>

    <AcknowledgementBlock receiverName={data.owner1} />
    <AcknowledgementBlock receiverName={data.owner2} />
    <AcknowledgementBlock receiverName={data.owner3} />
  </aside>
);

const CertificateCopy: React.FC<{
  data: ShareCertificateData;
  copyLabel: "SOCIETY COPY" | "MEMBER COPY";
}> = ({ data, copyLabel }) => {
  const authCap = cleanCurrencyStr(data.authorisedCapital, "1,00,000");
  const faceVal = cleanCurrencyStr(data.faceValue, "50");
  const stampVal = cleanCurrencyStr(data.stampValue, "500");

  return (
  <div className="certificate">
    <div className="certificate-border">
      <div className="cert-topline">
        <div className="cert-topline-row">
          <span>
            Serial No.: <u>{data.serialNo}</u>
          </span>
          <span>
            Share Certificate No.: <u>{data.certificateNo}</u>
          </span>
          <span>
            Member&apos;s Register No.: <u>{data.memberRegisterNo}</u>
          </span>
        </div>
        <div className="cert-topline-row">
          <span>
            No. of Shares : <u>{data.noOfShares}</u>
          </span>
          <span>
            Flat No.: <u>{data.flatNo}</u>
          </span>
        </div>
      </div>

      <div className="polaris-ribbon-img-container" style={{ margin: "6px 0 10px" }}>
        <img src="/images/Share red.png" alt="Share Certificate" className="polaris-ribbon-img" style={{ height: "76px", maxWidth: "280px", width: "100%", objectFit: "contain" }} />
      </div>

      <p className="cert-authorised">
        AUTHORISED SHARE CAPITAL OF <strong>Rs. {authCap}</strong> DIVIDED INTO{" "}
        <strong>{data.totalShares} SHARES</strong> OF RS. {faceVal} EACH
      </p>

      <h1 className="cert-society-title">{data.societyName ? data.societyName.replace(/CO-OPERATIVE.*$/i, '').trim() : "SAI FLORA"}</h1>
      <h2 className="cert-society-subtitle">{data.societyName && data.societyName.toUpperCase().includes('CO-OPERATIVE') ? data.societyName.substring(data.societyName.toUpperCase().indexOf('CO-OPERATIVE')) : "CO-OPERATIVE HOUSING SOCIETY LTD."}</h2>

      <p className="cert-address">
        {data.societyAddress || "SAI COMPLEX, NAVGHAR ROAD, MULUND (EAST), MUMBAI – 400 081."}
        <br />
        Registered under the Maharashtra Co-operative Societies Act, 1960
        <br />( Regd. No. : {data.regdNo}, DATED – {data.regdDate} )
      </p>

      <div className="cert-certify">
        <div className="certify-row">
          <span>THIS IS TO CERTIFY THAT</span>
          <u className="cert-holder-name">{data.holderName}</u>
        </div>
        <div className="certify-line-secondary" />
      </div>

      <p className="cert-body-text">
        is/are the Registered Holders of <strong>{data.sharesInWords}</strong> fully paid – up Share of Rupees{" "}
        <strong>{data.sharesCount}</strong> each numbered from{" "}
        <u>{data.shareFrom}</u> to <u>{data.shareTo}</u> both inclusive in{" "}
        <strong>{data.societyName || "SAI FLORA CO-OPERATIVE HOUSING SOCIETY LTD."}</strong> {data.societyAddress || "Sai Complex, Navghar Road, Mulund (East), Mumbai – 400 081."} Subject to the Bye – laws of the Said Society.
      </p>

      <p className="cert-body-text">
        Given under the Common Seal of the Said Society on MUMBAI this{" "}
        <u>{data.sealDay}</u> day of <u>{data.sealMonthYear}</u>.
      </p>

      <div className="cert-lower">
        <div className="cert-stamp">
          <span className="stamp-rupee">₹</span>
          <span className="stamp-value">{stampVal}</span>
        </div>
        <p className="cert-lieu-text">
          This Share Certificate is issued in lieu of the Old Share Certificate No.{" "}
          <u>{data.oldCertificateNo}</u> for fully paid Shares of Rupees {faceVal} each, numbered from{" "}
          <u>{data.oldSharesFrom}</u> to <u>{data.oldSharesTo}</u>, and the members name(s) are mentioned below
          as per the society&apos;s records –
        </p>
      </div>

      <div className="cert-owners">
        <div className="owner-block">
          <div className="owner-row">
            <span className="owner-label">1ˢᵗ OWNER :-</span>
            <span className="owner-line">{data.owner1 ?? ""}</span>
          </div>
          <div className="owner-line-secondary" />
        </div>
        <div className="owner-block">
          <div className="owner-row">
            <span className="owner-label">2ⁿᵈ OWNER :-</span>
            <span className="owner-line">{data.owner2 ?? ""}</span>
          </div>
          <div className="owner-line-secondary" />
        </div>
        <div className="owner-block">
          <div className="owner-row">
            <span className="owner-label">3ʳᵈ OWNER :-</span>
            <span className="owner-line">{data.owner3 ?? ""}</span>
          </div>
          <div className="owner-line-secondary" />
        </div>
      </div>

      <div className="cert-footer">
        <div className="seal-circle">
          <span>Seal of the Society</span>
        </div>
        <div className="signatures">
          <span className="sig-line">Hon. Chairman</span>
          <span className="sig-line">Hon. Secretary</span>
          <span className="sig-line">Authorised M.C. Member</span>
        </div>
      </div>

      <div className="copy-label-bar">
        <span />
        <span>{copyLabel}</span>
        <span className="pto">P.T.O.</span>
      </div>
    </div>
  </div>
  );
};

const TransferMemo: React.FC = () => (
  <div className="transfer-memo-card">
    <div className="memo-title-bar">
      MEMORANDUM OF TRANSFERS OF THE WITHIN MENTIONED SHARES
    </div>
    <div className="memo-table-header">
      <div className="col-date">Date of<br />transfer</div>
      <div className="col-tno">Transfer<br />No.</div>
      <div className="col-reg-tr">Register No.<br />of transfer</div>
      <div className="col-whom">To whom Transfered</div>
      <div className="col-reg-te">Register No.<br />of transferee</div>
    </div>
    <div className="memo-rows">
      {[0, 1, 2, 3, 4].map(idx => (
        <div key={idx} className="memo-row">
          <div className="cell-date" />
          <div className="cell-tno-group">
            <div className="tno-cols-top">
              <div className="cell-tno" />
              <div className="cell-reg-tr" />
            </div>
            <div className="memo-seal-arch">
              <div className="memo-seal-circle">
                <span>SEAL</span>
              </div>
            </div>
          </div>
          <div className="cell-whom-wrapper">
            <div className="whom-top" />
            <div className="whom-bottom">
              <div className="memo-signatures">
                <div className="memo-sig">
                  <div className="memo-sig-line" />
                  <span>Hon. Chairman</span>
                </div>
                <div className="memo-sig">
                  <div className="memo-sig-line" />
                  <span>Hon. Secretary</span>
                </div>
                <div className="memo-sig">
                  <div className="memo-sig-line" />
                  <span>Authorised M.C. Member</span>
                </div>
              </div>
            </div>
          </div>
          <div className="cell-reg-te" />
        </div>
      ))}
    </div>
  </div>
);

const AckBack: React.FC = () => (
  <aside className="ack-panel-back">
    {[0, 1, 2, 3, 4].map(i => (
      <div key={i} className="ack-back-box">
        <div className="ack-back-field"><span className="ack-back-label">Name</span> <span className="dotted-line" /></div>
        <div className="ack-back-field"><span className="ack-back-label">PAN / Aadhar No.</span> <span className="dotted-line" /></div>
        <div className="ack-back-field"><span className="ack-back-label">Mob. No.</span> <span className="dotted-line" /></div>
        <div className="ack-back-field"><span className="ack-back-label">Signature</span> <span className="dotted-line" /></div>
      </div>
    ))}
  </aside>
);

export interface ShareCertificateSheetProps {
  data?: Partial<ShareCertificateData>;
  templateId?: "HENU_OS_DEFAULT" | "HENU_OS_1" | "HENU_OS_2" | "HENU_OS_3" | "POLARIS_LUXURY_13X9" | "MARATHI" | string;
  /**
   * "page" renders the full printed sheet: Acknowledgement + Society Copy + Member Copy,
   * side by side, exactly as the source document.
   * "front" / "back" render a single copy full-bleed (useful for a two-sided card export).
   */
  view?: "page" | "front" | "back";
}

const MarathiAcknowledgementBlock: React.FC<{
  receiverName?: string;
  pan?: string;
  mob?: string;
}> = ({ receiverName, pan, mob }) => (
  <div className="ack-block">
    <div className="ack-field">
      <span className="ack-label">Name :-</span>
      <span className="ack-line">{receiverName || ""}</span>
    </div>
    <div className="ack-field">
      <span className="ack-label">PAN / Aadhar Card No. :-</span>
      <span className="ack-line">{pan || ""}</span>
    </div>
    <div className="ack-field">
      <span className="ack-label">Mobile No. :-</span>
      <span className="ack-line">{mob || ""}</span>
    </div>
    <div className="ack-field">
      <span className="ack-label">Signature :-</span>
      <span className="ack-line" />
    </div>
  </div>
);

const MarathiAcknowledgement: React.FC<{ data: ShareCertificateData }> = ({ data }) => {
  const customAck = typeof window !== 'undefined' ? localStorage.getItem('henu_custom_marathi_ack') : null;
  const ackImgSrc = customAck || "/images/marathi_ack_header.png";

  return (
    <aside className="ack-panel ack-panel--marathi">
      <div className="ribbon-banner" style={{ padding: 0, background: 'transparent', border: 'none' }}>
        <img src="/images/Share blue.png" alt="Share Certificate" style={{ width: '100%', height: 'auto', maxHeight: '42px', objectFit: 'contain' }} onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
      </div>
      <div className="marathi-ack-img-container">
        <img src={ackImgSrc} alt="Ack Header" className="marathi-ack-header-img" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
      </div>
      <div className="marathi-poch-badge">• ACKNOWLEDGEMENT •</div>

      <MarathiAcknowledgementBlock receiverName={data.owner1} />
      <MarathiAcknowledgementBlock receiverName={data.owner2} />
      <MarathiAcknowledgementBlock receiverName={data.owner3} />
    </aside>
  );
};

const MarathiCertificateCopy: React.FC<{
  data: ShareCertificateData;
  copyLabel: "SOCIETY COPY" | "MEMBER COPY";
}> = ({ data, copyLabel }) => {
  const customHeader = typeof window !== 'undefined' ? localStorage.getItem('henu_custom_marathi_header') : null;
  const headerImgSrc = customHeader || "/images/marathi_society_header.png";
  const authCap = cleanCurrencyStr(data.authorisedCapital, "1,00,000");
  const faceVal = cleanCurrencyStr(data.faceValue, "50");
  const stampVal = cleanCurrencyStr(data.stampValue, "550");

  return (
    <div className="certificate certificate--marathi">
      <div className="certificate-border">
        <div className="cert-topline">
          <span>
            Serial No. <u>{data.serialNo || "001"}</u>
          </span>
          <span>
            Share Certificate No. <u>{data.certificateNo || "001"}</u>
          </span>
          <span>
            Member's Regn. No. <u>{data.memberRegisterNo || "001"}</u>
          </span>
          <span>
            No. of Shares <u>{data.noOfShares || "10(TEN)"}</u>
          </span>
          <span>
            Flat No. <u>{data.flatNo || "001"}</u>
          </span>
        </div>

        <p className="cert-authorised-marathi">
          ( AUTHORISED SHARE CAPITAL OF Rs. <strong>{authCap}/-</strong> DIVIDED INTO <strong>{data.totalShares || "2,000"}</strong> SHARES OF RS. <strong>{faceVal}/-</strong> EACH )
        </p>

        <div className="ribbon-banner" style={{ padding: 0, background: 'transparent', border: 'none', display: 'flex', justifyContent: 'center' }}>
          <img src="/images/Share blue.png" alt="Share Certificate" style={{ width: '80%', maxHeight: '68px', objectFit: 'contain' }} onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
        </div>

        <div className="marathi-header-img-container">
          <img
            src={headerImgSrc}
            alt="Header Banner"
            className="marathi-society-header-img"
            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
          />
        </div>

        <p className="marathi-act-line">
          ( Registered under the Maharashtra Co-operative Societies Act, 1960 )
        </p>

        <div className="cert-certify">
          <div className="certify-row">
            <span>THIS IS TO CERTIFY THAT Shri. / Smt. : </span>
            <u className="cert-holder-name">{data.holderName || "AARAV01, VIKRAM01, RAJENDRA01"}</u>
          </div>
          <div className="certify-line-secondary" />
        </div>

        <p className="cert-body-text">
          is/are the Registered Holder of {data.sharesInWords || "TEN (10)"} fully paid up shares of Rs. {faceVal}/- each numbered from {data.shareFrom || "101"} to {data.shareTo || "101"} both inclusive in {data.societyName || "HENU OS PVT LTD CO-SOC"} {data.societyAddress || "HOME BHAGESAR, 10B-204 SECOND FLOOR"}, Subject to the Bye-laws of the said society.
        </p>

        <div className="cert-seal-note">
          Given under the Common Seal of the said society on MUMBAI this ___ day of ____
        </div>

        <div className="cert-lieu-row">
          <div className="cert-stamp">
            <span className="stamp-rs">Rs.</span>
            <span className="stamp-value">{stampVal}/-</span>
          </div>
          <div className="cert-lieu-text">
            This Share Certificate is issued in lieu of the Old Share Certificate No. {data.serialNo || "001"} for fully paid Shares of Rupees {faceVal}/- each, numbered from {data.shareFrom || "101"} to {data.shareTo || "101"}, and the members name(s) are mentioned below as per the society's records -
          </div>
        </div>

        <div className="cert-owners">
          <div className="owner-row">
            <span className="owner-label">1st OWNER :-</span>
            <span className="owner-value">{data.owner1 || "AARAV01"}</span>
          </div>
          <div className="owner-row">
            <span className="owner-label">2nd OWNER :-</span>
            <span className="owner-value">{data.owner2 || "VIKRAM01"}</span>
          </div>
          <div className="owner-row">
            <span className="owner-label">3rd OWNER :-</span>
            <span className="owner-value">{data.owner3 || "RAJENDRA01"}</span>
          </div>
        </div>

        <div className="cert-signatures">
          <div className="seal-circle">
            <span>Seal of the<br />Society</span>
          </div>
          <div className="sig-list">
            <div className="sig-col">
              <div className="sig-line" />
              <span>Hon. Chairman</span>
            </div>
            <div className="sig-col">
              <div className="sig-line" />
              <span>Hon. Secretary</span>
            </div>
            <div className="sig-col">
              <div className="sig-line" />
              <span>Authorised M.C. Member</span>
            </div>
          </div>
        </div>

        <div className="marathi-pto">P.T.O.</div>

        <div className="copy-label-bar">
          <span>{copyLabel}</span>
        </div>
      </div>
    </div>
  );
};

const MarathiTransferMemo: React.FC = () => (
  <div className="transfer-memo-card transfer-memo-card--marathi">
    <div className="memo-title-bar">
      उल्लेखित भागांच्या (शेअर्सच्या) हस्तांतरणाचा ज्ञापन (मेमोरॅडम)
    </div>
    <div className="memo-table-header">
      <div className="col-date">हस्तांतरणाची<br />तारीख</div>
      <div className="col-tno">हस्तांतरण<br />क्रमांक</div>
      <div className="col-reg-tr">हस्तांतरण<br />नोंदणी क्र.</div>
      <div className="col-whom">ज्यांच्या नावे हस्तांतरित केले त्यांचे नाव</div>
      <div className="col-reg-te">हस्तांतरित व्यक्तीचा<br />नोंदणी क्रमांक</div>
    </div>
    <div className="memo-rows">
      {[0, 1, 2, 3, 4].map(idx => (
        <div key={idx} className="memo-row">
          <div className="cell-date" />
          <div className="cell-tno-group">
            <div className="tno-cols-top">
              <div className="cell-tno" />
              <div className="cell-reg-tr" />
            </div>
            <div className="memo-seal-arch">
              <div className="memo-seal-circle">
                <span>शिक्का</span>
              </div>
            </div>
          </div>
          <div className="cell-whom-wrapper">
            <div className="whom-top" />
            <div className="whom-bottom">
              <div className="memo-signatures">
                <div className="memo-sig">
                  <div className="memo-sig-line" />
                  <span>अध्यक्ष</span>
                </div>
                <div className="memo-sig">
                  <div className="memo-sig-line" />
                  <span>सचिव</span>
                </div>
                <div className="memo-sig">
                  <div className="memo-sig-line" />
                  <span>अधिकृत का. सदस्य</span>
                </div>
              </div>
            </div>
          </div>
          <div className="cell-reg-te" />
        </div>
      ))}
    </div>
  </div>
);

const MarathiAckBack: React.FC = () => (
  <aside className="ack-panel-back ack-panel-back--marathi">
    {[0, 1, 2, 3, 4].map(i => (
      <div key={i} className="ack-back-box">
        <div className="ack-back-field"><span className="ack-back-label">नाव :-</span> <span className="dotted-line" /></div>
        <div className="ack-back-field"><span className="ack-back-label">पॅन/आधार कार्ड नं. :-</span> <span className="dotted-line" /></div>
        <div className="ack-back-field"><span className="ack-back-label">संपर्क क्र. :-</span> <span className="dotted-line" /></div>
        <div className="ack-back-field"><span className="ack-back-label">सही :-</span> <span className="dotted-line" /></div>
      </div>
    ))}
  </aside>
);

const PolarisAcknowledgement: React.FC<{ data: ShareCertificateData }> = ({ data }) => (
  <aside className="ack-panel">
    <div className="polaris-ribbon-img-container" style={{ width: "100%", margin: "4px 0" }}>
      <img src="/images/Acknoglement.png" alt="Share Certificate" className="polaris-ribbon-img" style={{ height: "32px", width: "100%", objectFit: "fill" }} />
      <span className="polaris-ribbon-text-overlay" style={{ fontSize: "11px" }}>SHARE CERTIFICATE</span>
    </div>
    <div style={{ textAlign: "center", margin: "6px 0" }}>
      <h2 style={{ fontSize: "18px", fontWeight: 900, color: "#280C4D", margin: 0, letterSpacing: "1px" }}>
        {data.societyName?.replace(/CO-OPERATIVE.*$/i, "").trim() || "POLARIS"}
      </h2>
      <div style={{ fontSize: "8px", fontWeight: 800, color: "#A01E1E", margin: "2px 0" }}>
        CO-OPERATIVE HOUSING SOCIETY LIMITED.
      </div>
      <p style={{ fontSize: "7.5px", color: "#17151B", margin: "3px 0", lineHeight: "1.3" }}>
        {data.societyAddress?.replace(/Registered under.*$/i, "").trim() || "CTS No. 548, A To G, Nahur Village, L.B.S. Marg, Mulund (West), Mumbai - 400080."}
      </p>
      <p style={{ fontSize: "6.8px", fontWeight: 700, color: "#555", margin: 0 }}>
        ( Registered under the Maharashtra Co-operative Societies Act, 1960 )
      </p>
      <p style={{ fontSize: "6.8px", fontWeight: 700, color: "#555", margin: 0 }}>
        Registration No. {data.regdNo || "MUM/WT/HS/GC/T/1489/YEAR 2024 DT. 10/04/2024"}
      </p>
    </div>
    <div className="polaris-ribbon-img-container" style={{ width: "100%", margin: "4px 0 8px" }}>
      <img src="/images/Acknoglement.png" alt="Acknowledgement" className="polaris-ribbon-img" style={{ height: "30px", width: "100%", objectFit: "fill" }} />
      <span className="polaris-ribbon-text-overlay" style={{ fontSize: "10.5px" }}>ACKNOWLEDGEMENT</span>
    </div>

    {[0, 1, 2].map(i => (
      <div key={i} className="polaris-ack-card" style={{ marginBottom: "10px" }}>
        <div className="ack-field"><span className="ack-label">Name :</span> <span className="ack-line">{i === 0 ? data.holderName : ""}</span></div>
        <div className="ack-field"><span className="ack-label">PAN / Aadhar No. :</span> <span className="ack-line" /></div>
        <div className="ack-field"><span className="ack-label">Mob. No. :</span> <span className="ack-line" /></div>
        <div className="ack-field"><span className="ack-label">Bank Name :</span> <span className="ack-line" /></div>
        <div className="ack-field"><span className="ack-label">Signature :</span> <span className="ack-line" /></div>
      </div>
    ))}
  </aside>
);

const PolarisCertificateCopy: React.FC<{
  data: ShareCertificateData;
  copyLabel: "SOCIETY COPY" | "MEMBER COPY";
}> = ({ data, copyLabel }) => {
  const isSociety = copyLabel === "SOCIETY COPY";
  const ribbonSrc = isSociety ? "/images/Share poly 1.png" : "/images/Share poly.png";
  const leftCornerSrc = isSociety ? "/images/Left top corner.png" : "/images/Member left top corner.png";
  const rightCornerSrc = isSociety ? "/images/Right bottom corner.png" : "/images/Member right bottom corner.png";
  const compassSrc = isSociety ? "/images/polaris_compass_purple.png" : "/images/polaris_compass_gold.png";
  const authCap = cleanCurrencyStr(data.authorisedCapital, "1,00,000");
  const faceVal = cleanCurrencyStr(data.faceValue, "50");
  const stampVal = cleanCurrencyStr(data.stampValue, "550");
  const themeColor = isSociety ? "#280C4D" : "#875700";
  const rawFlat = String(data.flatNo || "A/102").trim();
  const flatParts = rawFlat.includes("/") ? rawFlat.split("/") : [rawFlat];
  const wing = String((data as any).wingNo || (flatParts.length > 1 ? flatParts[0] : "A")).trim();
  const flat = rawFlat;

  return (
    <div className="certificate" style={{ position: "relative" }}>
      <div className="certificate-border" style={{ borderColor: themeColor, position: "relative", overflow: "hidden" }}>
        {/* Left top corner decoration */}
        <img
          src={leftCornerSrc}
          alt=""
          style={{ position: "absolute", top: 0, left: 0, width: "90px", height: "90px", pointerEvents: "none", zIndex: 1 }}
        />
        {/* Right bottom corner decoration */}
        <img
          src={rightCornerSrc}
          alt=""
          style={{ position: "absolute", bottom: 0, right: 0, width: "100%", height: "auto", maxHeight: "115px", pointerEvents: "none", zIndex: 1 }}
        />

        <div className="cert-topline" style={{ fontSize: "8.8px", gap: "6px", padding: "0 6px 0 50px", position: "relative", zIndex: 2 }}>
          <div className="cert-topline-row" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Serial No. <u style={{ fontWeight: 800 }}>{data.serialNo || "001"}</u></span>
            <span>Share Certificate No. <u style={{ fontWeight: 800 }}>{data.certificateNo || "HENU-SH-001"}</u></span>
            <span>Member&apos;s Regn. No. <u style={{ fontWeight: 800 }}>{data.memberRegisterNo || "HENU-MEM-001"}</u></span>
          </div>
          <div className="cert-topline-row" style={{ display: "flex", justifyContent: "space-between", paddingLeft: "4px" }}>
            <span>No. of Shares <u style={{ fontWeight: 800 }}>{data.sharesInWords || data.noOfShares || "11(ELEVEN)"}</u></span>
            <span style={{ paddingLeft: "20px" }}>Wrg No. <u style={{ fontWeight: 800 }}>{wing}</u></span>
            <span>Flat No. <u style={{ fontWeight: 800 }}>{flat}</u></span>
          </div>
        </div>

        <div className="polaris-ribbon-img-container" style={{ margin: "8px 0 6px", position: "relative", zIndex: 2 }}>
          <img src={ribbonSrc} alt="Share Certificate" className="polaris-ribbon-img" style={{ height: "52px", maxWidth: "370px", width: "100%", objectFit: "contain" }} />
        </div>

        <div className="capital-line" style={{ fontSize: "8.5px", color: "#17151B", textAlign: "center", position: "relative", zIndex: 2 }}>
          ( AUTHORISED SHARE CAPITAL OF Rs. <u><strong style={{ fontWeight: 800 }}>{authCap}/-</strong></u> DIVIDED INTO <u><strong style={{ fontWeight: 800 }}>{data.totalShares || "2000"}</strong></u> SHARES OF RS. <u><strong style={{ fontWeight: 800 }}>{faceVal}/-</strong></u> EACH )
        </div>

        {/* Society Header Block with Compass Star Logo */}
        <div style={{ display: "flex", alignItems: "center", margin: "10px 10px 4px", gap: "10px", position: "relative", zIndex: 2 }}>
          <img
            src={compassSrc}
            alt="Compass Logo"
            style={{ width: "76px", height: "76px", objectFit: "contain", flexShrink: 0 }}
          />
          <div style={{ flex: 1, textAlign: "center" }}>
            <h1 className="polaris-soc-name" style={{ color: themeColor, fontSize: "24px", margin: "0", letterSpacing: "1px", fontWeight: 900 }}>
              {data.societyName?.replace(/CO-OPERATIVE.*$/i, "").trim() || "HENU OS PVT LTD CO-SOC"}
            </h1>
            <div className="polaris-soc-sub" style={{ fontSize: "9.5px", fontWeight: 800, color: isSociety ? "#A01E1E" : "#875700", margin: "2px 0" }}>
              CO-OPERATIVE HOUSING SOCIETY LIMITED.
            </div>
            <div className="polaris-soc-addr" style={{ fontSize: "8px", color: "#333", marginTop: "2px", lineHeight: "1.3" }}>
              {data.societyAddress?.replace(/Registered under.*$/i, "").trim() || "HOME BHAGESAR, 10B-204 SECOND FLOOR"}
            </div>
            <div className="polaris-soc-reg" style={{ fontSize: "7.2px", color: "#555", marginTop: "2px" }}>
              ( Registered under the Maharashtra Co-operative Societies Act, 1960 )<br />
              Registration No. {data.regdNo || "U62099RJ2025PTC109150"}
            </div>
          </div>
        </div>

        <div className="cert-body" style={{ marginTop: "12px", fontSize: "9.6px", lineHeight: "1.7", position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            <span style={{ fontWeight: 400 }}>THIS IS TO CERTIFY THAT Shri. / Smt. :</span>
            <span style={{ flex: 1, borderBottom: "1px solid #77747D", fontWeight: 800, textAlign: "left", paddingLeft: "4px" }}>
              {data.holderName || "AARAV01, VIKRAM01, RAJENDRA01"}
            </span>
          </div>
          <div style={{ marginTop: "10px", textAlign: "justify", lineHeight: "1.65" }}>
            is/are the Registered Holder of <strong>{data.sharesInWords || "11(ELEVEN)"}</strong> fully paid up shares of Rs. <strong>{faceVal}/-</strong> each numbered from <strong>{data.shareFrom || "101"}</strong> to <strong>{data.shareTo || "101"}</strong> both Inclusive in <strong>{data.societyName || "HENU OS PVT LTD CO-SOC"}</strong>, {data.societyAddress?.replace(/Registered under.*$/i, "").trim()}. Subject to the Bye-laws of the said society.
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "14px" }}>
            <div
              className="stamp-seal"
              style={{
                borderColor: themeColor,
                color: themeColor,
                width: "66px",
                height: "34px",
                border: `2px solid ${themeColor}`,
                outline: `1px solid ${themeColor}`,
                outlineOffset: "-3px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                fontSize: "11px",
                flexShrink: 0
              }}
            >
              Rs. {stampVal}/-
            </div>
            <div style={{ fontWeight: 400, fontSize: "9.5px", lineHeight: "1.4" }}>
              Given under the Common Seal of<br />
              the said society on this <strong>{data.sealDay || "29th"} {data.sealMonthYear || "September 2024"}</strong>.
            </div>
          </div>
        </div>

        {/* Signatures & Watermark Seal */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "18px", padding: "0 10px", position: "relative", zIndex: 2 }}>
          <div style={{ width: "62px", height: "62px", border: "1.5px dashed #B0ADC0", borderRadius: "50%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#B0ADC0", fontSize: "7.5px", fontWeight: 800 }}>
            <span>SEAL OF</span>
            <span>SOCIETY</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "18px", width: "55%" }}>
            {["Hon. Chairman", "Hon. Secretary", "Hon. Treasurer"].map((title, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "baseline", gap: "8px", fontSize: "9px" }}>
                <strong style={{ color: themeColor, whiteSpace: "nowrap" }}>{title}</strong>
                <span style={{ flex: 1, borderBottom: "1px solid #aaa" }} />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Copy Overlay */}
        <div style={{ position: "absolute", bottom: "16px", left: "50%", transform: "translateX(-50%)", zIndex: 3 }}>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: "10px", letterSpacing: "0.5px" }}>
            {copyLabel}
          </span>
        </div>
      </div>
    </div>
  );
};

const PolarisTransferMemo: React.FC<{ theme?: "SOCIETY" | "MEMBER" }> = ({ theme = "SOCIETY" }) => {
  return (
    <div className="transfer-memo-card" style={{ borderColor: "#280C4D", position: "relative", overflow: "hidden" }}>
      <div className="polaris-ribbon-img-container" style={{ margin: "6px auto", width: "98%" }}>
        <img src="/images/Acknoglement.png" alt="Memorandum" className="polaris-ribbon-img" style={{ height: "30px", width: "100%", objectFit: "fill" }} />
        <span className="polaris-ribbon-text-overlay" style={{ fontSize: "9.5px", letterSpacing: "0.3px" }}>MEMORANDUM OF TRANSFERS OF THE WITHIN MENTIONED SHARES</span>
      </div>
      <div className="memo-table-header" style={{ color: "#280C4D", borderBottomColor: "#280C4D", background: "#f1ebf9" }}>
        <div className="col-date">Date of Transfer</div>
        <div className="col-tno">Transferor Folio No.</div>
        <div className="col-reg-tr">Transferee Folio No.</div>
        <div className="col-whom">To whom Transferred</div>
        <div className="col-reg-te">Register No. of Transfer</div>
      </div>
      <div className="memo-rows" style={{ position: "relative", zIndex: 2 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="memo-row" style={{ borderBottomColor: "#280C4D", minHeight: "125px" }}>
            <div className="cell-date" />
            <div className="cell-tno" />
            <div className="cell-reg-tr" />
            <div className="cell-whom-wrapper">
              <div className="whom-top" />
              <div className="whom-bottom">
                <div className="memo-seal-arch" style={{ borderColor: "transparent", background: "transparent" }}>
                  <div className="polaris-oval-seal">
                    <span>SEAL</span>
                  </div>
                </div>
                <div className="memo-signatures">
                  <div className="memo-sig"><div className="memo-sig-line" /><span>Hon. Chairman</span></div>
                  <span className="polaris-sig-cross">✦</span>
                  <div className="memo-sig"><div className="memo-sig-line" /><span>Hon. Secretary</span></div>
                  <span className="polaris-sig-cross">✦</span>
                  <div className="memo-sig"><div className="memo-sig-line" /><span>Authorised M.C. Member</span></div>
                </div>
              </div>
            </div>
            <div className="cell-reg-te" />
          </div>
        ))}
      </div>
      <div className="polaris-back-skyline" />
    </div>
  );
};

const PolarisAckBack: React.FC = () => (
  <aside className="ack-panel-back" style={{ background: "#F7F5F1", border: "1.8px solid #280C4D", padding: "8px 6px" }}>
    {[0, 1, 2, 3, 4].map(i => (
      <React.Fragment key={i}>
        <div className="ack-back-box" style={{ border: "1.2px solid #280C4D", borderRadius: "6px", background: "#ffffff", padding: "6px 8px", marginBottom: "4px" }}>
          <div className="ack-back-field"><span className="ack-back-label" style={{ color: "#280C4D" }}>Name :</span> <span className="dotted-line" /></div>
          <div className="ack-back-field"><span className="ack-back-label" style={{ color: "#280C4D" }}>PAN / Aadhar No. :</span> <span className="dotted-line" /></div>
          <div className="ack-back-field"><span className="ack-back-label" style={{ color: "#280C4D" }}>Mob. No. :</span> <span className="dotted-line" /></div>
          <div className="ack-back-field"><span className="ack-back-label" style={{ color: "#280C4D" }}>Signature :</span> <span className="dotted-line" /></div>
        </div>
        {i < 4 && <div className="polaris-ack-cross">✤</div>}
      </React.Fragment>
    ))}
  </aside>
);

export const ShareCertificateSheet: React.FC<ShareCertificateSheetProps> = ({
  data,
  templateId = "HENU_OS_DEFAULT",
  view = "page",
}) => {
  const merged: ShareCertificateData = { ...defaultData, ...data };
  const isMarathi = templateId === "HENU_OS_2" || templateId === "MARATHI";
  const isPolaris = templateId === "HENU_OS_3" || templateId === "POLARIS_LUXURY_13X9";

  if (isPolaris) {
    if (view === "front") {
      return (
        <div className="cert-sheet cert-sheet--single cert-sheet--polaris">
          <PolarisCertificateCopy data={merged} copyLabel="SOCIETY COPY" />
        </div>
      );
    }
    if (view === "back") {
      return (
        <div className="cert-sheet cert-sheet--back cert-sheet--polaris">
          <PolarisTransferMemo theme="SOCIETY" />
          <PolarisTransferMemo theme="MEMBER" />
          <PolarisAckBack />
        </div>
      );
    }
    return (
      <div className="cert-sheet cert-sheet--polaris">
        <PolarisAcknowledgement data={merged} />
        <PolarisCertificateCopy data={merged} copyLabel="SOCIETY COPY" />
        <PolarisCertificateCopy data={merged} copyLabel="MEMBER COPY" />
      </div>
    );
  }

  if (isMarathi) {
    if (view === "front") {
      return (
        <div className="cert-sheet cert-sheet--single">
          <MarathiCertificateCopy data={merged} copyLabel="SOCIETY COPY" />
        </div>
      );
    }
    if (view === "back") {
      return (
        <div className="cert-sheet cert-sheet--back">
          <MarathiTransferMemo />
          <MarathiTransferMemo />
          <MarathiAckBack />
        </div>
      );
    }
    return (
      <div className="cert-sheet">
        <MarathiAcknowledgement data={merged} />
        <MarathiCertificateCopy data={merged} copyLabel="SOCIETY COPY" />
        <MarathiCertificateCopy data={merged} copyLabel="MEMBER COPY" />
      </div>
    );
  }

  if (view === "front") {
    return (
      <div className="cert-sheet cert-sheet--single">
        <CertificateCopy data={merged} copyLabel="SOCIETY COPY" />
      </div>
    );
  }

  if (view === "back") {
    return (
      <div className="cert-sheet cert-sheet--back">
        <TransferMemo />
        <TransferMemo />
        <AckBack />
      </div>
    );
  }

  return (
    <div className="cert-sheet">
      <Acknowledgement data={merged} />
      <CertificateCopy data={merged} copyLabel="SOCIETY COPY" />
      <CertificateCopy data={merged} copyLabel="MEMBER COPY" />
    </div>
  );
};

export default ShareCertificateSheet;
