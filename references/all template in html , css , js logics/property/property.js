/* ==========================================================================
   HLABS FILING — Records Management
   FORM 'PROP' — Property Register — JavaScript controller
   ========================================================================== */

var propertyRecords = [];

var defaultConfig = {
  societyName: 'SHANTI SADAN CO-OPERATIVE HOUSING SOCIETY LTD.',
  orientation: 'portrait',
  margin: '12mm',
  fontSize: '10pt',
  rowHeightMm: 25,
  lineWeight: 1.0,
  printScale: 100,
  accentColor: '#2F4157',
  minBlankRows: 6,
  rowsPerPage: 12
};

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  if (out.length === 0) out.push([]);
  return out;
}

// Columns definition for data-field targeting
const PROP_COLUMNS = [
  { key: 'serialNumber',      cls: 'cell-sr' },
  { key: 'memberName',        cls: 'cell-name' },
  { key: 'possessionDate',    cls: 'cell-possession' },
  { key: 'flatNumber',        cls: 'cell-flat' },
  { key: 'floor',             cls: 'cell-floor' },
  { key: 'description',       cls: 'cell-desc' },
  { key: 'area',              cls: 'cell-area' },
  { key: 'landCost',          cls: 'cell-land' },
  { key: 'constructionCost',  cls: 'cell-const' },
  { key: 'annualGroundRent',  cls: 'cell-rent' },
  { key: 'cessationDate',     cls: 'cell-cessation' },
  { key: 'signature',         cls: 'cell-signature' },
  { key: 'remarks',           cls: 'cell-remarks' }
];

function buildRowHtml(record, indexInDataset) {
  let html = `<tr class="record-row" data-id="rec-${indexInDataset}">`;
  PROP_COLUMNS.forEach(c => {
    let rawVal = record[c.key] || '';
    if (c.key === 'serialNumber' && !rawVal) {
      rawVal = String(indexInDataset + 1).padStart(2, '0');
    }
    // format newlines to br for rendering
    let displayVal = escapeHtml(rawVal).replace(/\n/g, '<br>');
    html += `<td class="${c.cls}" data-field="${c.key}" contenteditable="true">${displayVal}</td>`;
  });
  html += `</tr>`;
  return html;
}

function buildBlankRowHtml(pageIndex, blankIndex) {
  let html = `<tr class="blank-row" data-id="blank-${pageIndex}-${blankIndex}">`;
  PROP_COLUMNS.forEach(c => {
    html += `<td class="${c.cls}" data-field="${c.key}" contenteditable="true">&nbsp;</td>`;
  });
  html += `</tr>`;
  return html;
}

function buildPageHtml(pageIndex, pageCount, rowsHtml, config) {
  return `
    <section class="register-page orientation-${config.orientation}" data-page="${pageIndex + 1}">
      
      <!-- Corner Page Number -->
      <div class="page-no-wrap">
        <span class="page-no-label">Page No.</span>
        <input type="text" class="page-no-val" data-page-idx="${pageIndex}" value="${pageIndex + 1}" oninput="updatePageBadge(this)" />
      </div>

      <header class="doc-header">
        <div class="doc-header-top no-print" style="margin-bottom: 6px;">
          <span>FORM PROP / नमुना मालमत्ता नोंदवही</span>
          <span>[See MCS Act Section 38(1)] / [सहकार कायदा कलम ३८(१) पहा]</span>
        </div>
        <h1 class="doc-title">
          <span class="title-word">PROPERTY</span>
          <span class="title-word">REGISTER</span>
        </h1>
      </header>

      <div class="society-line">
        <span class="society-label">NAME OF SOCIETY :</span>
        <span class="society-underline" contenteditable="true" data-field="societyName" oninput="updateSocietyName(this.innerText)">${escapeHtml(config.societyName)}</span>
      </div>

      <div class="property-table-wrap">
        <table class="property-table">
          <colgroup>
            <col class="col-sr">
            <col class="col-name">
            <col class="col-possession">
            <col class="col-flat">
            <col class="col-floor">
            <col class="col-desc">
            <col class="col-area">
            <col class="col-land">
            <col class="col-const">
            <col class="col-rent">
            <col class="col-cessation">
            <col class="col-signature">
            <col class="col-remarks">
          </colgroup>

          <thead>
            <tr class="head-row-1">
              <th rowspan="2" class="th-sr">Sr.<br>No.</th>
              <th rowspan="2" class="th-name">Name of Co-partner Member</th>
              <th rowspan="2" class="th-possession">Date of<br>Possession</th>
              <th colspan="2" class="th-group">Distinguishing<br>No. of Tenement</th>
              <th rowspan="2" class="th-desc">Description of<br>Tenement</th>
              <th rowspan="2" class="th-area">Area of<br>Tenement</th>
              <th colspan="2" class="th-group">Cost of the Tenement</th>
              <th rowspan="2" class="th-rent">Annual<br>Ground<br>Rent&nbsp;Rs.</th>
              <th rowspan="2" class="th-cessation">Date of<br>Cessation of<br>Membership</th>
              <th rowspan="2" class="th-signature">Signature<br>Chairman /<br>Hon.&nbsp;Secretary</th>
              <th rowspan="2" class="th-remarks">Remarks<br><span class="th-sub">(Reason of Cessation / Transfer<br>to&nbsp;Sr.&nbsp;No.&nbsp;and&nbsp;Date)</span></th>
            </tr>
            <tr class="head-row-2">
              <th class="th-sub-col">Flat No.</th>
              <th class="th-sub-col">Floor</th>
              <th class="th-sub-col">Land<br>Rs.</th>
              <th class="th-sub-col">Const.<br>Rs.</th>
            </tr>
          </thead>

          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <div class="page-footer">
        <span class="app-tag">HLABS FILING System</span>
        <span class="page-count-footer">Sheet ${pageIndex + 1} of ${pageCount}</span>
      </div>

    </section>
  `;
}

