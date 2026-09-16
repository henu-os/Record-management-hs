/* ==========================================================================
   HLABS FILING — Records Management
   FORM 'I' — Register of Members — JavaScript controller
   ========================================================================== */

/**
 * @typedef {Object} ShareHeldRow
 * @property {string} date
 * @property {string} cashBookFolio
 * @property {string} application
 * @property {string} allotment
 * @property {string} firstCall
 * @property {string} secondCall
 * @property {string} totalReceived
 * @property {string} numberOfShares
 * @property {string} shareCertificateNumber
 */

/**
 * @typedef {Object} ShareTransferRow
 * @property {string} date
 * @property {string} cashBookFolio
 * @property {string} transferDate
 * @property {string} transferFolioOrRegisterNo
 * @property {string} shareCertificateRef
 * @property {string} sharesTransferredOrRefunded
 * @property {string} balanceShares
 * @property {string} balanceCertificateNo
 * @property {string} amount
 */

/**
 * @typedef {Object} MemberData
 * @property {string} pageNumber
 * @property {string} serialNumber
 * @property {string} admissionDate
 * @property {string} entranceFeeDate
 * @property {string} fullName
 * @property {string} permanentAddress
 * @property {string} residentialAddress
 * @property {string} occupation
 * @property {string} age
 * @property {string} nomineeName
 * @property {string} nomineeAddress
 * @property {string} nominationDate
 * @property {string} cessationDate
 * @property {string} cessationReason
 * @property {string} remarks
 * @property {ShareHeldRow[]} sharesHeld
 * @property {ShareTransferRow[]} sharesTransferred
 */

/** Returns a fresh, fully-blank MemberData object (template/empty mode). */
function blankMemberData() {
  return {
    pageNumber: '',
    serialNumber: '',
    admissionDate: '',
    entranceFeeDate: '',
    fullName: '',
    permanentAddress: '',
    residentialAddress: '',
    occupation: '',
    age: '',
    nomineeName: '',
    nomineeAddress: '',
    nominationDate: '',
    cessationDate: '',
    cessationReason: '',
    remarks: '',
    sharesHeld: [],
    sharesTransferred: []
  };
}

var defaultConfig = {
  orientation: 'portrait',   // 'portrait' | 'landscape'
  margin: '12mm',
  fontSize: '9.5pt',
  headingSize: '16pt',
  rowHeight: '22px',
  lineThickness: '1px',
  printScale: 1,
  blueColor: '#2F4157',
  pageBgColor: '#E3ECF2',
  accentColor: '#A2C1D1',
  minBlankSharesHeldRows: 8,
  minBlankTransferRows: 6
};

/* -------------------- Helpers -------------------- */

function applyConfigToRoot(config) {
  var root = document.documentElement;
  root.style.setProperty('--blue', config.blueColor || defaultConfig.blueColor);
  root.style.setProperty('--page-bg', config.pageBgColor || defaultConfig.pageBgColor);
  root.style.setProperty('--accent', config.accentColor || defaultConfig.accentColor);
  root.style.setProperty('--line-thickness', config.lineThickness || defaultConfig.lineThickness);
  root.style.setProperty('--font-size', config.fontSize || defaultConfig.fontSize);
  root.style.setProperty('--heading-size', config.headingSize || defaultConfig.headingSize);
  root.style.setProperty('--row-height', config.rowHeight || defaultConfig.rowHeight);
  root.style.setProperty('--margin', config.margin || defaultConfig.margin);
  root.style.setProperty('--print-scale', config.printScale || defaultConfig.printScale);
}

/** Writes a value into a form input or text container element. */
function setField(key, value) {
  var el = document.querySelector('[data-field="' + key + '"]');
  if (!el) return;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    el.value = value || '';
  } else {
    el.textContent = value || '';
  }
}

/** Reads a value from a form element. */
function getFieldValue(key) {
  var el = document.querySelector('[data-field="' + key + '"]');
  if (!el) return '';
  return el.value !== undefined ? el.value : el.textContent;
}

/* -------------------- Nominee Address Spanning -------------------- */

