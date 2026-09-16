let knowledgeData = window.HENU_KNOWLEDGE_BASE || null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!knowledgeData) {
    try {
      const res = await fetch('data/knowledge-base.json');
      knowledgeData = await res.json();
    } catch (err) {
      console.warn('Local file fetch prevented, relying on bundled knowledge base:', err);
    }
  }
  if (knowledgeData) {
    initDocs();
  }
});

function initDocs() {
  const navItems = document.querySelectorAll('.docs-nav-item');
  const searchInput = document.getElementById('docs-search');

  // Navigation Click Handler
  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      const targetId = item.getAttribute('data-target');
      renderDocSection(targetId);
    });
  });

  // Live Instant Search
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        renderDocSection('getting-started');
        return;
      }
      performSearch(q);
    });
  }

  // Initial Render
  renderDocSection('getting-started');
}

function renderDocSection(sectionId) {
  const container = document.getElementById('docs-viewer');
  if (!container || !knowledgeData) return;

  if (sectionId === 'getting-started') {
    container.innerHTML = `
      <div class="docs-article-header">
        <span class="badge badge-emerald">Getting Started</span>
        <h1>Overview & Quick Start Guide</h1>
        <div class="docs-meta-bar">
          <span>Applies to: HENU OS v1.0.0+</span>
          <span>•</span>
          <span>Architecture: 100% Local-First Offline</span>
        </div>
      </div>
      <div class="docs-body">
        <p><strong>HENU OS Records Management</strong> is a local-first enterprise desktop filing system engineered to automate the preparation, validation, and generation of statutory cooperative society registers, certificates, and vouchers.</p>
        
        <h2>Step-by-Step Quick Start Workflow</h2>
        <div style="display: flex; flex-direction: column; gap: 16px; margin: 24px 0;">
          <div class="docs-callout">
            <strong>1. Workspace Creation:</strong> Create your society profile under Society Management with legal name, registration number, date, and upload your high-resolution society logo.
          </div>
          <div class="docs-callout">
            <strong>2. Master Template Download:</strong> In Master Data, click <em>'Download Master Template'</em> to obtain the canonical 8-sheet Excel workbook.
          </div>
          <div class="docs-callout">
            <strong>3. Member Record Population:</strong> Enter member details in <code>COMMON_FILE</code>, ensuring unique serial numbers (<code>001</code>, <code>002</code>), distinctive share ranges, and flat numbers.
          </div>
          <div class="docs-callout">
            <strong>4. Automated Ingestion & Validation:</strong> Upload the populated workbook. HENU OS automatically scans for <code>ERR_001</code> to <code>ERR_009</code> and unlocks Foundation Gates 1 & 2.
          </div>
          <div class="docs-callout">
            <strong>5. Live PDF Generation & Export:</strong> In Generate Forms, select any register (Form I, Form J, Share, etc.), choose your serial number range, preview the layout, and export to PDF/ZIP.
          </div>
        </div>

        <div class="docs-callout" style="border-left-color: var(--accent-cyan); background: rgba(6, 182, 212, 0.08);">
          <strong>🔒 100% Local Privacy:</strong> All database stores reside strictly on your local PC in <code>%APPDATA%\\HENU_OS_Records\\</code>. No member data or documents are uploaded to cloud servers.
        </div>
      </div>
    `;
    return;
  }

  if (sectionId === 'storage-paths') {
    const mod = knowledgeData.modules.find(m => m.id === 'storage-paths');
    container.innerHTML = `
      <div class="docs-article-header">
        <span class="badge">System Architecture</span>
        <h1>Storage & AppData Paths</h1>
      </div>
      <div class="docs-body">
        <p>${mod.description}</p>
        <h2>Local File System Structure</h2>
        <table class="docs-table">
          <tr><th>Component</th><th>Absolute Windows Path</th></tr>
          <tr><td><strong>Production Database</strong></td><td><code>%APPDATA%\\HENU_OS_Records\\database\\henu-os-store.json</code></td></tr>
          <tr><td><strong>Automatic Backups</strong></td><td><code>%APPDATA%\\HENU_OS_Records\\database\\henu-os-store.backup.json</code></td></tr>
          <tr><td><strong>Temporary PDF Buffer</strong></td><td><code>%APPDATA%\\HENU_OS_Records\\temp\\</code></td></tr>
          <tr><td><strong>Generated ZIP Archives</strong></td><td><code>%USERPROFILE%\\Downloads\\HENU_OS\\ZIP\\</code></td></tr>
          <tr><td><strong>Downloaded Templates</strong></td><td><code>%USERPROFILE%\\Downloads\\HENU_OS\\Templates\\</code></td></tr>
        </table>
      </div>
    `;
    return;
  }

  if (sectionId === 'troubleshooting') {
    const mod = knowledgeData.modules.find(m => m.id === 'troubleshooting');
    let html = `
      <div class="docs-article-header">
        <span class="badge" style="background: rgba(244, 63, 94, 0.15); color: #fb7185; border-color: rgba(244, 63, 94, 0.3);">Diagnosis & Recovery</span>
        <h1>Troubleshooting & Issue Resolution Guide</h1>
        <div class="docs-meta-bar">
          <span>Complete operational and database recovery procedures</span>
        </div>
      </div>
      <div class="docs-body">
        <p>${mod.description}</p>
        <h2>Common Issues & Step-by-Step Fixes</h2>
    `;

    mod.issues.forEach((item, idx) => {
      html += `
        <div class="docs-callout docs-callout-warning" style="margin-bottom: 24px;">
          <h3 style="color: #ffffff; margin-bottom: 8px;">⚠️ ${idx + 1}. ${item.issue}</h3>
          <p><strong>Underlying Cause:</strong> ${item.cause}</p>
          <div style="margin-top: 10px; padding: 10px 14px; background: rgba(0,0,0,0.3); border-radius: 6px;">
            <strong>🔧 Step-by-Step Solution:</strong> ${item.solution}
          </div>
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;
    return;
  }

  if (sectionId === 'faq') {
    let faqHtml = `
      <div class="docs-article-header">
        <span class="badge">Support & Help</span>
        <h1>Frequently Asked Questions</h1>
      </div>
      <div class="docs-body">
    `;
    knowledgeData.faq.forEach((f, idx) => {
      faqHtml += `
        <div class="docs-callout" style="margin-bottom: 20px;">
          <h3>Q${idx + 1}: ${f.question}</h3>
          <p style="margin-top: 8px;">${f.answer}</p>
        </div>
      `;
    });
    faqHtml += '</div>';
    container.innerHTML = faqHtml;
    return;
  }

  // Find module in knowledge base
  const mod = knowledgeData.modules.find(m => m.id === sectionId);
  if (mod) {
    let html = `
      <div class="docs-article-header">
        <span class="badge">${mod.category}</span>
        <h1>${mod.name}</h1>
        <div class="docs-meta-bar">
          <span>Module ID: <code>${mod.id}</code></span>
        </div>
      </div>
      <div class="docs-body">
        <p>${mod.description}</p>
    `;

    if (mod.steps) {
      html += '<h2>Step-by-Step User Instructions</h2><ol>';
      mod.steps.forEach(s => { html += `<li style="margin-bottom: 10px;">${s}</li>`; });
      html += '</ol>';
    }

    if (mod.sheets) {
      html += '<h2>Statutory Excel Sheets Specification</h2><ul>';
      mod.sheets.forEach(s => { html += `<li><code>${s.split(':')[0]}</code>: ${s.split(':')[1]}</li>`; });
      html += '</ul>';
    }

    if (mod.validationRules) {
      html += '<h2>Built-In Validation Codes</h2><ul>';
      mod.validationRules.forEach(r => { html += `<li><strong>${r.split(':')[0]}</strong>: ${r.split(':')[1]}</li>`; });
      html += '</ul>';
    }

    if (mod.gates) {
      html += '<h2>Foundation Gate Protocol</h2><ul>';
      mod.gates.forEach(g => { html += `<li>${g}</li>`; });
      html += '</ul>';
    }

    if (mod.options) {
      html += '<h2>Configuration Options</h2><ul>';
      mod.options.forEach(o => { html += `<li>${o}</li>`; });
      html += '</ul>';
    }

    if (mod.paper && mod.layout) {
      html += `
        <h2>Print & Layout Specifications</h2>
        <table class="docs-table">
          <tr><th>Paper Size</th><td>${mod.paper}</td></tr>
          <tr><th>Layout Configuration</th><td>${mod.layout}</td></tr>
        </table>
      `;
    }

    html += '</div>';
    container.innerHTML = html;
  }
}

function performSearch(query) {
  const container = document.getElementById('docs-viewer');
  if (!container || !knowledgeData) return;

  const matchedModules = knowledgeData.modules.filter(m =>
    m.name.toLowerCase().includes(query) ||
    m.description.toLowerCase().includes(query) ||
    (m.steps && m.steps.some(s => s.toLowerCase().includes(query))) ||
    (m.issues && m.issues.some(i => i.issue.toLowerCase().includes(query) || i.solution.toLowerCase().includes(query)))
  );

  const matchedFaq = knowledgeData.faq.filter(f =>
    f.question.toLowerCase().includes(query) ||
    f.answer.toLowerCase().includes(query)
  );

  if (matchedModules.length === 0 && matchedFaq.length === 0) {
    container.innerHTML = `
      <div class="docs-article-header">
        <h1>Search Results</h1>
      </div>
      <div class="docs-body">
        <p>No documentation found matching "<strong>${query}</strong>". Try asking the <strong>HENU AI Assistant</strong> in the bottom right corner or check the Troubleshooting guide.</p>
      </div>
    `;
    return;
  }

  let html = `
    <div class="docs-article-header">
      <h1>Search Results for "${query}"</h1>
      <p>Found ${matchedModules.length + matchedFaq.length} relevant articles and solutions</p>
    </div>
    <div class="docs-body">
  `;

  matchedModules.forEach(m => {
    html += `
      <div class="docs-callout" style="margin-bottom: 24px;">
        <h3>${m.name}</h3>
        <p>${m.description}</p>
        <button class="btn btn-secondary btn-sm" onclick="renderDocSection('${m.id}')" style="margin-top: 8px;">View Full Module Specs & Steps →</button>
      </div>
    `;
  });

  matchedFaq.forEach(f => {
    html += `
      <div class="docs-callout" style="border-left-color: var(--accent-cyan); margin-bottom: 24px;">
        <h3>${f.question}</h3>
        <p>${f.answer}</p>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}
