// ============================================================
// HENU OS — Share Certificate Physical Geometry (Golden Master V2)
// Measured directly from SAI FLORA CHS Reference Master Artwork
// 19" x 13" Landscape (1368 pt x 936 pt), 0.67" (48 pt) Safe Margins
// ============================================================

export const MASTER_GEOMETRY = {
  // Physical Sheet Dimensions (72 points = 1 inch)
  SHEET_W: 1368, // 19.00 inches
  SHEET_H: 936,  // 13.00 inches
  MARGIN: 48,    // 0.67 inches

  // Safe Drawing Area
  SAFE_W: 1272,  // 1368 - 96
  SAFE_H: 840,   // 936 - 96

  // ------------------------------------------------------------
  // FRONT PAGE (Page 1)
  // ------------------------------------------------------------
  FRONT: {
    // 1. Left Acknowledgement Strip
    ACK: {
      x: 48,
      y: 48,
      w: 176,
      h: 840,
      headerRibbonY: 848,
      headerRibbonH: 26,
      societyNameY: 820,
      societyLegalY: 798,
      ackTitleY: 774,
      boxStartY: 760,
      boxCount: 3,
      boxH: 228,
      boxGap: 10,
    },

    // 2. Society Copy Panel (Left/Center)
    SOCIETY_COPY: {
      x: 234,
      y: 48,
      w: 534,
      h: 840,
    },

    // 3. Member Copy Panel (Right/Center)
    MEMBER_COPY: {
      x: 778,
      y: 48,
      w: 534,
      h: 840,
    },

    // 4. Detailed Certificate Panel Internal Layout
    PANEL: {
      borderInset: 14,
      innerW: 506,

      // Vertical Coordinates (From Bottom y = 48 up to Top y = 888)
      topMetaRowY: 864,
      ribbonY: 826,
      ribbonW: 420,
      ribbonH: 28,
      authorisedCapY: 806,
      societyNameY: 774,
      societyLegalY: 750,
      societyAddressY: 730,
      registrationActY: 710,
      registrationNoY: 692,

      certifyY: 658,
      holderLine1Y: 632,
      holderLine2Y: 614,
      holderLine3Y: 596,
      holderLine4Y: 578,

      rupeeBoxY: 536,
      rupeeBoxW: 76,
      rupeeBoxH: 26,
      issueDateY: 544,

      oldCertBoxY: 358,
      oldCertBoxH: 160,
      oldCertTextY: 502,
      owner1Y: 450,
      owner2Y: 410,
      owner3Y: 370,

      sealCX: 74, // relative to panel x
      sealCY: 200, // relative to sheet bottom
      sealR: 44,

      signaturesY: 136,
      signaturesLineY: 150,

      footerY: 68,
    },
  },

  // ------------------------------------------------------------
  // BACK PAGE (Page 2)
  // ------------------------------------------------------------
  BACK: {
    // 1. Society Copy Transfer Memo
    SOCIETY_MEMO: {
      x: 48,
      y: 48,
      w: 534,
      h: 840,
    },

    // 2. Member Copy Transfer Memo
    MEMBER_MEMO: {
      x: 592,
      y: 48,
      w: 534,
      h: 840,
    },

    // 3. Right Acknowledgement Strip
    ACK: {
      x: 1136,
      y: 48,
      w: 176,
      h: 840,
      boxCount: 5,
      boxH: 160,
      boxGap: 6,
    },

    // 4. Transfer Memo Columns & 5 Rows
    MEMO: {
      headerY: 864,
      headerH: 24,
      colHeaderY: 826,
      colHeaderH: 38,
      columns: [
        { id: 'date', label: 'Date of\ntransfer', w: 58 },
        { id: 'transferNo', label: 'Transfer\nNo.', w: 46 },
        { id: 'regNoTransfer', label: 'Register No.\nof transfer', w: 62 },
        { id: 'toWhom', label: 'To whom Transferred', w: 300 },
        { id: 'regNoTransferee', label: 'Register No.\nof transferee', w: 68 },
      ],
      rowCount: 5,
      rowH: (826 - 48) / 5, // 155.6 pt
      sealR: 36,
    },
  },
};