function renderNomineeAddress(nomineeAddress) {
  var line1 = document.querySelector('[data-field="nominee_address_line1"]');
  var line2 = document.querySelector('[data-field="nominee_address_line2"]');
  if (!line1 || !line2) return;

  var text = nomineeAddress || '';
  var parts = text.split('\n');

  // If nominee address is a single long string, split it intelligently at a space character
  if (parts.length === 1 && text.length > 55) {
    var breakIndex = text.lastIndexOf(' ', 55);
    if (breakIndex > 20) {
      parts = [text.slice(0, breakIndex), text.slice(breakIndex + 1)];
    }
  }

  setField('nominee_address_line1', parts[0] || '');
  setField('nominee_address_line2', parts.slice(1).join(' ') || '');
}

/* -------------------- Particulars of Shares Held -------------------- */

function buildSharesHeldRow(row) {
  var tr = document.createElement('tr');
  tr.className = 'record-row';

  var columns = [
    { field: 'date', placeholder: '' },
    { field: 'cashBookFolio', placeholder: '' },
    { field: 'application', placeholder: '' },
    { field: 'allotment', placeholder: '' },
    { field: 'firstCall', placeholder: '' },
    { field: 'secondCall', placeholder: '' },
    { field: 'totalReceived', placeholder: '' },
    { field: 'numberOfShares', placeholder: '' },
    { field: 'shareCertificateNumber', placeholder: '' }
  ];

  columns.forEach(function (col) {
    var td = document.createElement('td');
    var input = document.createElement('input');
    input.type = 'text';
    input.dataset.field = col.field;
    input.value = row[col.field] || '';
    input.placeholder = col.placeholder;
    td.appendChild(input);
    tr.appendChild(td);
  });

  return tr;
}

