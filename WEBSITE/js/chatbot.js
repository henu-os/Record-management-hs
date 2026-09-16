let hAiKnowledge = window.HENU_KNOWLEDGE_BASE || null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!hAiKnowledge) {
    try {
      const res = await fetch('data/knowledge-base.json');
      hAiKnowledge = await res.json();
    } catch (err) {
      console.warn('Local file fetch prevented, relying on bundled knowledge base:', err);
    }
  }
  initChatbot();
});

function initChatbot() {
  // Inject Launcher & Window DOM if not already present
  if (!document.querySelector('.chatbot-launcher')) {
    const chatContainer = document.createElement('div');
    chatContainer.id = 'henu-ai-root';
    chatContainer.innerHTML = `
      <!-- Launcher Button -->
      <button class="chatbot-launcher" id="chat-launcher" aria-label="Open HENU AI Assistant">
        <div class="launcher-pulse"></div>
        <span>HENU AI</span>
      </button>

      <!-- Chat Modal Window -->
      <div class="chatbot-window" id="chat-window">
        <div class="chat-header">
          <div class="chat-header-info">
            <div class="chat-avatar">AI</div>
            <div class="chat-title-wrap">
              <h4>HENU AI Assistant</h4>
              <span>● Online • Step-by-Step & Troubleshooting</span>
            </div>
          </div>
          <button class="chat-close-btn" id="chat-close" title="Close Chat">✕</button>
        </div>

        <div class="chat-messages" id="chat-messages">
          <div class="chat-msg bot">
            <div class="msg-bubble">
              👋 Hello! I am <strong>HENU AI</strong>, your software guidance assistant for HENU OS Records Management.
              <br><br>
              I can answer questions about <strong>installation</strong>, <strong>setup and onboarding</strong>, <strong>Excel import errors</strong>, <strong>Form I/J generation</strong>, <strong>Share Certificates</strong>, <strong>PDF output</strong>, and <strong>all HENU OS software features</strong>. Ask anything related to the software and I will help.
            </div>
          </div>
        </div>

        <div class="chat-suggestions">
          <button class="suggestion-chip" data-query="How do I install HENU OS software?">💻 Install HENU OS</button>
          <button class="suggestion-chip" data-query="How do I solve Excel import errors?">🛠️ Fix Excel Errors</button>
          <button class="suggestion-chip" data-query="Step by step guide to setup society">🏢 Setup Society</button>
          <button class="suggestion-chip" data-query="How do I generate Form I?">📄 Generate Form I</button>
          <button class="suggestion-chip" data-query="Where are generated PDFs saved?">📁 PDF Save Location</button>
        </div>

        <div class="chat-input-bar">
          <input type="text" class="chat-input" id="chat-input" placeholder="Ask about step-by-step setup, errors, forms..." />
          <button class="chat-send-btn" id="chat-send" title="Send Message">➤</button>
        </div>
      </div>
    `;
    document.body.appendChild(chatContainer);
  }

  const launcher = document.getElementById('chat-launcher');
  const windowEl = document.getElementById('chat-window');
  const closeBtn = document.getElementById('chat-close');
  const inputEl = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const messagesEl = document.getElementById('chat-messages');

  // Toggle Window
  launcher.addEventListener('click', () => {
    windowEl.classList.toggle('open');
    if (windowEl.classList.contains('open')) {
      inputEl.focus();
    }
  });

  closeBtn.addEventListener('click', () => {
    windowEl.classList.remove('open');
  });

  // Suggestion Chips
  document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.getAttribute('data-query');
      handleUserMessage(q);
    });
  });

  // Send Message Handlers
  sendBtn.addEventListener('click', () => {
    const q = inputEl.value.trim();
    if (q) {
      handleUserMessage(q);
      inputEl.value = '';
    }
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = inputEl.value.trim();
      if (q) {
        handleUserMessage(q);
        inputEl.value = '';
      }
    }
  });

  function handleUserMessage(query) {
    appendMessage(query, 'user');
    showTypingIndicator();

    setTimeout(() => {
      removeTypingIndicator();
      const answer = generateAnswer(query);
      appendMessage(answer.text, 'bot', answer.related);
    }, 450);
  }

  function appendMessage(text, sender, related = null) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${sender}`;

    let html = `<div class="msg-bubble">${text}</div>`;
    if (related) {
      html += `<div class="msg-related">📖 <strong>Related:</strong> <a href="${related.url}">${related.title}</a></div>`;
    }

    msgDiv.innerHTML = html;
    messagesEl.appendChild(msgDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTypingIndicator() {
    const typing = document.createElement('div');
    typing.id = 'chat-typing';
    typing.className = 'chat-msg bot';
    typing.innerHTML = `<div class="msg-bubble" style="opacity: 0.7; font-style: italic;">HENU AI is analyzing records manual...</div>`;
    messagesEl.appendChild(typing);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function removeTypingIndicator() {
    const typing = document.getElementById('chat-typing');
    if (typing) typing.remove();
  }

  function generateAnswer(query) {
    const q = query.toLowerCase();

    if (!hAiKnowledge) {
      return { text: "Knowledge base is still loading. Please ask again in a moment." };
    }

    // Direct Troubleshooting Issue Match
    const troubleMod = hAiKnowledge.modules.find(m => m.id === 'troubleshooting');
    if (troubleMod && troubleMod.issues) {
      const matchedIssue = troubleMod.issues.find(item =>
        item.issue.toLowerCase().split(' ').some(w => w.length > 4 && q.includes(w)) ||
        (q.includes('error') && (q.includes('excel') || q.includes('serial') || q.includes('percentage') || q.includes('gate')))
      );

      if (matchedIssue && (q.includes('fix') || q.includes('solve') || q.includes('issue') || q.includes('error') || q.includes('why') || q.includes('locked'))) {
        return {
          text: `<strong>Issue:</strong> ${matchedIssue.issue}<br><br><strong>Cause:</strong> ${matchedIssue.cause}<br><br><strong>🔧 Step-by-Step Fix:</strong> ${matchedIssue.solution}`,
          related: { title: 'Troubleshooting & Error Recovery Guide', url: 'documentation.html' }
        };
      }
    }

    // Direct FAQ match
    const faqMatch = hAiKnowledge.faq.find(f =>
      q.includes(f.question.toLowerCase().slice(0, 15)) ||
      f.question.toLowerCase().split(' ').some(w => w.length > 4 && q.includes(w))
    );

    if (faqMatch) {
      return {
        text: faqMatch.answer,
        related: { title: 'Documentation & FAQ', url: 'documentation.html' }
      };
    }

    // Step-by-step Society Setup Match
    if (q.includes('society') && (q.includes('create') || q.includes('setup') || q.includes('add') || q.includes('step'))) {
      const socMod = hAiKnowledge.modules.find(m => m.id === 'society-management');
      return {
        text: `<strong>Step-by-Step Society Setup:</strong><br><br>` +
              `1. Click <em>'Add Society'</em> in the top header or Dashboard.<br>` +
              `2. Fill in legal details: Society Name, Reg. No., Reg. Date, Address, and PIN.<br>` +
              `3. Upload high-DPI Society Logo (PNG/JPEG).<br>` +
              `4. Click <em>'Save Society'</em>. The active workspace updates immediately.`,
        related: { title: 'Society Management Specs', url: 'documentation.html' }
      };
    }

    // Master Excel & Sheets Match
    if (q.includes('excel') || q.includes('master') || q.includes('import') || q.includes('upload') || q.includes('sheet')) {
      return {
        text: `<strong>Master Data 8-Sheet Workbook Setup:</strong><br><br>` +
              `1. Download Master Template from Master Data.<br>` +
              `2. Ensure all 8 statutory sheets exist: <code>COMMON_FILE</code>, <code>FORM_I_DATA</code>, <code>FORM_J_DATA</code>, <code>SHARE_DATA</code>, <code>NOMINATION_DATA</code>, <code>PROPERTY_DATA</code>, and <code>BANK_LIEN_DATA</code>.<br>` +
              `3. Fill member rows with unique <code>srNo</code> (e.g. 001, 002) and upload.`,
        related: { title: 'Master Data & Sheets Guide', url: 'documentation.html' }
      };
    }

    // Foundation Gate Query
    if (q.includes('gate') || q.includes('foundation') || q.includes('locked')) {
      return {
        text: `<strong>Foundation Gates Protocol:</strong><br><br>` +
              `• <strong>Gate 1 (Society Master):</strong> Unlocks when society name, registration number, and address are filled.<br>` +
              `• <strong>Gate 2 (Member Master):</strong> Unlocks when <code>COMMON_FILE</code> has at least 1 validated member.<br>` +
              `• <strong>Gate 3 (Statutory Release):</strong> Once Gates 1 & 2 are validated, all register generation pipelines unlock automatically.`,
        related: { title: 'Control Center & Foundation Gates', url: 'documentation.html' }
      };
    }

    // Form I
    if (q.includes('form i') || q.includes('form-i') || q.includes('register of members')) {
      return {
        text: `<strong>Form I (Register of Members) Generation Steps:</strong><br><br>` +
              `1. Go to <em>Generate Forms</em> and select <strong>Form I</strong>.<br>` +
              `2. Enter <em>'From Serial'</em> (e.g. 001) and <em>'To Serial'</em> (e.g. 050).<br>` +
              `3. Select density (10–30 rows/page).<br>` +
              `4. Click <em>'Preview PDF'</em> to check layout, then click <em>'Generate & Export'</em> to create the ZIP bundle.`,
        related: { title: 'Form I Documentation', url: 'documentation.html' }
      };
    }

    // Share Certificate
    if (q.includes('share certificate') || q.includes('13x19') || q.includes('super a3')) {
      return {
        text: `<strong>Share Certificate (Super A3 13×19"):</strong><br><br>` +
              `• Engineered for professional press printing on <strong>330.2 × 482.6 mm</strong> paper.<br>` +
              `• Features ornate vector borders, Marathi/English bilingual typography, and dual signature blocks.<br>` +
              `• Set your printer scale to <strong>Actual Size (100%)</strong> to avoid margin clipping.`,
        related: { title: 'Share Certificate Specifications', url: 'documentation.html' }
      };
    }

    // Payment Voucher
    if (q.includes('voucher') || q.includes('payment voucher') || q.includes('legal')) {
      return {
        text: `<strong>Payment Voucher (US Legal 3-Up):</strong><br><br>` +
              `• Prints 3 identical vouchers on a single <strong>US Legal (8.5 × 14 inch)</strong> sheet.<br>` +
              `• Features automated amount-in-words converter, debit/credit notation, and perforated cutting guidelines.`,
        related: { title: 'Payment Voucher Specifications', url: 'documentation.html' }
      };
    }

    // File Storage Location
    if (q.includes('save') || q.includes('zip') || q.includes('download location') || q.includes('where')) {
      return {
        text: `<strong>Default Storage Locations:</strong><br><br>` +
              `• <strong>Generated ZIP Exports:</strong> <code>C:\\Users\\&lt;User&gt;\\Downloads\\HENU_OS\\ZIP\\</code><br>` +
              `• <strong>Local Database Store:</strong> <code>%APPDATA%\\HENU_OS_Records\\database\\henu-os-store.json</code>`,
        related: { title: 'Storage & AppData Paths', url: 'documentation.html' }
      };
    }

    // Default Fallback
    return {
      text: "I can help with HENU OS software setup, workflows, forms, troubleshooting, and output generation. Please view the full <a href='documentation.html'>Documentation & Troubleshooting Center</a> or submit an inquiry via the <a href='feedback.html'>Feedback Portal</a> for anything specific.",
      related: { title: 'Documentation Index', url: 'documentation.html' }
    };
  }
}
