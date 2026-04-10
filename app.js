/**
 * Password Migration Tool - Bitwarden to Proton Pass
 * All processing happens client-side for maximum security
 * @version 2.0.0
 */

/* ===================================
   CONSTANTS
   =================================== */
const CONSTANTS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  STORAGE_KEY_COMPLETED: 'completed_passkeys',
  CSV_HEADER: 'type,name,url,email,username,password,note,totp,createTime,modifyTime,vault',
  TOAST_DURATION: 5000,
  KEYBOARD_SHORTCUTS: {
    ESCAPE: 'Escape',
    ENTER: 'Enter'
  },
  CATEGORY_ICONS: {
    'Finance': '',
    'Tech': '',
    'Social': '',
    'Shopping': '',
    'Entertainment': '',
    'Productivity': '',
    'Education': '',
    'Travel': '',
    'Health': '',
    'News': '',
    'Utilities': '',
    'Government': '',
    'Other': ''
  }
};

/* ===================================
   CATEGORY MAPPING
   =================================== */
const CATEGORY_MAPPINGS = {
  // Finance & Banking
  'Finance': [
    'bankofamerica', 'chase', 'wellsfargo', 'citi', 'capitalone', 'usbank', 'pnc',
    'tdbank', 'ally', 'schwab', 'fidelity', 'vanguard', 'etrade', 'robinhood',
    'paypal', 'venmo', 'cashapp', 'stripe', 'square', 'coinbase', 'kraken',
    'binance', 'gemini', 'blockchain', 'mint', 'creditkarma', 'nerdwallet',
    'discover', 'amex', 'americanexpress', 'barclays', 'hsbc', 'santander',
    'boa.com', 'jpmorgan', 'goldmansachs', 'morganstanley', 'merrill'
  ],
  
  // Technology & Developer Tools
  'Tech': [
    'github', 'gitlab', 'bitbucket', 'stackoverflow', 'google', 'gmail',
    'aws', 'amazon', 'azure', 'microsoft', 'digitalocean', 'heroku', 'vercel',
    'netlify', 'cloudflare', 'firebase', 'mongodb', 'docker', 'kubernetes',
    'npm', 'pypi', 'apple', 'icloud', 'developer.apple', 'android',
    'openai', 'anthropic', 'huggingface', 'kaggle', 'colab', 'jupyter'
  ],
  
  // Social Media & Communication
  'Social': [
    'facebook', 'instagram', 'twitter', 'x.com', 'linkedin', 'reddit',
    'discord', 'slack', 'telegram', 'whatsapp', 'signal', 'messenger',
    'snapchat', 'tiktok', 'pinterest', 'tumblr', 'twitch', 'youtube',
    'vimeo', 'mastodon', 'bluesky', 'threads'
  ],
  
  // Shopping & E-commerce
  'Shopping': [
    'amazon', 'ebay', 'etsy', 'walmart', 'target', 'bestbuy', 'newegg',
    'aliexpress', 'alibaba', 'shopify', 'bigcartel', 'squarespace',
    'woocommerce', 'wayfair', 'ikea', 'homedepot', 'lowes', 'costco',
    'samsclub', 'macys', 'nordstrom', 'zappos', 'chewy', 'instacart'
  ],
  
  // Entertainment & Media
  'Entertainment': [
    'netflix', 'hulu', 'disneyplus', 'disney', 'hbomax', 'hbo', 'primevideo',
    'spotify', 'applemusic', 'pandora', 'soundcloud', 'deezer', 'tidal',
    'steam', 'epicgames', 'origin', 'uplay', 'gog', 'playstation', 'xbox',
    'nintendo', 'twitch', 'crunchyroll', 'funimation', 'audible', 'kindle'
  ],
  
  // Productivity & Work
  'Productivity': [
    'notion', 'evernote', 'onenote', 'todoist', 'trello', 'asana', 'jira',
    'confluence', 'monday', 'clickup', 'airtable', 'coda', 'dropbox', 'box',
    'onedrive', 'drive.google', 'docs.google', 'office365', 'zoom', 'teams',
    'webex', 'gotomeeting', 'calendly', 'doodle', 'figma', 'canva', 'adobe'
  ],
  
  // Education & Learning
  'Education': [
    'udemy', 'coursera', 'edx', 'khanacademy', 'duolingo', 'skillshare',
    'linkedin learning', 'pluralsight', 'codecademy', 'freecodecamp',
    'leetcode', 'hackerrank', 'brilliant', 'masterclass', 'canvas', 'blackboard',
    'moodle', 'schoology', 'edmodo', 'classlink', 'clever'
  ],
  
  // Travel & Transportation
  'Travel': [
    'airbnb', 'booking', 'expedia', 'hotels', 'marriott', 'hilton', 'hyatt',
    'uber', 'lyft', 'delta', 'united', 'american', 'southwest', 'jetblue',
    'tripadvisor', 'kayak', 'priceline', 'hotwire', 'vrbo', 'travelocity',
    'hertz', 'enterprise', 'avis', 'budget'
  ],
  
  // Health & Fitness
  'Health': [
    'myfitnesspal', 'fitbit', 'strava', 'peloton', 'nike', 'adidas',
    'garmin', 'whoop', 'headspace', 'calm', 'betterhelp', 'talkspace',
    'zocdoc', 'cvs', 'walgreens', 'rite aid', 'goodrx', 'webmd',
    'mayoclinic', 'healthline', 'teladoc', 'mdlive'
  ],
  
  // News & Information
  'News': [
    'nytimes', 'wsj', 'washingtonpost', 'reuters', 'bloomberg', 'cnn',
    'bbc', 'theguardian', 'forbes', 'techcrunch', 'wired', 'medium',
    'substack', 'pocket', 'flipboard', 'feedly', 'inoreader'
  ],
  
  // Utilities & Services
  'Utilities': [
    'att', 'verizon', 'tmobile', 'sprint', 'comcast', 'xfinity', 'spectrum',
    'cox', 'frontier', 'centurylink', 'usps', 'ups', 'fedex', 'dhl',
    'yelp', 'grubhub', 'doordash', 'ubereats', 'postmates', 'seamless'
  ],
  
  // Government & Legal
  'Government': [
    'irs.gov', 'ssa.gov', 'usajobs', 'dmv', 'usa.gov', 'whitehouse.gov',
    'fbi.gov', 'nasa.gov', 'uscis.gov', 'state.gov', 'ed.gov', 'va.gov'
  ]
};