function updateSocietyName(name) {
  defaultConfig.societyName = name;
  document.querySelectorAll('[data-field="societyName"]').forEach(el => {
    if (el.innerText !== name) el.innerText = name;
  });
}

function updatePageBadge(inputEl) {
  // Let the user edit the sheet corner number
  const val = inputEl.value;
  const pageIdx = parseInt(inputEl.getAttribute('data-page-idx'), 10);
  console.log("Page updated: idx=" + pageIdx + " val=" + val);
}

function applyRuntimeVars(config) {
  const root = document.documentElement;
  root.style.setProperty("--blue", config.accentColor);
  root.style.setProperty("--spine-blue", config.accentColor);
  root.style.setProperty("--line-thickness", config.lineWeight + "px");
  root.style.setProperty("--font-size", config.fontSize);
  root.style.setProperty("--row-height", config.rowHeightMm + "mm");
  root.style.setProperty("--margin", config.margin);

  let scaleTag = document.getElementById("prop-print-scale");
  if (!scaleTag) {
    scaleTag = document.createElement("style");
    scaleTag.id = "prop-print-scale";
    document.head.appendChild(scaleTag);
  }
  const scale = (config.printScale || 100) / 100;
  scaleTag.textContent = `
    @media print {
      .register-page { transform: scale(${scale}); transform-origin: top left; }
    }
  `;
}

function setOrientation(orientation, config) {
  config = config || defaultConfig;
  const isLandscape = orientation === 'landscape';
  document.body.classList.toggle('orientation-landscape', isLandscape);
  document.body.classList.toggle('orientation-portrait', !isLandscape);

  let styleTag = document.getElementById('prop-page-size');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'prop-page-size';
    document.head.appendChild(styleTag);
  }
  const size = isLandscape ? 'A4 landscape' : 'A4 portrait';
  const margin = config.margin || defaultConfig.margin;
  styleTag.textContent = `@page { size: ${size}; margin: 0; } .register-page { padding: ${margin} ${margin} ${margin} calc(${margin} + var(--spine-width)) !important; }`;
}

