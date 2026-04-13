/**
 * Password Migration Tool - Bitwarden to Proton Pass
 *
 * Converts a Bitwarden JSON export into a Proton Pass–compatible CSV file.
 * Everything runs entirely in the browser — no data is ever sent to a server.
 *
 * Architecture overview:
 *   CONSTANTS         — immutable config values (file limits, CSV header, shortcuts)
 *   CATEGORY_MAPPINGS — domain-keyword → category lookup table
 *   AppState          — single source of truth for all runtime data
 *   Utils             — pure helper functions (sanitize, CSV escape, email detect, etc.)
 *   ToastManager      — non-blocking notification banners
 *   DialogManager     — promise-based confirmation dialogs
 *   LoadingOverlay    — full-screen processing indicator
 *   DataProcessor     — parses Bitwarden JSON → builds CSV rows + stats
 *   UIController      — all DOM rendering and event wiring
 *
 * @version 2.0.0
 */

/* ===================================
   CONSTANTS
   =================================== */
const CONSTANTS = {
  /** Maximum accepted file size (50 MB). Bitwarden exports are typically <5 MB. */
  MAX_FILE_SIZE: 50 * 1024 * 1024,

  /** localStorage key used to persist which passkeys the user has already re-registered. */
  STORAGE_KEY_COMPLETED: 'completed_passkeys',

  /**
   * Column order required by the Proton Pass CSV importer.
   * All rows must follow this exact order.
   */
  CSV_HEADER: 'type,name,url,email,username,password,note,totp,createTime,modifyTime,vault',

  /** How long (ms) success/warning toasts stay on screen before auto-dismissing. */
  TOAST_DURATION: 5000,

  /** Key names used in keydown handlers so string literals are not scattered throughout. */
  KEYBOARD_SHORTCUTS: {
    ESCAPE: 'Escape',
    ENTER: 'Enter'
  },

  /**
   * Display icons for each recognised category.
   * Keys must match the keys in CATEGORY_MAPPINGS plus 'Other'.
   */
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
/**
 * Maps category names to an array of domain keywords.
 * During processing, Utils.categorizeUrl() checks whether the item's domain
 * contains any of these keywords (case-insensitive substring match).
 * The first matching category wins; items that match nothing fall back to "Other".
 *
 * To add a new category: add a key here AND add the same key to CONSTANTS.CATEGORY_ICONS.
 */
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
/**
 * AppState — single source of truth for the entire application.
 *
 * One instance is created on DOMContentLoaded and passed into UIController.
 * All mutation of application data goes through AppState methods so that the
 * UI layer never touches raw data structures directly.
 */
class AppState {
  constructor() {
    /** Raw parsed JSON from the uploaded Bitwarden export file. */
    this.rawData = null;

    /** The generated CSV string, ready to write to a .csv file. */
    this.processedCSV = '';

    /** Array of passkey objects detected during processing. */
    this.passkeys = [];

    /** Names of passkeys the user has already manually re-registered (persisted via localStorage). */
    this.completed = this.loadCompletedPasskeys();

    /**
     * Flat array of every processed login item.
     * Each entry mirrors one CSV row and is used by UIController for the
     * category review accordion and for regenerating the CSV after edits.
     */
    this.items = [];

    /**
     * Maps category name → vault name for the Proton Pass import.
     * Initialised by initVaultMappings() after processing. The user can
     * rename vaults in the Step 3 UI, which calls updateVaultMapping().
     * Multiple categories can share the same vault name — they will be merged.
     *
     * @type {{ [category: string]: string }}
     */
    this.vaultMappings = {};

    /** Running counters updated during DataProcessor.process(). */
    this.stats = {
      totalItems: 0,
      withPasswords: 0,
      withPasskeys: 0,
      withTOTP: 0,
      /** { [category: string]: number } — item count per category. */
      byCategory: {}
    };
  }

  /**
   * Load previously saved passkey completion state from localStorage.
   * Returns an empty array if nothing is stored or the stored value is corrupt.
   * @returns {string[]} Array of passkey names the user has already completed.
   */
  loadCompletedPasskeys() {
    try {
      return JSON.parse(localStorage.getItem(CONSTANTS.STORAGE_KEY_COMPLETED) || '[]');
    } catch (error) {
      console.error('Failed to load completed passkeys:', error);
      return [];
    }
  }

  /**
   * Persist the current completed passkeys list to localStorage.
   * Called automatically by markPasskeyComplete().
   */
  saveCompletedPasskeys() {
    try {
      localStorage.setItem(CONSTANTS.STORAGE_KEY_COMPLETED, JSON.stringify(this.completed));
    } catch (error) {
      console.error('Failed to save completed passkeys:', error);
      ToastManager.show('Failed to save progress', 'error');
    }
  }

  /**
   * Mark a passkey as manually re-registered by the user.
   * Idempotent — calling it twice for the same name has no effect.
   * @param {string} name — the passkey's display name (matches item.name in Bitwarden)
   */
  markPasskeyComplete(name) {
    if (!this.completed.includes(name)) {
      this.completed.push(name);
      this.saveCompletedPasskeys();
    }
  }

  /**
   * Seed vaultMappings with a 1-to-1 category → vault name default.
   * Called once after DataProcessor.process() so that every discovered
   * category has an entry. The user can then rename vaults via the Step 3 UI.
   */
  initVaultMappings() {
    this.vaultMappings = {};
    Object.keys(this.stats.byCategory).forEach(category => {
      this.vaultMappings[category] = category;
    });
  }

  /**
   * Update the vault name for a single category.
   * Called live as the user types in the Step 3 vault name inputs.
   * @param {string} category — category key (e.g. "Finance")
   * @param {string} vaultName — desired vault name in Proton Pass
   */
  updateVaultMapping(category, vaultName) {
    this.vaultMappings[category] = vaultName;
  }

  /**
   * Collapse vaultMappings into a deduplicated list of unique vault names.
   * If two categories share the same vault name they are merged into one entry.
   * Sorted by item count (descending) for display in the summary box.
   *
   * @returns {{ name: string, categories: string[], count: number }[]}
   */
  getUniqueVaults() {
    const vaults = {};
    Object.entries(this.vaultMappings).forEach(([category, vaultName]) => {
      // Fall back to the category name if the user left the input blank
      const name = (vaultName || '').trim() || category;
      if (!vaults[name]) {
        vaults[name] = { name, categories: [], count: 0 };
      }
      vaults[name].categories.push(category);
      vaults[name].count += this.stats.byCategory[category] || 0;
    });
    return Object.values(vaults).sort((a, b) => b.count - a.count);
  }

  /**
   * Reset all state back to initial values.
   * Called when the user uploads a new file so stale data cannot bleed through.
   */
  reset() {
    this.rawData = null;
    this.processedCSV = '';
    this.passkeys = [];
    this.items = [];
    this.vaultMappings = {};
    this.stats = {
      totalItems: 0,
      withPasswords: 0,
      withPasskeys: 0,
      withTOTP: 0,
      byCategory: {}
    };
  }

  /**
   * Move an item to a new category and keep stats consistent.
   * @param {number} itemIndex — index into this.items[]
   * @param {string} newCategory — target category name
   */
  updateItemCategory(itemIndex, newCategory) {
    if (this.items[itemIndex]) {
      const oldCategory = this.items[itemIndex].category;
      this.items[itemIndex].category = newCategory;

      // Decrement old category; remove the key entirely if it hits zero
      // so the category disappears from the vault setup and results sections
      this.stats.byCategory[oldCategory]--;
      if (this.stats.byCategory[oldCategory] === 0) {
        delete this.stats.byCategory[oldCategory];
      }
      this.stats.byCategory[newCategory] = (this.stats.byCategory[newCategory] || 0) + 1;
    }
  }

  /**
   * Rebuild processedCSV from the current items[] and vaultMappings.
   * Must be called before downloadCSV() to pick up any category or vault changes
   * the user made after the initial process() run.
   */
  regenerateCSV() {
    const rows = [CONSTANTS.CSV_HEADER];

    this.items.forEach(item => {
      const row = [
        'login',
        item.name || '',
        item.url || '',
        item.email || '',          // email column — only populated when identifier is an email address
        item.username || '',       // username column — only populated when identifier is NOT an email
        item.password || '',
        item.note || '',
        item.totp || '',
        item.creationDate || '',
        item.revisionDate || '',
        // Use mapped vault name; fall back to category name if user left it blank
        (this.vaultMappings[item.category] || '').trim() || item.category || 'Other'
      ].map(field => Utils.escapeCSV(field)).join(',');

      rows.push(row);
    });

    this.processedCSV = rows.join('\n');
  }
}

/* ===================================
   UTILITY FUNCTIONS
   =================================== */
/**
 * Utils — stateless helper functions.
 * Pure functions with no side effects; safe to call from anywhere.
 */
const Utils = {
  /**
   * Sanitize text for safe HTML display (prevents XSS).
   * Uses the browser's own text node escaping — no regex required.
   * @param {string} text
   * @returns {string} HTML-escaped string
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
   * Heuristic check: returns true if the string looks like an email address.
   *
   * Used to decide whether to populate the CSV `email` column or the `username`
   * column. Bitwarden stores both emails and plain usernames in the same
   * `login.username` field, so we detect the type here and route accordingly.
   *
   * This is intentionally simple (requires @, a domain, and a TLD). It covers
   * the real-world cases in a password export without false positives.
   *
   * @param {string} str
   * @returns {boolean}
   */
  isEmail(str) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
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
   * Extract the bare domain (no www, no path) from a URL string.
   * Falls back to an empty string for invalid or empty inputs.
   * @param {string} url
   * @returns {string} e.g. "github.com"
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
   * Assign a category to a URL by matching its domain against CATEGORY_MAPPINGS.
   *
   * Strategy: extract the domain, then iterate categories in object-insertion order
   * (Finance first, Government last). The first category whose keyword list contains
   * the domain as a substring wins. Returns "Other" for unrecognised domains.
   *
   * @param {string} url — full URL from the Bitwarden export
   * @returns {string} category name, e.g. "Finance" or "Other"
   */
  categorizeUrl(url) {
    if (!url) return 'Other';

    const domain = this.extractDomain(url);
    if (!domain) return 'Other';

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
/**
 * ToastManager — lightweight, non-blocking notification banners.
 *
 * All methods are static; no instance is needed.
 * Toasts slide in from the right and auto-dismiss after TOAST_DURATION ms.
 * Error toasts never auto-dismiss — the user must close them manually,
 * because errors require deliberate acknowledgement.
 */
class ToastManager {
  static container = document.getElementById('toastContainer');

  /**
   * Create and display a toast notification.
   * @param {string} message — human-readable message
   * @param {'info'|'success'|'warning'|'error'} type — controls colour and icon
   * @param {number} duration — ms before auto-dismiss; 0 = never
   * @returns {HTMLElement} the toast element (rarely needed by callers)
   */
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
/**
 * DialogManager — promise-based confirmation dialogs.
 *
 * Usage:
 *   const confirmed = await DialogManager.show('Title', 'Are you sure?');
 *   if (confirmed) { ... }
 *
 * The overlay is a single shared element in index.html (#confirmDialog).
 * Event listeners use { once: true } so they clean up after every show() call.
 * Pressing Escape is equivalent to clicking Cancel.
 */
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
/**
 * LoadingOverlay — full-screen spinner shown during the processing step.
 *
 * Processing is synchronous-heavy (JSON parse + CSV build for hundreds of items),
 * so the overlay gives the user feedback that the app hasn't frozen.
 * It is always shown before requestAnimationFrame() and hidden in the finally block.
 */
class LoadingOverlay {
  static overlay = document.getElementById('loadingOverlay');

  /** Show the full-screen loading spinner. */
  static show() {
    this.overlay.classList.remove('hidden');
  }

  /** Hide the full-screen loading spinner. */
  static hide() {
    this.overlay.classList.add('hidden');
  }
}

/* ===================================
   DATA PROCESSING
   =================================== */
/**
 * DataProcessor — all logic for parsing a Bitwarden JSON export.
 *
 * All methods are static. This class has no state of its own;
 * results are written into the AppState object passed to process().
 *
 * Bitwarden export structure (relevant fields):
 *   {
 *     items: [{
 *       name, notes, creationDate, revisionDate,
 *       fields: [{ name, value }],
 *       passwordHistory: [{ password, lastUsedDate }],
 *       login: {
 *         username,   ← may be an email or a plain username
 *         password,
 *         totp,
 *         uris: [{ uri, match }],
 *         fido2Credentials: [...]  ← passkeys
 *       }
 *     }]
 *   }
 */
class DataProcessor {
  /**
   * Extract URLs from a Bitwarden URI array.
   * The first http/https URI becomes the "main" URL (used for categorisation
   * and the CSV url column). Remaining URIs are moved to the notes field.
   *
   * @param {{ uri: string }[]} uris
   * @returns {{ main: string, others: string[] }}
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
   * Build the full notes string for a login item.
   *
   * Proton Pass has a single "note" field per item, so everything that doesn't
   * have a dedicated CSV column is concatenated here in clearly labelled sections:
   * original notes → custom fields → password history → TOTP → extra URLs →
   * passkey metadata → item timestamps.
   *
   * @param {object} item — raw Bitwarden item object
   * @param {string[]} extraUrls — additional URLs beyond the primary one
   * @returns {string} multi-line notes string
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
   * Parse a Bitwarden JSON export and populate AppState with processed data.
   *
   * For each login item this method:
   *   1. Extracts the primary URL and classifies it into a category
   *   2. Detects passkeys (stored separately — they can't be migrated via CSV)
   *   3. Separates email vs plain username so each goes in the correct CSV column
   *   4. Builds a composite notes field for data that has no dedicated CSV column
   *   5. Writes a CSV row and pushes a structured item object for the review UI
   *
   * Note: only items of type "login" are present in a Bitwarden vault export.
   * Secure notes, cards, and identities are not included in the standard JSON export.
   *
   * @param {object} rawData — parsed Bitwarden JSON
   * @param {AppState} state — state object to populate (mutated in place)
   * @returns {AppState} the same state object, for chaining if needed
   * @throws {Error} if rawData.items is missing or not an array
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

      // Separate email vs username: if the value looks like an email put it in
      // the email column only; otherwise put it in username only.
      const rawIdentifier = login.username || '';
      const emailField    = Utils.isEmail(rawIdentifier) ? rawIdentifier : '';
      const usernameField = Utils.isEmail(rawIdentifier) ? '' : rawIdentifier;

      // Store item data for category review
      state.items.push({
        name: item.name || '',
        url: main || '',
        email: emailField,
        username: usernameField,
        password: login.password || '',
        note: note,
        totp: login.totp || '',
        creationDate: item.creationDate || '',
        revisionDate: item.revisionDate || '',
        category: category,
        hasPassword: !!login.password,
        hasTotp: !!login.totp
      });

      // Build CSV row with proper escaping
      const row = [
        'login',
        item.name || '',
        main || '',
        emailField,
        usernameField,
        login.password || '',
        note,
        login.totp || '',
        item.creationDate || '',
        item.revisionDate || '',
        category
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
/**
 * UIController — owns all DOM rendering and user interaction.
 *
 * Receives an AppState instance and keeps a reference to every relevant
 * DOM element in this.elements so that querySelector is only called once
 * per element at startup, not on every render.
 *
 * Responsibilities:
 *   - File upload (drag-and-drop, browse button, FileReader)
 *   - Triggering DataProcessor and rendering the result sections
 *   - Category review accordion (render, filter, expand/collapse, search)
 *   - Vault mapping UI (Step 3) — input rows + live summary
 *   - CSV download (regenerate → Blob → anchor click)
 *   - Passkey list with "Mark Done" tracking
 *   - Global keyboard shortcuts
 */
class UIController {
  /**
   * @param {AppState} state
   */
  constructor(state) {
    this.state = state;

    /**
     * Cached references to all DOM elements this controller interacts with.
     * Populated once at construction time to avoid repeated getElementById calls.
     */
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
      collapseAllBtn: document.getElementById('collapseAllBtn'),
      vaultSetup: document.getElementById('vaultSetup'),
      vaultMappingTable: document.getElementById('vaultMappingTable'),
      vaultList: document.getElementById('vaultList'),
      downloadSection: document.getElementById('downloadSection')
    };

    this.initializeEventListeners();
  }

  /**
   * Wire up all event listeners for the application.
   * Called once from the constructor. Grouped by feature area.
   */
  initializeEventListeners() {
    // --- File selection ---
    // "Select File" button: stop propagation so the click doesn't also
    // bubble up to the dropZone's own click handler below.
    this.elements.browseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.elements.fileInput.click();
    });

    this.elements.fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFile(e.target.files[0]);
      }
    });

    // --- Drag and drop ---
    // Click on the drop zone area (but not the button, which has its own listener)
    this.elements.dropZone.addEventListener('click', (e) => {
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

    // Keyboard navigation for drop zone (accessibility — Space/Enter activates it)
    this.elements.dropZone.addEventListener('keydown', (e) => {
      if (e.key === CONSTANTS.KEYBOARD_SHORTCUTS.ENTER || e.key === ' ') {
        e.preventDefault();
        this.elements.fileInput.click();
      }
    });

    // --- Step buttons ---
    this.elements.processBtn.addEventListener('click', () => this.processData());
    this.elements.downloadBtn.addEventListener('click', () => this.downloadCSV());

    // --- Category review toolbar ---
    this.elements.expandAllBtn.addEventListener('click', () => this.expandAllCategories());
    this.elements.collapseAllBtn.addEventListener('click', () => this.collapseAllCategories());

    // Search input: filters item cards within the accordion in real time
    this.elements.categorySearch.addEventListener('input', (e) => {
      this.filterItems(e.target.value);
    });

    // --- Global keyboard shortcuts ---
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + O — open file picker
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        this.elements.fileInput.click();
      }
      // Ctrl/Cmd + P — process file (only when the button is enabled)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !this.elements.processBtn.disabled) {
        e.preventDefault();
        this.processData();
      }
      // Ctrl/Cmd + F — focus search box (only when the category review is visible)
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
   * Run the full processing pipeline on the loaded Bitwarden JSON.
   *
   * Processing is wrapped in requestAnimationFrame() so the loading overlay
   * has a chance to paint before the synchronous CPU work begins.
   * The overlay is always hidden in the finally block regardless of success/failure.
   */
  async processData() {
    if (!this.state.rawData) {
      ToastManager.error('No data to process');
      return;
    }

    this.setProcessingState(true);
    LoadingOverlay.show();

    // Yield to the browser so the spinner renders before we block the thread
    requestAnimationFrame(() => {
      try {
        DataProcessor.process(this.state.rawData, this.state);
        this.state.initVaultMappings();

        this.renderStats();
        this.renderPasskeys();
        this.renderCategoryReview();
        this.renderVaultSetup();

        this.elements.results.classList.remove('hidden');
        this.elements.categoryReview.classList.remove('hidden');
        this.elements.vaultSetup.classList.remove('hidden');
        this.elements.downloadSection.classList.remove('hidden');
        
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
   * Render the Results section: four summary stat cards + category breakdown.
   *
   * The four stat items and the category breakdown are all children of the same
   * CSS grid (#stats). The breakdown div uses `grid-column: 1 / -1` in CSS so
   * it always spans the full width regardless of how many columns the grid has,
   * preventing it from being placed next to a stat card on wider screens.
   */
  renderStats() {
    const { totalItems, withPasswords, withPasskeys, withTOTP, byCategory } = this.state.stats;

    // Four top-level stat cards
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
        const pct = totalItems > 0 ? Math.round((count / totalItems) * 100) : 0;
        const item = document.createElement('div');
        item.className = 'category-item';
        item.innerHTML = `
          <span class="category-name">${Utils.sanitizeText(category)}</span>
          <div class="category-item-right">
            <div class="category-bar-wrap" aria-hidden="true"><div class="category-bar" style="width:${pct}%"></div></div>
            <span class="category-count" title="${pct}%">${count}</span>
          </div>
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
   * Render vault mapping inputs and summary
   */
  renderVaultSetup() {
    const categories = Object.keys(this.state.stats.byCategory).sort();

    this.elements.vaultMappingTable.innerHTML = categories.map(category => {
      const count = this.state.stats.byCategory[category] || 0;
      const vaultName = this.state.vaultMappings[category] || category;
      return `
        <div class="vault-row" role="listitem">
          <span class="vault-category-label">${Utils.sanitizeText(category)}</span>
          <span class="vault-arrow" aria-hidden="true">&#8594;</span>
          <input
            type="text"
            class="vault-name-input"
            data-category="${Utils.sanitizeText(category)}"
            value="${Utils.sanitizeText(vaultName)}"
            placeholder="Vault name"
            aria-label="Vault name for ${Utils.sanitizeText(category)} category"
            maxlength="50"
          >
          <span class="vault-item-count">${count} item${count !== 1 ? 's' : ''}</span>
        </div>`;
    }).join('');

    this.elements.vaultMappingTable.querySelectorAll('.vault-name-input').forEach(input => {
      input.addEventListener('input', Utils.debounce(() => {
        this.state.updateVaultMapping(input.dataset.category, input.value);
        this.updateVaultSummary();
      }, 200));
    });

    this.updateVaultSummary();
  }

  /**
   * Update the vault summary list
   */
  updateVaultSummary() {
    const vaults = this.state.getUniqueVaults();
    this.elements.vaultList.innerHTML = vaults.map(v => {
      const mergeNote = v.categories.length > 1
        ? `<span class="vault-merge-note">merges: ${v.categories.map(c => Utils.sanitizeText(c)).join(', ')}</span>`
        : '';
      return `<li class="vault-list-item">
        <span class="vault-list-name">${Utils.sanitizeText(v.name)}</span>
        <span class="vault-list-count">${v.count} item${v.count !== 1 ? 's' : ''}</span>
        ${mergeNote}
      </li>`;
    }).join('');
  }

  /**
   * Trigger a browser download of the Proton Pass–compatible CSV file.
   *
   * Always calls regenerateCSV() first to capture any category or vault name
   * changes made after the initial process() run.
   *
   * Download mechanism: Blob → object URL → invisible <a> click → revoke URL.
   * This is the standard client-side file download pattern and works in all
   * modern browsers without requiring a server round-trip.
   */
  downloadCSV() {
    if (!this.state.processedCSV) {
      ToastManager.error('No data to download');
      return;
    }

    // Rebuild CSV from current item/vault state before writing to disk
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
   * Render the "Review & Edit Categories" accordion.
   *
   * Structure rendered into #categoryAccordion:
   *   .category-grid          — row of filter pills (All | Finance (29) | Tech (44) | …)
   *   .category-section       — one per category, expanded/collapsed via CSS class
   *     .category-header      — clickable <button> that toggles the section
   *     .category-content
   *       .category-items     — grid of .category-item-card elements
   *
   * @param {boolean} preserveExpandedState
   *   false (default) — first section is expanded, all others collapsed.
   *   true  — re-read which sections are currently expanded before re-rendering
   *           and restore them. Used by handleCategoryChange() so moving an item
   *           doesn't collapse sections the user had open.
   */
  renderCategoryReview(preserveExpandedState = false) {
    // Snapshot which sections are open before we wipe innerHTML
    const expandedCategories = new Set();
    if (preserveExpandedState) {
      this.elements.categoryAccordion.querySelectorAll('.category-section.expanded').forEach(s => {
        expandedCategories.add(s.dataset.category);
      });
    }

    // Group items by category
    const itemsByCategory = {};
    this.state.items.forEach((item, index) => {
      if (!itemsByCategory[item.category]) {
        itemsByCategory[item.category] = [];
      }
      itemsByCategory[item.category].push({ ...item, index });
    });

    const sortedCategories = Object.entries(itemsByCategory)
      .sort((a, b) => b[1].length - a[1].length);

    this.elements.categoryAccordion.innerHTML = '';

    // --- Filter pills ---
    const categoryGrid = document.createElement('div');
    categoryGrid.className = 'category-grid';

    const allFilter = document.createElement('button');
    allFilter.type = 'button';
    allFilter.className = 'category-filter active';
    allFilter.textContent = 'All';
    allFilter.addEventListener('click', () => this.filterByCategory(null));
    categoryGrid.appendChild(allFilter);

    sortedCategories.forEach(([category, items]) => {
      const filter = document.createElement('button');
      filter.type = 'button';
      filter.className = 'category-filter';
      filter.textContent = `${category} (${items.length})`;
      filter.dataset.category = category;
      filter.addEventListener('click', () => this.filterByCategory(category));
      categoryGrid.appendChild(filter);
    });

    this.elements.categoryAccordion.appendChild(categoryGrid);

    // --- Accordion sections ---
    sortedCategories.forEach(([category, items], idx) => {
      const isExpanded = preserveExpandedState
        ? expandedCategories.has(category)
        : idx === 0;

      const section = document.createElement('div');
      section.className = 'category-section' + (isExpanded ? ' expanded' : '');
      section.dataset.category = category;

      // Header button
      const header = document.createElement('button');
      header.type = 'button';
      header.className = 'category-header';
      header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      header.setAttribute('aria-controls', `cat-content-${category}`);

      const headerLeft = document.createElement('div');
      headerLeft.className = 'category-header-left';

      const title = document.createElement('span');
      title.className = 'category-title';
      title.textContent = category;

      const badge = document.createElement('span');
      badge.className = 'category-badge';
      badge.textContent = items.length;

      headerLeft.appendChild(title);
      headerLeft.appendChild(badge);

      const chevron = document.createElement('span');
      chevron.className = 'category-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      chevron.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

      header.appendChild(headerLeft);
      header.appendChild(chevron);
      header.addEventListener('click', () => {
        const expanded = section.classList.toggle('expanded');
        header.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      });

      // Content
      const content = document.createElement('div');
      content.className = 'category-content';
      content.id = `cat-content-${category}`;

      const itemsGrid = document.createElement('div');
      itemsGrid.className = 'category-items';
      items.forEach(item => itemsGrid.appendChild(this.createItemCard(item)));

      content.appendChild(itemsGrid);
      section.appendChild(header);
      section.appendChild(content);
      this.elements.categoryAccordion.appendChild(section);
    });
  }

  /**
   * Filter the accordion to show only a specific category, or all categories.
   *
   * Operates on entire .category-section elements (not individual cards).
   * When a specific category is selected, its section is auto-expanded so
   * the user doesn't have to click twice.
   *
   * @param {string|null} category — category name to isolate, or null to show all
   */
  filterByCategory(category) {
    const filters = this.elements.categoryAccordion.querySelectorAll('.category-filter');
    const sections = this.elements.categoryAccordion.querySelectorAll('.category-section');

    filters.forEach(filter => {
      filter.classList.toggle('active',
        category === null ? !filter.dataset.category : filter.dataset.category === category
      );
    });

    sections.forEach(section => {
      if (category === null) {
        section.classList.remove('hidden');
      } else {
        const matches = section.dataset.category === category;
        section.classList.toggle('hidden', !matches);
        if (matches) {
          section.classList.add('expanded');
          section.querySelector('.category-header')?.setAttribute('aria-expanded', 'true');
        }
      }
    });
  }

  /**
   * Build a single item card DOM element for the category review accordion.
   *
   * Card structure:
   *   .category-item-card
   *     .item-header        — item name + category <select> dropdown
   *     .item-url           — primary URL (omitted if empty)
   *     .item-details       — tag pills: Password, 2FA, Email/User
   *
   * The category <select> is debounced (150ms) so rapid changes don't trigger
   * multiple re-renders. Changing the category calls handleCategoryChange()
   * which updates AppState and re-renders the whole accordion.
   *
   * @param {{ index: number, name: string, url: string, email: string,
   *           username: string, hasPassword: boolean, hasTotp: boolean,
   *           category: string }} item
   * @returns {HTMLElement}
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

    if (item.email) {
      const emailTag = document.createElement('span');
      emailTag.className = 'item-tag';
      emailTag.textContent = `Email: ${item.email}`;
      details.appendChild(emailTag);
    } else if (item.username) {
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
   * Handle a category change triggered by the item card's <select> dropdown.
   *
   * After updating AppState the accordion is re-rendered with expanded state
   * preserved (preserveExpandedState = true). Scroll position is saved before
   * and restored via requestAnimationFrame after the re-render, because:
   *   1. Re-rendering the accordion changes DOM height, which can shift the page.
   *   2. The focused <select> blurs, which can trigger a browser auto-scroll.
   * Saving scrollY → blurring → re-rendering → restoring scrollY prevents jump.
   *
   * @param {number} itemIndex — index into AppState.items[]
   * @param {string} newCategory — the category the user selected
   */
  handleCategoryChange(itemIndex, newCategory) {
    const oldCategory = this.state.items[itemIndex].category;

    if (oldCategory === newCategory) return;

    // Capture scroll position before any DOM mutation
    const scrollY = window.scrollY;

    // Blur first to prevent the browser from auto-scrolling to the re-focused element
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
    this.elements.categoryAccordion.querySelectorAll('.category-section').forEach(section => {
      section.classList.add('expanded');
      section.querySelector('.category-header')?.setAttribute('aria-expanded', 'true');
    });
  }

  /**
   * Collapse all categories
   */
  collapseAllCategories() {
    this.elements.categoryAccordion.querySelectorAll('.category-section').forEach(section => {
      section.classList.remove('expanded');
      section.querySelector('.category-header')?.setAttribute('aria-expanded', 'false');
    });
  }

  /**
   * Filter item cards within the accordion by name search query.
   *
   * Matches against the lowercased item name stored in card.dataset.itemName.
   * After filtering, sections with at least one visible card are auto-expanded;
   * sections where every card is hidden are auto-collapsed.
   * Clearing the search (empty query) restores all cards.
   *
   * @param {string} query — raw value from the search input
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
/**
 * Bootstrap the application once the DOM is fully parsed.
 *
 * Intentionally minimal: create one AppState and one UIController.
 * All event wiring happens inside UIController's constructor, so there
 * is nothing else to do here except show a welcome toast.
 */
document.addEventListener('DOMContentLoaded', () => {
  const appState = new AppState();
  const uiController = new UIController(appState); // eslint-disable-line no-unused-vars

  ToastManager.info('Ready to migrate your passwords securely');

  console.log('Password Migration Tool initialized');
  console.log('All processing happens locally — your data never leaves your device');
});