/* ===================================
   STATE MANAGEMENT
   =================================== */
class AppState {
  constructor() {
    this.rawData = null;
    this.processedCSV = '';
    this.passkeys = [];
    this.completed = this.loadCompletedPasskeys();
    this.items = []; // Store processed items for category editing
    this.stats = {
      totalItems: 0,
      withPasswords: 0,
      withPasskeys: 0,
      withTOTP: 0,
      byCategory: {} // Track items per category
    };
  }

  loadCompletedPasskeys() {
    try {
      return JSON.parse(localStorage.getItem(CONSTANTS.STORAGE_KEY_COMPLETED) || '[]');
    } catch (error) {
      console.error('Failed to load completed passkeys:', error);
      return [];
    }
  }

  saveCompletedPasskeys() {
    try {
      localStorage.setItem(CONSTANTS.STORAGE_KEY_COMPLETED, JSON.stringify(this.completed));
    } catch (error) {
      console.error('Failed to save completed passkeys:', error);
      ToastManager.show('Failed to save progress', 'error');
    }
  }

  markPasskeyComplete(name) {
    if (!this.completed.includes(name)) {
      this.completed.push(name);
      this.saveCompletedPasskeys();
    }
  }

  reset() {
    this.rawData = null;
    this.processedCSV = '';
    this.passkeys = [];
    this.items = [];
    this.stats = {
      totalItems: 0,
      withPasswords: 0,
      withPasskeys: 0,
      withTOTP: 0,
      byCategory: {}
    };
  }

  updateItemCategory(itemIndex, newCategory) {
    if (this.items[itemIndex]) {
      const oldCategory = this.items[itemIndex].category;
      this.items[itemIndex].category = newCategory;
      
      // Update stats
      this.stats.byCategory[oldCategory]--;
      if (this.stats.byCategory[oldCategory] === 0) {
        delete this.stats.byCategory[oldCategory];
      }
      this.stats.byCategory[newCategory] = (this.stats.byCategory[newCategory] || 0) + 1;
    }
  }