function renderPropertyRegister(data, config) {
  config = Object.assign({}, defaultConfig, config || {});
  propertyRecords = Array.isArray(data) ? data : [];
  const rowsPerPage = Math.max(1, config.rowsPerPage || 12);

  applyRuntimeVars(config);
  setOrientation(config.orientation, config);

  const pages = propertyRecords.length > 0
    ? chunk(propertyRecords.map((r, i) => ({ r, i })), rowsPerPage)
    : [[]];

  const pageCount = pages.length;
  let html = "";

  pages.forEach((pageRows, pageIndex) => {
    let rowsHtml = "";
    pageRows.forEach(({ r, i }) => {
      rowsHtml += buildRowHtml(r, i);
    });

    // Pad blank rows to complete ledger grid height
    var blanksNeeded = rowsPerPage - pageRows.length;
    for (var b = 0; b < blanksNeeded; b++) {
      rowsHtml += buildBlankRowHtml(pageIndex, b);
    }

    html += buildPageHtml(pageIndex, pageCount, rowsHtml, config);
  });

  const rootEl = document.getElementById("register-root");
  rootEl.innerHTML = html;

  // Bind editable input cell handlers (WYSIWYG edits)
  bindEditableCells();
  renderSidebarList();
}

function bindEditableCells() {
  document.querySelectorAll('#register-root td[data-field]').forEach(td => {
    td.addEventListener('input', function() {
      const tr = this.closest('tr');
      const id = tr.getAttribute('data-id');
      const field = this.getAttribute('data-field');
      const textVal = this.innerHTML.replace(/<br>/g, '\n').replace(/<div>/g, '\n').replace(/<\/div>/g, '');

      if (id.startsWith('blank-')) {
        // Automatically instantiate record when typing inside ruled blank lines
        const newIdx = propertyRecords.length;
        const newRec = {
          serialNumber: String(newIdx + 1).padStart(2, '0'),
          memberName: '',
          possessionDate: '',
          flatNumber: '',
          floor: '',
          description: '',
          area: '',
          landCost: '',
          constructionCost: '',
          annualGroundRent: '',
          cessationDate: '',
          signature: '',
          remarks: ''
        };
        newRec[field] = textVal;
        propertyRecords.push(newRec);

        // Convert page row to record layout
        tr.setAttribute('data-id', 'rec-' + newIdx);
        renderSidebarList();
      } else if (id.startsWith('rec-')) {
        const idx = parseInt(id.split('-')[1], 10);
        if (propertyRecords[idx]) {
          propertyRecords[idx][field] = textVal;
        }
        renderSidebarList();
      }
    });
  });
}

function renderSidebarList() {
  const list = document.getElementById('recordList');
  if (!list) return;
  if (propertyRecords.length === 0) {
    list.innerHTML = `<div style="color:#93a2b0;font-size:12px;padding:4px;">No records — blank register sheet.</div>`;
    return;
  }
  list.innerHTML = propertyRecords.map((r, idx) => `
    <div class="hf-record-row">
      <span class="sr">${escapeHtml(r.serialNumber) || (idx + 1)}</span>
      <span class="nm">${escapeHtml(r.memberName) || '(unnamed)'}</span>
      <button onclick="duplicatePropertyRecord(${idx})" title="Duplicate">⧉</button>
      <button onclick="deletePropertyRecord(${idx})" title="Delete">✕</button>
    </div>
  `).join('');
}

function addPropertyRecord() {
  propertyRecords.push({
    serialNumber: String(propertyRecords.length + 1).padStart(2, '0'),
    memberName: '',
    possessionDate: '',
    flatNumber: '',
    floor: '',
    description: 'Residential Tenement Flat',
    area: '',
    landCost: '',
    constructionCost: '',
    annualGroundRent: '',
    cessationDate: '',
    signature: '',
    remarks: ''
  });
  hfSyncAndRender();
}

function deletePropertyRecord(idx) {
  propertyRecords.splice(idx, 1);
  hfSyncAndRender();
}

function duplicatePropertyRecord(idx) {
  const copy = Object.assign({}, propertyRecords[idx]);
  copy.serialNumber = String(propertyRecords.length + 1).padStart(2, '0');
  propertyRecords.splice(idx + 1, 0, copy);
  hfSyncAndRender();
}