function renderSharesHeld(rows, config) {
  var tbody = document.getElementById('shares-held-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  // Render populated rows
  rows.forEach(function (row) {
    tbody.appendChild(buildSharesHeldRow(row));
  });

  // Render blank rows to pad layout
  var blanksNeeded = Math.max(0, config.minBlankSharesHeldRows - rows.length);
  for (var i = 0; i < blanksNeeded; i++) {
    tbody.appendChild(buildSharesHeldRow({}));
  }
}

function getSharesHeldData() {
  var rows = [];
  var tableRows = document.querySelectorAll('#shares-held-body tr');
  tableRows.forEach(function (tr) {
    var rowData = {};
    var hasValue = false;
    var inputs = tr.querySelectorAll('input');
    inputs.forEach(function (input) {
      var field = input.dataset.field;
      var val = input.value.trim();
      rowData[field] = val;
      if (val !== '') {
        hasValue = true;
      }
    });
    if (hasValue) {
      rows.push(rowData);
    }
  });
  return rows;
}

/* -------------------- Shares Transferred/Surrendered -------------------- */

function buildTransferRow(row) {
  var tr = document.createElement('tr');
  tr.className = 'record-row';

  var columns = [
    { field: 'date' },
    { field: 'cashBookFolio' },
    { field: 'transferDate' },
    { field: 'transferFolioOrRegisterNo' },
    { field: 'shareCertificateRef' },
    { field: 'sharesTransferredOrRefunded' },
    { field: 'balanceShares' },
    { field: 'balanceCertificateNo' },
    { field: 'amount' }
  ];

  columns.forEach(function (col) {
    var td = document.createElement('td');
    var input = document.createElement('input');
    input.type = 'text';
    input.dataset.field = col.field;
    input.value = row[col.field] || '';
    td.appendChild(input);
    tr.appendChild(td);
  });

  return tr;
}

function renderSharesTransferred(rows, config) {
  var tbody = document.getElementById('shares-transfer-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  // Render populated rows
  rows.forEach(function (row) {
    tbody.appendChild(buildTransferRow(row));
  });

  // Render blank rows to pad layout
  var blanksNeeded = Math.max(0, config.minBlankTransferRows - rows.length);
  for (var i = 0; i < blanksNeeded; i++) {
    tbody.appendChild(buildTransferRow({}));
  }
}

function getSharesTransferredData() {
  var rows = [];
  var tableRows = document.querySelectorAll('#shares-transfer-body tr');
  tableRows.forEach(function (tr) {
    var rowData = {};
    var hasValue = false;
    var inputs = tr.querySelectorAll('input');
    inputs.forEach(function (input) {
      var field = input.dataset.field;
      var val = input.value.trim();
      rowData[field] = val;
      if (val !== '') {
        hasValue = true;
      }
    });
    if (hasValue) {
      rows.push(rowData);
    }
  });
  return rows;
}

/* -------------------- Core Render Interface -------------------- */

/**
 * Renders Form I Register of Members layout using provided data.
 * @param {MemberData} data
 * @param {Object} [config]
 */
function renderFormI(data, config) {
  config = Object.assign({}, defaultConfig, config || {});
  data = Object.assign({}, blankMemberData(), data || {});

  applyConfigToRoot(config);
  setOrientation(config.orientation, config);

  setField('page_number', data.pageNumber || data.page_number);
  setField('serial_number', data.serialNumber || data.serial_number);
  setField('date_of_admission', data.admissionDate || data.date_of_admission);
  setField('entrance_fee_date', data.entranceFeeDate || data.entrance_fee_date);
  setField('full_name', data.fullName || data.full_name);
  setField('permanent_address', data.permanentAddress || data.permanent_address);
  setField('residential_address', data.residentialAddress || data.residential_address);
  setField('occupation', data.occupation);
  setField('age_on_admission', data.age || data.age_on_admission);
  setField('nominee_name', data.nomineeName || data.nominee_name);

  // Address nominee fields (split across nominee_address_line1 and nominee_address_line2)
  var rawNomineeAddress = data.nomineeAddress || data.nominee_address || '';
  if (!rawNomineeAddress && (data.nomineeAddressLine1 || data.nominee_address_line1)) {
    rawNomineeAddress = (data.nomineeAddressLine1 || data.nominee_address_line1 || '') + '\n' +
                         (data.nomineeAddressLine2 || data.nominee_address_line2 || '');
  }
  renderNomineeAddress(rawNomineeAddress);

  setField('date_of_nomination', data.nominationDate || data.date_of_nomination);
  setField('date_of_cessation', data.cessationDate || data.date_of_cessation);
  setField('reason_for_cessation', data.cessationReason || data.reason_for_cessation);
  setField('remarks', data.remarks);

  // Render sub tables
  renderSharesHeld(Array.isArray(data.sharesHeld) ? data.sharesHeld : [], config);
  renderSharesTransferred(Array.isArray(data.sharesTransferred) ? data.sharesTransferred : [], config);

  updatePageCount();
}

/** Exposes the entire form data back as a single compiled MemberData record object */
function getFormIData() {
  var nomineeAddr = getFieldValue('nominee_address_line1');
  var line2 = getFieldValue('nominee_address_line2');
  if (line2) nomineeAddr += '\n' + line2;

  return {
    pageNumber: getFieldValue('page_number'),
    serialNumber: getFieldValue('serial_number'),
    admissionDate: getFieldValue('date_of_admission'),
    entranceFeeDate: getFieldValue('entrance_fee_date'),
    fullName: getFieldValue('full_name'),
    permanentAddress: getFieldValue('permanent_address'),
    residentialAddress: getFieldValue('residential_address'),
    occupation: getFieldValue('occupation'),
    age: getFieldValue('age_on_admission'),
    nomineeName: getFieldValue('nominee_name'),
    nomineeAddress: nomineeAddr,
    nominationDate: getFieldValue('date_of_nomination'),
    cessationDate: getFieldValue('date_of_cessation'),
    cessationReason: getFieldValue('reason_for_cessation'),
    remarks: getFieldValue('remarks'),
    sharesHeld: getSharesHeldData(),
    sharesTransferred: getSharesTransferredData()
  };
}

/* -------------------- Printing Layouts -------------------- */

function setOrientation(orientation, config) {
  config = config || defaultConfig;
  var isLandscape = orientation === 'landscape';
  document.body.classList.toggle('orientation-landscape', isLandscape);
  document.body.classList.toggle('orientation-portrait', !isLandscape);

  var styleTag = document.getElementById('page-size-override');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'page-size-override';
    document.head.appendChild(styleTag);
  }
  var size = isLandscape ? 'A4 landscape' : 'A4 portrait';
  var margin = config.margin || defaultConfig.margin;
  var spineWidth = config.spineWidth || defaultConfig.spineWidth;
  
  styleTag.textContent = 
    '@page { size: ' + size + '; margin: 0; } ' +
    '.form-page { ' +
      'padding: ' + margin + ' ' + margin + ' ' + margin + ' calc(' + margin + ' + ' + spineWidth + ') !important; ' +
    '}';

  var select = document.getElementById('ctrl-orientation');
  if (select && select.value !== orientation) select.value = orientation;
}

function updatePageCount() {
  var pages = document.querySelectorAll('.form-page');
  var total = pages.length;
  pages.forEach(function (page, i) {
    var el = page.querySelector('.page-count');
    if (el) {
      el.textContent = total > 1 ? ('Sheet ' + (i + 1) + ' of ' + total) : 'Sheet 1';
    }
  });
}

/* -------------------- 12. SAMPLE DATA FOR VERIFICATION -------------------- */

var SAMPLE_MEMBER_DATA_FOR_TESTING = {
  pageNumber: '08',
  serialNumber: '24',
  admissionDate: '12/04/2012',
  entranceFeeDate: '12/04/2012',
  fullName: 'ARVIND RAMCHANDRA KALE',
  permanentAddress: 'Plot 45, Kale Villa, Ganesh Colony, Karad, Satara - 415110',
  residentialAddress: 'Flat 502, B-Wing, Shanti Sadan CHS, Kothrud, Pune - 411038',
  occupation: 'Chartered Accountant',
  age: '38',
  nomineeName: 'MRS. PRIYA ARVIND KALE',
  nomineeAddress: 'Flat 502, B-Wing, Shanti Sadan CHS, Kothrud, Pune - 411038',
  nominationDate: '18/04/2012',
  cessationDate: '',
  cessationReason: '',
  remarks: 'Original share cert holder, Flat allotted in Phase-I',
  sharesHeld: [
    { date: '12/04/2012', cashBookFolio: '45', application: '500', allotment: '500', firstCall: '1000', secondCall: '1000', totalReceived: '3000', numberOfShares: '10', shareCertificateNumber: '104' },
    { date: '15/10/2015', cashBookFolio: '82', application: '250', allotment: '250', firstCall: '500', secondCall: '500', totalReceived: '1500', numberOfShares: '5', shareCertificateNumber: '142' }
  ],
  sharesTransferred: [
    { date: '20/09/2021', cashBookFolio: '112', transferDate: '24/09/2021', transferFolioOrRegisterNo: 'TR-18', shareCertificateRef: '142', sharesTransferredOrRefunded: '5', balanceShares: '10', balanceCertificateNo: '104', amount: '1500' }
  ]
};

/* -------------------- Date Formatting Helper -------------------- */

function formatDateDMY(raw) {
  if (!raw) return '';
  // Already DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(String(raw))) return String(raw);
  // ISO format YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  var isoMatch = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[3] + '/' + isoMatch[2] + '/' + isoMatch[1];
  // Excel serial number (numeric)
  if (typeof raw === 'number' && raw > 20000) {
    var excelEpoch = new Date(1900, 0, 1);
    var d = new Date(excelEpoch.getTime() + (raw - 2) * 86400000);
    var dd = String(d.getDate()).padStart(2, '0');
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var yyyy = d.getFullYear();
    return dd + '/' + mm + '/' + yyyy;
  }
  return String(raw);
}

/* -------------------- Public API Exports -------------------- */

if (typeof window !== 'undefined') {
  window.blankMemberData = blankMemberData;
  window.defaultConfig = defaultConfig;
  window.renderFormI = renderFormI;
  window.getFormIData = getFormIData;
  window.setOrientation = setOrientation;
  window.SAMPLE_MEMBER_DATA_FOR_TESTING = SAMPLE_MEMBER_DATA_FOR_TESTING;
  window.formatDateDMY = formatDateDMY;
}

// Dynamic Electron integration — receives INIT_TEMPLATE from PrintPdfService
window.addEventListener('message', function (event) {
  var msg = event.data;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'INIT_TEMPLATE') {
    var record = msg.record || {};
    var config = msg.config || {};

    // Build sharesHeld from member's share data (single row from the core record fields)
    var sharesHeld = [];
    if (record.share_count || record.share_value || record.share_certificate_number) {
      sharesHeld = [{
        date: formatDateDMY(record.date_of_admission || record.entrance_fee_date || ''),
        cashBookFolio: record.cash_book_folio || '01',
        application: record.share_application_amount || '',
        allotment: record.share_allotment_amount || '',
        firstCall: record.share_first_call || '',
        secondCall: record.share_second_call || '',
        totalReceived: record.share_value ? String(record.share_value) : '',
        numberOfShares: record.share_count ? String(record.share_count) : '',
        shareCertificateNumber: record.share_certificate_number || ''
      }];
    }

    // Build sharesTransferred from member's transfer data if present
    var sharesTransferred = [];
    if (record.shares_transferred) {
      try {
        var parsed = typeof record.shares_transferred === 'string'
          ? JSON.parse(record.shares_transferred)
          : record.shares_transferred;
        if (Array.isArray(parsed)) {
          sharesTransferred = parsed.map(function(t) {
            return {
              date: formatDateDMY(t.date || ''),
              cashBookFolio: t.cashBookFolio || t.cash_book_folio || '',
              transferDate: formatDateDMY(t.transferDate || t.transfer_date || ''),
              transferFolioOrRegisterNo: t.transferFolioOrRegisterNo || t.transfer_register_number || '',
              shareCertificateRef: t.shareCertificateRef || t.share_certificate_number || '',
              sharesTransferredOrRefunded: t.sharesTransferredOrRefunded || t.shares_transferred_or_refunded || '',
              balanceShares: t.balanceShares || t.balance_shares_held || '',
              balanceCertificateNo: t.balanceCertificateNo || t.balance_share_certificate_number || '',
              amount: t.amount || t.amount_rs || ''
            };
          });
        }
      } catch(e) {}
    }

    var data = {
      id: record.id,
      pageNumber: record.page_number || '1',
      serialNumber: record.serial_number || '',
      admissionDate: formatDateDMY(record.date_of_admission || ''),
      entranceFeeDate: formatDateDMY(record.entrance_fee_date || ''),
      fullName: record.full_name || '',
      permanentAddress: record.permanent_address || '',
      residentialAddress: record.address || record.residential_address || '',
      occupation: record.occupation || '',
      age: record.age ? String(record.age) : '',
      nomineeName: record.nominee_name || '',
      nomineeAddress: record.nominee_address || '',
      nominationDate: formatDateDMY(record.date_of_nomination || ''),
      cessationDate: formatDateDMY(record.date_of_cessation || ''),
      cessationReason: record.reason_for_cessation || '',
      remarks: record.remarks || '',
      sharesHeld: sharesHeld,
      sharesTransferred: sharesTransferred
    };

    var renderConfig = {
      orientation: (config.appearance && config.appearance.orientation) || 'landscape',
      margin: ((config.appearance && config.appearance.margin) || 12) + 'mm',
      fontSize: ((config.appearance && config.appearance.fontSize) || 10) + 'pt',
      lineWeight: (config.appearance && config.appearance.lineWeight) || 1.0,
      printScale: (config.appearance && config.appearance.scale) || 100,
      accentColor: (config.colors && config.colors.primary) || '#2F4157'
    };

    if (config.colors) {
      var root = document.documentElement;
      root.style.setProperty('--blue', config.colors.primary || '#2F4157');
      root.style.setProperty('--spine-blue', config.colors.primary || '#2F4157');
      root.style.setProperty('--page-bg', config.colors.paperBg || '#E3ECF2');
      root.style.setProperty('--ink-grid', config.colors.border || '#567C8E');
      root.style.setProperty('--ink-hand', config.colors.text || '#1C2A3A');
    }

    // Hide control bar during PDF rendering (only shows in browser/preview)
    var controlBar = document.querySelector('.control-bar');
    if (controlBar) controlBar.style.display = 'none';

    renderFormI(data, renderConfig);
  }
});