  regenerateCSV() {
    const rows = [CONSTANTS.CSV_HEADER];
    
    this.items.forEach(item => {
      const row = [
        'login',
        item.name || '',
        item.url || '',
        item.username || '',
        item.username || '',
        item.password || '',
        item.note || '',
        item.totp || '',
        item.creationDate || '',
        item.revisionDate || '',
        item.category || 'Other'
      ].map(field => Utils.escapeCSV(field)).join(',');
      
      rows.push(row);
    });
    
    this.processedCSV = rows.join('\n');
  }
}

/* ===================================
   UTILITY FUNCTIONS
   =================================== */
const Utils = {
  /**
   * Sanitize text for safe display (prevent XSS)
   */
  sanitizeText(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Escape CSV field according to RFC 4180
   */
  escapeCSV(field) {
    if (field == null) return '';
    const stringField = String(field);
    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringField.includes('"') || stringField.includes(',') || stringField.includes('\n') || stringField.includes('\r')) {
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
  },

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  },

  /**
   * Validate file before processing
   */
  validateFile(file) {
    const errors = [];
    
    if (!file) {
      errors.push('No file selected');
      return errors;
    }

    if (file.size > CONSTANTS.MAX_FILE_SIZE) {
      errors.push(`File too large. Maximum size is ${this.formatFileSize(CONSTANTS.MAX_FILE_SIZE)}`);
    }

    if (!file.name.endsWith('.json')) {
      errors.push('File must be a JSON file');
    }

    return errors;
  },

  /**
   * Debounce function calls
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Extract domain from URL
   */
  extractDomain(url) {
    if (!url) return '';
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname.replace('www.', '').toLowerCase();
    } catch {
      return '';
    }
  },

  /**
   * Categorize URL based on domain
   */
  categorizeUrl(url) {
    if (!url) return 'Other';
    
    const domain = this.extractDomain(url);
    if (!domain) return 'Other';
    
    // Check each category
    for (const [category, keywords] of Object.entries(CATEGORY_MAPPINGS)) {
      for (const keyword of keywords) {
        if (domain.includes(keyword)) {
          return category;
        }
      }
    }
    
    return 'Other';
  }
};

/* ===================================
   TOAST NOTIFICATION SYSTEM
   =================================== */
class ToastManager {
  static container = document.getElementById('toastContainer');

  static show(message, type = 'info', duration = CONSTANTS.TOAST_DURATION) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'alert');

    const icons = {
      success: '✓',
      error: '✕',
      warning: 'Warning',
      info: 'Info'
    };

    toast.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${icons[type] || icons.info}</span>
      <span class="toast-message">${Utils.sanitizeText(message)}</span>
      <button class="toast-close" aria-label="Close notification">&times;</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => this.remove(toast));

    this.container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => this.remove(toast), duration);
    }

    return toast;
  }

  static remove(toast) {
    toast.style.animation = 'slideInRight 0.3s reverse';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  static success(message) {
    return this.show(message, 'success');
  }

  static error(message) {
    return this.show(message, 'error', 0); // Errors stay until dismissed
  }

  static warning(message) {
    return this.show(message, 'warning');
  }

  static info(message) {
    return this.show(message, 'info');
  }
}

/* ===================================
   DIALOG MANAGER
   =================================== */
class DialogManager {
  static overlay = document.getElementById('confirmDialog');
  static title = document.getElementById('dialog-title');
  static message = document.getElementById('dialog-message');
  static confirmBtn = document.getElementById('dialogConfirm');
  static cancelBtn = document.getElementById('dialogCancel');

  static show(title, message) {
    return new Promise((resolve) => {
      this.title.textContent = title;
      this.message.textContent = message;
      this.overlay.classList.remove('hidden');
      
      // Focus the dialog
      this.confirmBtn.focus();

      const handleConfirm = () => {
        this.hide();
        resolve(true);
      };

      const handleCancel = () => {
        this.hide();
        resolve(false);
      };

      const handleEscape = (e) => {
        if (e.key === CONSTANTS.KEYBOARD_SHORTCUTS.ESCAPE) {
          handleCancel();
        }
      };

      const cleanup = () => {
        document.removeEventListener('keydown', handleEscape);
      };

      this.confirmBtn.addEventListener('click', () => {
        cleanup();
        handleConfirm();
      }, { once: true });
      this.cancelBtn.addEventListener('click', () => {
        cleanup();
        handleCancel();
      }, { once: true });
      document.addEventListener('keydown', handleEscape, { once: true });
    });
  }