function loadSampleData() {
  const samples = [
    {
      serialNumber: "01",
      memberName: "ARVIND RAMCHANDRA KALE",
      possessionDate: "12/04/2012",
      flatNumber: "502",
      floor: "5th",
      description: "Residential Tenement Flat",
      area: "850 sq.ft.",
      landCost: "4,50,000",
      constructionCost: "18,50,000",
      annualGroundRent: "120",
      cessationDate: "",
      signature: "",
      remarks: "Allotted in Phase-I construction"
    },
    {
      serialNumber: "02",
      memberName: "SURESH NARAYAN KULKARNI",
      possessionDate: "14/06/1985",
      flatNumber: "12",
      floor: "1st",
      description: "Residential Tenement Flat",
      area: "650 sq.ft.",
      landCost: "80,000",
      constructionCost: "2,40,000",
      annualGroundRent: "80",
      cessationDate: "",
      signature: "",
      remarks: "Original co-partner member"
    },
    {
      serialNumber: "03",
      memberName: "MEENAKSHI SHRIPAD JOSHI",
      possessionDate: "10/11/2016",
      flatNumber: "201",
      floor: "2nd",
      description: "Residential Tenement Flat",
      area: "900 sq.ft.",
      landCost: "5,00,000",
      constructionCost: "22,00,000",
      annualGroundRent: "150",
      cessationDate: "",
      signature: "",
      remarks: "Transferred from previous owner"
    }
  ];
  propertyRecords = samples;
  hfSyncAndRender();
}

function clearAllRecords() {
  propertyRecords = [];
  hfSyncAndRender();
}

function hfSyncAndRender() {
  const config = {
    societyName: defaultConfig.societyName,
    orientation: document.getElementById('cfgOrientation').value,
    fontSize: document.getElementById('cfgFontSize').value + 'pt',
    lineWeight: parseFloat(document.getElementById('cfgLineThickness').value),
    rowHeightMm: parseInt(document.getElementById('cfgRowHeight').value, 10),
    margin: document.getElementById('cfgMargin').value + 'mm',
    printScale: parseInt(document.getElementById('cfgScale').value, 10),
    accentColor: document.getElementById('cfgBlueColor').value,
    rowsPerPage: parseInt(document.getElementById('cfgRowsPerPage').value, 10)
  };
  renderPropertyRegister(propertyRecords, config);
}

function hfApplyConfig() {
  hfSyncAndRender();
}

// Expose public API
if (typeof window !== 'undefined') {
  window.renderPropertyRegister = renderPropertyRegister;
  window.propertyRecords = propertyRecords;
  window.defaultConfig = defaultConfig;
  window.addPropertyRecord = addPropertyRecord;
  window.deletePropertyRecord = deletePropertyRecord;
  window.duplicatePropertyRecord = duplicatePropertyRecord;
  window.loadSampleData = loadSampleData;
  window.clearAllRecords = clearAllRecords;
  window.hfApplyConfig = hfApplyConfig;
}

// Dynamic Electron integration
window.addEventListener('message', function (event) {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'INIT_TEMPLATE') {
    const records = msg.records || [];
    const config = msg.config || {};
    
    const formatted = records.map((m, idx) => ({
      id: m.id,
      serialNumber: m.serial_number || String(idx + 1).padStart(2, '0'),
      memberName: m.full_name || '',
      possessionDate: m.date_of_admission || '',
      flatNumber: m.flat_number || '',
      floor: m.floor || '',
      description: m.property_information || 'Residential Tenement Flat',
      area: m.occupation || '',
      landCost: m.share_certificate_number || '',
      constructionCost: m.share_value || '',
      annualGroundRent: m.share_count || '',
      cessationDate: m.date_of_cessation || '',
      signature: '',
      remarks: m.remarks || ''
    }));

    propertyRecords = formatted;

    const renderConfig = {
      societyName: config.appName || 'HLabs filing',
      orientation: config.appearance?.orientation || 'landscape',
      fontSize: (config.appearance?.fontSize || 10) + 'pt',
      lineWeight: config.appearance?.lineWeight || 1.0,
      rowHeightMm: config.appearance?.rowHeight || 25,
      margin: (config.appearance?.margin || 12) + 'mm',
      printScale: config.appearance?.scale || 100,
      accentColor: config.colors?.primary || '#2F4157',
      rowsPerPage: config.appearance?.rowsPerPage || 8
    };

    if (config.colors) {
      const root = document.documentElement;
      root.style.setProperty('--blue', config.colors.primary);
      root.style.setProperty('--spine-blue', config.colors.primary);
      root.style.setProperty('--page-bg', config.colors.paperBg || '#E3ECF2');
      root.style.setProperty('--ink-grid', config.colors.border || '#567C8E');
      root.style.setProperty('--ink-hand', config.colors.text || '#1C2A3A');
    }

    renderPropertyRegister(propertyRecords, renderConfig);
    renderSidebarList();
  }
});