  static hide() {
    this.overlay.classList.add('hidden');
  }
}

/* ===================================
   LOADING OVERLAY
   =================================== */
class LoadingOverlay {
  static overlay = document.getElementById('loadingOverlay');

  static show() {
    this.overlay.classList.remove('hidden');
  }

  static hide() {
    this.overlay.classList.add('hidden');
  }
}

/* ===================================
   DATA PROCESSING
   =================================== */
class DataProcessor {
  /**
   * Extract URLs from Bitwarden URI array
   */
  static extractUrls(uris = []) {
    let main = '';
    const others = [];

    uris.forEach(u => {
      if (!u?.uri) return;

      if (u.uri.startsWith('http') && !main) {
        main = u.uri;
      } else {
        others.push(u.uri);
      }
    });

    return { main, others };
  }

  /**
   * Build comprehensive notes section
   */
  static buildNotes(item, extraUrls) {
    const sections = [];

    // Original notes
    if (item.notes) {
      sections.push(`--- ORIGINAL NOTES ---\n${item.notes}`);
    }

    // Custom fields
    if (item.fields?.length) {
      const fields = item.fields
        .map(f => `${f.name}: ${f.value}`)
        .join('\n');
      sections.push(`--- EXTRA FIELDS ---\n${fields}`);
    }

    // Password history
    if (item.passwordHistory?.length) {
      const history = item.passwordHistory
        .map(p => `${p.lastUsedDate || 'unknown'}: ${p.password}`)
        .join('\n');
      sections.push(`--- PASSWORD HISTORY ---\n${history}`);
    }

    // TOTP
    if (item.login?.totp) {
      sections.push(`--- TOTP ---\n${item.login.totp}`);
    }

    // Extra URLs
    if (extraUrls.length) {
      sections.push(`--- OTHER URLS ---\n${extraUrls.join('\n')}`);
    }

    // Passkeys
    if (item.login?.fido2Credentials?.length) {
      const pk = item.login.fido2Credentials
        .map(p => `RP: ${p.rpId}\nUser: ${p.userName}\nCreated: ${p.creationDate}`)
        .join('\n\n');
      sections.push(`--- PASSKEY DETECTED ---\n${pk}`);
    }

    // Metadata
    sections.push(`--- METADATA ---
Created: ${item.creationDate}
Updated: ${item.revisionDate}`);

    return sections.join('\n\n');
  }

  /**
   * Process Bitwarden data to Proton Pass CSV format
   */
  static process(rawData, state) {
    state.passkeys = [];
    state.stats = {
      totalItems: 0,
      withPasswords: 0,
      withPasskeys: 0,
      withTOTP: 0,
      byCategory: {}
    };

    const rows = [CONSTANTS.CSV_HEADER];

    if (!rawData?.items || !Array.isArray(rawData.items)) {
      throw new Error('Invalid Bitwarden export format. Missing "items" array.');
    }

    rawData.items.forEach(item => {
      state.stats.totalItems++;

      const login = item.login || {};
      const { main, others } = this.extractUrls(login.uris || []);

      // Categorize based on URL
      const category = Utils.categorizeUrl(main);
      state.stats.byCategory[category] = (state.stats.byCategory[category] || 0) + 1;

      // Detect passkeys
      if (login.fido2Credentials?.length) {
        state.stats.withPasskeys++;
        state.passkeys.push({
          name: item.name,
          url: main,
          category: category
        });
      }

      // Count items with passwords
      if (login.password) {
        state.stats.withPasswords++;
      }

      // Count items with TOTP
      if (login.totp) {
        state.stats.withTOTP++;
      }

      const note = this.buildNotes(item, others);

      // Store item data for category review
      state.items.push({
        name: item.name || '',
        url: main || '',
        username: login.username || '',
        password: login.password || '',
        note: note,
        totp: login.totp || '',
        creationDate: item.creationDate || '',
        revisionDate: item.revisionDate || '',
        category: category,
        hasPassword: !!login.password,
        hasTotp: !!login.totp
      });

      // Build CSV row with proper escaping - use category instead of hardcoded 'Personal'
      const row = [
        'login',
        item.name || '',
        main || '',
        login.username || '', // email field
        login.username || '',
        login.password || '',
        note,
        login.totp || '',
        item.creationDate || '',
        item.revisionDate || '',
        category // Dynamic category
      ].map(field => Utils.escapeCSV(field)).join(',');

      rows.push(row);
    });

    state.processedCSV = rows.join('\n');
    return state;
  }
}

/* ===================================
   UI CONTROLLER
   =================================== */
class UIController {
  constructor(state) {
    this.state = state;
    this.elements = {
      dropZone: document.getElementById('dropZone'),
      fileInput: document.getElementById('fileInput'),
      browseBtn: document.getElementById('browseBtn'),
      fileName: document.getElementById('fileName'),
      processBtn: document.getElementById('processBtn'),
      downloadBtn: document.getElementById('downloadBtn'),
      results: document.getElementById('results'),
      stats: document.getElementById('stats'),
      passkeySection: document.getElementById('passkeySection'),
      passkeyList: document.getElementById('passkeyList'),
      categoryReview: document.getElementById('categoryReview'),
      categoryAccordion: document.getElementById('categoryAccordion'),
      categorySearch: document.getElementById('categorySearch'),
      expandAllBtn: document.getElementById('expandAllBtn'),
      collapseAllBtn: document.getElementById('collapseAllBtn')
    };

    this.initializeEventListeners();
  }

  /**
   * Initialize all event listeners
   */
  initializeEventListeners() {
    // File input
    this.elements.browseBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent event bubbling to dropZone
      this.elements.fileInput.click();
    });

    this.elements.fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFile(e.target.files[0]);
      }
    });

    // Drag and drop
    this.elements.dropZone.addEventListener('click', (e) => {
      // Only trigger if clicking the drop zone itself, not child elements
      if (e.target === this.elements.dropZone || e.target.classList.contains('drop-text') || e.target.classList.contains('drop-divider') || e.target.classList.contains('upload-icon')) {
        this.elements.fileInput.click();
      }
    });

    this.elements.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.elements.dropZone.classList.add('drag-over');
    });

    this.elements.dropZone.addEventListener('dragleave', () => {
      this.elements.dropZone.classList.remove('drag-over');
    });

    this.elements.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.elements.dropZone.classList.remove('drag-over');
      
      if (e.dataTransfer.files.length > 0) {
        this.handleFile(e.dataTransfer.files[0]);
      }
    });

    // Keyboard navigation for drop zone
    this.elements.dropZone.addEventListener('keydown', (e) => {
      if (e.key === CONSTANTS.KEYBOARD_SHORTCUTS.ENTER || e.key === ' ') {
        e.preventDefault();
        this.elements.fileInput.click();
      }
    });

    // Process button
    this.elements.processBtn.addEventListener('click', () => {
      this.processData();
    });

    // Download button
    this.elements.downloadBtn.addEventListener('click', () => {
      this.downloadCSV();
    });

    // Category review controls
    this.elements.expandAllBtn.addEventListener('click', () => {
      this.expandAllCategories();
    });

    this.elements.collapseAllBtn.addEventListener('click', () => {
      this.collapseAllCategories();
    });

    this.elements.categorySearch.addEventListener('input', (e) => {
      this.filterItems(e.target.value);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + O to open file
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        this.elements.fileInput.click();
      }
      // Ctrl/Cmd + P to process (if enabled)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !this.elements.processBtn.disabled) {
        e.preventDefault();
        this.processData();
      }
      // Ctrl/Cmd + F to focus search (when category review is visible)
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !this.elements.categoryReview.classList.contains('hidden')) {
        e.preventDefault();
        this.elements.categorySearch.focus();
      }
    });
  }

  /**
   * Handle file upload
   */
  async handleFile(file) {
    const errors = Utils.validateFile(file);
    
    if (errors.length > 0) {
      errors.forEach(error => ToastManager.error(error));
      return;
    }

    this.elements.fileName.textContent = `${file.name} (${Utils.formatFileSize(file.size)})`;
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        this.state.rawData = JSON.parse(e.target.result);
        this.elements.processBtn.disabled = false;
        ToastManager.success('File loaded successfully!');
      } catch (error) {
        console.error('JSON parse error:', error);
        ToastManager.error('Invalid JSON file. Please export from Bitwarden and try again.');
        this.state.rawData = null;
        this.elements.processBtn.disabled = true;
      }
    };

    reader.onerror = () => {
      ToastManager.error('Failed to read file. Please try again.');
    };

    reader.readAsText(file);
  }

  /**
   * Process the uploaded data
   */
  async processData() {
    if (!this.state.rawData) {
      ToastManager.error('No data to process');
      return;
    }

    // Show loading state
    this.setProcessingState(true);
    LoadingOverlay.show();

    // Use requestAnimationFrame for better performance
    requestAnimationFrame(() => {
      try {
        DataProcessor.process(this.state.rawData, this.state);
        
        this.renderStats();
        this.renderPasskeys();
        this.renderCategoryReview();
        
        this.elements.results.classList.remove('hidden');
        this.elements.categoryReview.classList.remove('hidden');
        
        if (this.state.passkeys.length > 0) {
          this.elements.passkeySection.classList.remove('hidden');
        }

        ToastManager.success(`Successfully processed ${this.state.stats.totalItems} items!`);
        
        // Scroll to results
        this.elements.results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
      } catch (error) {
        console.error('Processing error:', error);
        ToastManager.error(error.message || 'Failed to process data. Please check the file format.');
      } finally {
        LoadingOverlay.hide();
        this.setProcessingState(false);
      }
    }, 100);
  }

  /**
   * Set processing state (loading spinner on button)
   */
  setProcessingState(isProcessing) {
    const spinner = this.elements.processBtn.querySelector('.spinner');
    const btnText = this.elements.processBtn.querySelector('.btn-text');
    
    if (isProcessing) {
      this.elements.processBtn.classList.add('loading');
      this.elements.processBtn.disabled = true;
      spinner.classList.remove('hidden');
      btnText.textContent = 'Processing...';
    } else {
      this.elements.processBtn.classList.remove('loading');
      this.elements.processBtn.disabled = false;
      spinner.classList.add('hidden');
      btnText.textContent = 'Process File';
    }
  }

  /**
   * Render statistics
   */
  renderStats() {
    const { totalItems, withPasswords, withPasskeys, withTOTP, byCategory } = this.state.stats;
    
    // Main stats
    let statsHTML = `
      <div class="stat-item">
        <span class="stat-value">${totalItems}</span>
        <span class="stat-label">Total Items</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${withPasswords}</span>
        <span class="stat-label">With Passwords</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${withTOTP}</span>
        <span class="stat-label">With 2FA</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${withPasskeys}</span>
        <span class="stat-label">With Passkeys</span>
      </div>
    `;
    
    this.elements.stats.innerHTML = statsHTML;
    
    // Category breakdown
    if (Object.keys(byCategory).length > 0) {
      const categorySection = document.createElement('div');
      categorySection.className = 'category-breakdown';
      categorySection.innerHTML = '<h3>Categories</h3>';
      
      const categoryList = document.createElement('div');
      categoryList.className = 'category-list';
      
      // Sort categories by count (descending)
      const sortedCategories = Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1]);
      
      sortedCategories.forEach(([category, count]) => {
        const item = document.createElement('div');
        item.className = 'category-item';
        item.innerHTML = `
          <span class="category-name">${category}</span>
          <span class="category-count">${count}</span>
        `;
        categoryList.appendChild(item);
      });
      
      categorySection.appendChild(categoryList);
      this.elements.stats.appendChild(categorySection);
    }
  }

  /**
   * Render passkey list
   */
  renderPasskeys() {
    this.elements.passkeyList.innerHTML = '';

    const pendingPasskeys = this.state.passkeys.filter(
      p => !this.state.completed.includes(p.name)
    );

    if (pendingPasskeys.length === 0) {
      this.elements.passkeySection.classList.add('hidden');
      return;
    }

    pendingPasskeys.forEach(passkey => {
      const li = document.createElement('li');
      
      const nameSpan = document.createElement('strong');
      nameSpan.textContent = passkey.name;
      
      const openBtn = document.createElement('button');
      openBtn.className = 'btn btn-secondary';
      openBtn.textContent = 'Open Site';
      openBtn.addEventListener('click', () => this.openPasskeySite(passkey.url));
      
      const doneBtn = document.createElement('button');
      doneBtn.className = 'btn btn-primary';
      doneBtn.textContent = 'Mark Done';
      doneBtn.addEventListener('click', () => this.markPasskeyDone(passkey.name));
      
      li.appendChild(nameSpan);
      li.appendChild(openBtn);
      li.appendChild(doneBtn);
      
      this.elements.passkeyList.appendChild(li);
    });
  }

  /**
   * Open passkey site in new tab
   */
  async openPasskeySite(url) {
    if (!url) {
      ToastManager.warning('No URL found for this passkey');
      return;
    }

    try {
      window.open(url, '_blank', 'noopener,noreferrer');
      ToastManager.info('Opened in new tab');
    } catch (error) {
      ToastManager.error('Failed to open URL');
    }
  }

  /**
   * Mark passkey as done
   */
  async markPasskeyDone(name) {
    const confirmed = await DialogManager.show(
      'Confirm Completion',
      `Have you successfully re-registered the passkey for "${name}"?`
    );

    if (confirmed) {
      this.state.markPasskeyComplete(name);
      this.renderPasskeys();
      ToastManager.success('Passkey marked as complete');
    }
  }

  /**
   * Download CSV file
   */
  downloadCSV() {
    if (!this.state.processedCSV) {
      ToastManager.error('No data to download');
      return;
    }

    // Regenerate CSV with any category changes
    this.state.regenerateCSV();

    try {
      const blob = new Blob([this.state.processedCSV], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      const timestamp = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `proton_pass_import_${timestamp}.csv`;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      ToastManager.success('CSV file downloaded successfully!');
    } catch (error) {
      console.error('Download error:', error);
      ToastManager.error('Failed to download file');
    }
  }

  /**
   * Render category review with card grid layout
   */
  renderCategoryReview(preserveExpandedState = false) {
    // Group items by category
    const itemsByCategory = {};
    this.state.items.forEach((item, index) => {
      if (!itemsByCategory[item.category]) {
        itemsByCategory[item.category] = [];
      }
      itemsByCategory[item.category].push({ ...item, index });
    });

    // Sort categories by count
    const sortedCategories = Object.entries(itemsByCategory)
      .sort((a, b) => b[1].length - a[1].length);

    // Create category grid container if it doesn't exist
    let categoryGrid = this.elements.categoryAccordion.querySelector('.category-grid');
    if (!categoryGrid) {
      categoryGrid = document.createElement('div');
      categoryGrid.className = 'category-grid';
      this.elements.categoryAccordion.appendChild(categoryGrid);
    }

    // Clear and rebuild category filters
    categoryGrid.innerHTML = '';
    
    // Add "All" filter
    const allFilter = document.createElement('button');
    allFilter.className = 'category-filter active';
    allFilter.textContent = 'All';
    allFilter.addEventListener('click', () => {
      this.filterByCategory(null);
    });
    categoryGrid.appendChild(allFilter);

    // Add individual category filters
    sortedCategories.forEach(([category, items]) => {
      const filter = document.createElement('button');
      filter.className = 'category-filter';
      filter.textContent = `${category} (${items.length})`;
      filter.dataset.category = category;
      filter.addEventListener('click', () => {
        this.filterByCategory(category);
      });
      categoryGrid.appendChild(filter);
    });

    // Create items grid
    let itemsGrid = this.elements.categoryAccordion.querySelector('.items-grid');
    if (!itemsGrid) {
      itemsGrid = document.createElement('div');
      itemsGrid.className = 'items-grid';
      this.elements.categoryAccordion.appendChild(itemsGrid);
    }

    itemsGrid.innerHTML = '';

    // Render all items as cards
    this.state.items.forEach((item, index) => {
      const card = this.createItemCard(item, index);
      itemsGrid.appendChild(card);
    });
  }

  /**
   * Filter items by category
   */
  filterByCategory(category) {
    const cards = this.elements.categoryAccordion.querySelectorAll('.category-item-card');
    const filters = this.elements.categoryAccordion.querySelectorAll('.category-filter');

    // Update active filter
    filters.forEach(filter => {
      if (category === null) {
        filter.classList.toggle('active', filter.textContent.startsWith('All'));
      } else {
        filter.classList.toggle('active', filter.dataset.category === category);
      }
    });

    // Filter cards
    cards.forEach(card => {
      if (category === null) {
        card.classList.remove('hidden');
      } else {
        card.classList.toggle('hidden', card.dataset.category !== category);
      }
    });
  }

  /**
   * Create an item card
   */
  createItemCard(item) {
    const card = document.createElement('div');
    card.className = 'category-item-card';
    card.dataset.itemIndex = item.index;
    card.dataset.itemName = item.name.toLowerCase();
    card.dataset.category = item.category;

    // Header with name and category select
    const header = document.createElement('div');
    header.className = 'item-header';

    const name = document.createElement('div');
    name.className = 'item-name';
    name.textContent = item.name;

    const categorySelect = document.createElement('select');
    categorySelect.className = 'category-select';
    categorySelect.setAttribute('aria-label', `Change category for ${item.name}`);

    // Get all categories
    const allCategories = Object.keys(CONSTANTS.CATEGORY_ICONS);
    allCategories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      if (cat === item.category) {
        option.selected = true;
      }
      categorySelect.appendChild(option);
    });

    const debouncedChange = Utils.debounce((value) => {
      this.handleCategoryChange(item.index, value);
      card.dataset.category = value;
    }, 150);
    
    categorySelect.addEventListener('change', (e) => {
      debouncedChange(e.target.value);
    });

    header.appendChild(name);
    header.appendChild(categorySelect);
    card.appendChild(header);

    // URL
    if (item.url) {
      const url = document.createElement('div');
      url.className = 'item-url';
      url.textContent = item.url;
      card.appendChild(url);
    }

    // Tags
    const details = document.createElement('div');
    details.className = 'item-details';

    if (item.hasPassword) {
      const passwordTag = document.createElement('span');
      passwordTag.className = 'item-tag has-password';
      passwordTag.textContent = 'Password';
      details.appendChild(passwordTag);
    }

    if (item.hasTotp) {
      const totpTag = document.createElement('span');
      totpTag.className = 'item-tag has-totp';
      totpTag.textContent = '2FA';
      details.appendChild(totpTag);
    }

    if (item.username) {
      const usernameTag = document.createElement('span');
      usernameTag.className = 'item-tag';
      usernameTag.textContent = `User: ${item.username}`;
      details.appendChild(usernameTag);
    }

    if (details.children.length > 0) {
      card.appendChild(details);
    }

    return card;
  }

  /**
   * Handle category change for an item
   */
  handleCategoryChange(itemIndex, newCategory) {
    const oldCategory = this.state.items[itemIndex].category;
    
    if (oldCategory === newCategory) return;

    // Save scroll position
    const scrollY = window.scrollY;
    
    // Blur any focused element to prevent auto-scroll-to-focus behavior
    if (document.activeElement) {
      document.activeElement.blur();
    }
    
    this.state.updateItemCategory(itemIndex, newCategory);
    
    // Only re-render category review, not stats (to prevent scroll jump)
    this.renderCategoryReview(true); // Pass true to preserve expanded categories
    
    // Restore scroll position after DOM update
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
    
    ToastManager.success(`Moved to ${newCategory}`);
  }

  /**
   * Expand all categories
   */
  expandAllCategories() {
    const sections = this.elements.categoryAccordion.querySelectorAll('.category-section');
    sections.forEach(section => section.classList.add('expanded'));
  }

  /**
   * Collapse all categories
   */
  collapseAllCategories() {
    const sections = this.elements.categoryAccordion.querySelectorAll('.category-section');
    sections.forEach(section => section.classList.remove('expanded'));
  }

  /**
   * Filter items based on search query
   */
  filterItems(query) {
    const searchTerm = query.toLowerCase().trim();
    const allCards = this.elements.categoryAccordion.querySelectorAll('.category-item-card');
    
    if (!searchTerm) {
      allCards.forEach(card => card.classList.remove('hidden'));
      return;
    }

    allCards.forEach(card => {
      const itemName = card.dataset.itemName;
      if (itemName.includes(searchTerm)) {
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }
    });

    // Auto-expand categories with visible items
    const sections = this.elements.categoryAccordion.querySelectorAll('.category-section');
    sections.forEach(section => {
      const visibleCards = section.querySelectorAll('.category-item-card:not(.hidden)');
      if (visibleCards.length > 0) {
        section.classList.add('expanded');
      } else {
        section.classList.remove('expanded');
      }
    });
  }
}

/* ===================================
   APPLICATION INITIALIZATION
   =================================== */
document.addEventListener('DOMContentLoaded', () => {
  const appState = new AppState();
  const uiController = new UIController(appState);
  
  // Show welcome message
  ToastManager.info('Ready to migrate your passwords securely');
  
  console.log('Password Migration Tool initialized');
  console.log('All processing happens locally - your data never leaves your device');
});