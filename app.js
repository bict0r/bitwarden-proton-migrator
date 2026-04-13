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
    'Security': '',
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
    'Adult': '',
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
  // Keywords are specific enough to avoid false positives — prefer exact service
  // names over short words like "bank" which appear in unrelated domains.
  'Finance': [
    'bankofamerica', 'chase', 'wellsfargo', 'citi', 'capitalone', 'usbank', 'pnc',
    'tdbank', 'ally', 'schwab', 'fidelity', 'vanguard', 'etrade', 'robinhood',
    'paypal', 'venmo', 'cashapp', 'stripe', 'square', 'coinbase', 'kraken',
    'binance', 'gemini', 'blockchain', 'mint.com', 'creditkarma', 'nerdwallet',
    'discover', 'amex', 'americanexpress', 'barclays', 'hsbc', 'santander',
    'jpmorgan', 'goldmansachs', 'morganstanley', 'merrill',
    // Modern fintech
    'sofi', 'chime', 'wise.com', 'transferwise', 'zelle', 'turbotax', 'intuit',
    'hrblock', 'quickbooks', 'acorns', 'webull', 'm1finance', 'wealthfront',
    'betterment', 'personalcapital', 'empower', 'plaid'
  ],

  // Security — VPNs, password managers, 2FA tools.
  // Checked before Tech so that bitwarden.com, 1password.com, etc. don't land
  // in Tech just because they share keywords with developer tools.
  'Security': [
    // VPN providers
    'nordvpn', 'expressvpn', 'mullvad', 'protonvpn', 'surfshark', 'ipvanish',
    'cyberghost', 'privatevpn', 'purevpn', 'tunnelbear', 'windscribe',
    // Password managers
    'lastpass', '1password', 'dashlane', 'bitwarden', 'keepass', 'enpass',
    'keeper', 'roboform', 'zoho vault', 'passbolt', 'strongbox',
    // 2FA / authenticator
    'authy', 'duo.com', 'yubico', 'yubikey',
    // Threat intelligence
    'haveibeenpwned', 'virustotal', 'malwarebytes', 'bitdefender', 'norton',
    'mcafee', 'kaspersky', 'avast', 'avira', 'eset'
  ],

  // Technology & Developer Tools
  // Removed: 'amazon' (belongs in Shopping), plain 'apple' (too broad — use specific
  // subdomains instead), 'twitch' (moved to Entertainment).
  'Tech': [
    'github', 'gitlab', 'bitbucket', 'stackoverflow', 'google', 'gmail',
    'aws.amazon', 'azure', 'microsoft', 'digitalocean', 'heroku', 'vercel',
    'netlify', 'cloudflare', 'firebase', 'mongodb', 'docker', 'hub.docker',
    'kubernetes', 'npm', 'pypi', 'icloud', 'developer.apple', 'android',
    'openai', 'anthropic', 'huggingface', 'kaggle', 'colab', 'jupyter',
    // Email & communication platforms (non-social)
    'yahoo', 'outlook.com', 'hotmail', 'protonmail', 'proton.me', 'fastmail',
    'tutanota', 'zoho',
    // Dev tools
    'jetbrains', 'visualstudio', 'code.visualstudio', 'replit', 'codepen',
    'jsfiddle', 'codesandbox', 'hashnode', 'dev.to', 'raycast', 'linear'
  ],

  // Social Media & Communication
  // Removed: 'twitch' (streaming platform → Entertainment), 'youtube' (Entertainment).
  'Social': [
    'facebook', 'instagram', 'twitter', 'x.com', 'linkedin', 'reddit',
    'discord', 'slack', 'telegram', 'whatsapp', 'signal', 'messenger',
    'snapchat', 'tiktok', 'pinterest', 'tumblr', 'vimeo',
    'mastodon', 'bluesky', 'threads', 'nostr',
    // Community & networking
    'nextdoor', 'meetup', 'skype', 'viber', 'line.me', 'wechat', 'kik',
    'clubhouse', 'bereal', 'livejournal'
  ],

  // Shopping & E-commerce
  // 'amazon' lives here (not Tech). Specific enough keywords only.
  'Shopping': [
    'amazon', 'ebay', 'etsy', 'walmart', 'target', 'bestbuy', 'newegg',
    'aliexpress', 'alibaba', 'shopify', 'wayfair', 'ikea', 'homedepot',
    'lowes', 'costco', 'samsclub', 'macys', 'nordstrom', 'zappos',
    'chewy', 'instacart',
    // More retailers
    'wish.com', 'shein', 'rakuten', 'groupon', 'overstock', 'bhphotovideo',
    'bloomingdales', 'gap.com', 'oldnavy', 'hm.com', 'zara', 'uniqlo',
    'temu', 'poshmark', 'thredup', 'mercari', 'depop', 'reverb',
    'gamestop', 'adorama', 'bhphotovideo', 'microcenter', 'tigerdirect'
  ],

  // Entertainment & Media
  // Includes streaming, gaming, music. 'twitch' moved here from Social.
  'Entertainment': [
    'netflix', 'hulu', 'disneyplus', 'disney', 'max.com', 'hbomax', 'hbo',
    'primevideo', 'peacocktv', 'paramountplus', 'appletv', 'plex',
    'spotify', 'music.apple', 'pandora', 'soundcloud', 'deezer', 'tidal',
    'youtube', 'twitch', 'crunchyroll', 'funimation', 'vrv.co',
    'audible', 'kindle', 'comixology',
    // Gaming platforms
    'steam', 'epicgames', 'ea.com', 'origin', 'ubisoft', 'uplay', 'gog',
    'playstation', 'xbox', 'nintendo', 'battlenet', 'riotgames', 'gog.com',
    'itch.io', 'humble', 'fanatical', 'greenmangaming'
  ],

  // Productivity & Work
  'Productivity': [
    'notion', 'evernote', 'onenote', 'todoist', 'trello', 'asana', 'jira',
    'confluence', 'monday.com', 'clickup', 'airtable', 'coda', 'dropbox',
    'box.com', 'onedrive', 'drive.google', 'docs.google', 'office365',
    'zoom', 'teams.microsoft', 'webex', 'gotomeeting', 'calendly', 'doodle',
    'figma', 'canva', 'adobe', 'sketch', 'invision',
    'miro', 'loom', 'grammarly', 'basecamp', 'shortcut', 'height.app',
    'smartsheet', 'wrike', 'hubspot', 'salesforce', 'zendesk', 'intercom'
  ],

  // Education & Learning
  // Most university sites end in .edu — those are caught by the TLD check in
  // categorizeUrl() before this list is consulted. This list covers hosted
  // learning platforms and LMS products that use commercial domains.
  'Education': [
    'udemy', 'coursera', 'edx', 'khanacademy', 'duolingo', 'skillshare',
    'pluralsight', 'codecademy', 'freecodecamp', 'leetcode', 'hackerrank',
    'brilliant.org', 'masterclass', 'canvas.instructure', 'blackboard',
    'moodle', 'schoology', 'edmodo', 'classlink', 'clever.com',
    // Additional learning platforms
    'quizlet', 'chegg', 'wolframalpha', 'rosettastone', 'babbel',
    'ted.com', 'scribd', 'academia.edu', 'researchgate', 'jstor',
    'cheggmates', 'studocu', 'coursehero', 'brainly'
  ],

  // Travel & Transportation
  // Replaced vague keywords with domain-specific ones to prevent false positives:
  //   'delta'    → 'delta.com'      (avoids matching deltadentalins.com → Health)
  //   'united'   → 'united.com'     (avoids matching unitedhealth.com → Health)
  //   'american' → 'americanair'    (avoids matching americanexpress.com → Finance)
  //   'budget'   → 'budget.com'     (generic word, too risky unqualified)
  'Travel': [
    'airbnb', 'booking.com', 'expedia', 'hotels.com', 'marriott', 'hilton',
    'hyatt', 'ihg', 'wyndham', 'radisson', 'bestwestern', 'choice hotels',
    'uber', 'lyft', 'lyftdriver', 'grab.com',
    // Airlines — specific enough to avoid false positives
    'delta.com', 'united.com', 'americanair', 'aa.com', 'southwest.com',
    'jetblue', 'spirit', 'frontier.com', 'alaska', 'alaskaair',
    'lufthansa', 'britishairways', 'ba.com', 'airfrance', 'klm',
    'emirates', 'qatarairways', 'singaporeair', 'ryanair', 'easyjet',
    // Booking & aggregators
    'tripadvisor', 'kayak', 'priceline', 'hotwire', 'vrbo', 'travelocity',
    'skyscanner', 'momondo', 'google.com/travel', 'rome2rio',
    // Car rental
    'hertz', 'enterprise.com', 'avis', 'budget.com', 'nationalcar', 'alamo',
    // Rail & transit
    'amtrak', 'eurostar', 'raileurope'
  ],

  // Health & Fitness
  // Now includes health insurance providers to properly separate them from
  // generic financial or other categories.
  'Health': [
    'myfitnesspal', 'fitbit', 'strava', 'peloton', 'nike', 'adidas',
    'garmin', 'whoop', 'headspace', 'calm', 'betterhelp', 'talkspace',
    'zocdoc', 'cvs', 'walgreens', 'riteaid', 'goodrx', 'webmd',
    'mayoclinic', 'healthline', 'teladoc', 'mdlive',
    // Health insurance
    'cigna', 'aetna', 'humana', 'uhc', 'unitedhealth', 'anthem',
    'bcbs', 'bluecross', 'blueshield', 'oscarshealth', 'optum',
    'express-scripts', 'caremark', 'medscape', 'epocrates'
  ],

  // News & Information
  'News': [
    'nytimes', 'wsj', 'washingtonpost', 'reuters', 'bloomberg', 'cnn',
    'bbc', 'theguardian', 'forbes', 'techcrunch', 'wired', 'medium',
    'substack', 'pocket', 'flipboard', 'feedly', 'inoreader',
    'apnews', 'nbcnews', 'abcnews', 'foxnews', 'cbsnews', 'msnbc',
    'theverge', 'arstechnica', 'hackernews', 'news.ycombinator',
    'axios', 'politico', 'theatlantic', 'newyorker', 'vox', 'buzzfeed'
  ],

  // Utilities & Services
  'Utilities': [
    'att', 'verizon', 'tmobile', 'sprint', 'comcast', 'xfinity', 'spectrum',
    'cox', 'frontier', 'centurylink', 'lumen', 'usps', 'ups', 'fedex', 'dhl',
    'yelp', 'grubhub', 'doordash', 'ubereats', 'postmates', 'seamless',
    // Smart home / utilities
    'ring.com', 'nest.com', 'simplisafe', 'vivint', 'adt',
    'pgande', 'nationalgrid', 'duke-energy'
  ],

  // Government & Legal
  // Most .gov and .mil domains are caught by the TLD check in categorizeUrl().
  // This list handles government-adjacent services on commercial domains.
  'Government': [
    'usajobs', 'login.gov', 'id.me', 'realid', 'tsa.gov',
    'dmv.org', 'dmv.ca.gov', 'vehicleregistration'
  ],

  // Adult Content
  // Discrete category so users can route these to a private vault.
  // Listed by domain keyword — all well-known adult platforms.
  'Adult': [
    // Tube sites
    'pornhub', 'xvideos', 'xhamster', 'redtube', 'youporn', 'xnxx',
    'xfantazy', 'spankbang', 'porntrex', 'eporner', 'hclips',
    // Studios & networks
    'brazzers', 'bangbros', 'naughtyamerica', 'realitykings', 'mofos',
    'digitalplayground', 'wickedpictures', 'kink.com',
    // Creator / subscription platforms
    'onlyfans', 'fansly', 'manyvids', 'clips4sale', 'loyalfans',
    'iwantclips', 'niteflirt', 'avnstars',
    // Cam sites
    'chaturbate', 'myfreecams', 'stripchat', 'livejasmin', 'cam4',
    'bongacams', 'camsoda', 'flirt4free', 'jerkmate',
    // Dating / hookup
    'adultfriendfinder', 'ashleymadison', 'fetlife', 'alt.com', 'collarspace',
    // Stores
    'adameve', 'lovehoney', 'babeland'
  ]
};

/* ===================================
   INTERNATIONALISATION (i18n)
   =================================== */
/**
 * I18n — lightweight internationalisation system.
 *
 * Language preference is stored in localStorage and auto-detected from the
 * browser locale if no preference is saved. Falls back to English for any
 * unknown language code.
 *
 * Usage:
 *   I18n.t('toastFileLoaded')                → "File loaded successfully!"
 *   I18n.t('toastProcessed', { count: 42 })  → "Successfully processed 42 items!"
 *
 * Dispatches a 'languagechange' CustomEvent on window when the language
 * switches so UIController can re-render any dynamically built sections.
 */
class I18n {
  static currentLang = 'en';
  static storageKey = 'preferred_lang';

  /**
   * Detect and apply the user's preferred language.
   * Priority: localStorage → browser locale → English.
   * Called once at DOMContentLoaded before UIController initialises.
   */
  static init() {
    let stored = null;
    try { stored = localStorage.getItem(this.storageKey); } catch {}
    const browser = navigator.language?.split('-')[0];
    const detected = (stored && TRANSLATIONS[stored]) ? stored
      : (TRANSLATIONS[browser] ? browser : 'en');
    this.setLanguage(detected, false);
  }

  /**
   * Switch to a different language.
   * @param {string} lang - IETF language code, e.g. 'es'
   * @param {boolean} [save=true] - persist choice to localStorage
   */
  static setLanguage(lang, save = true) {
    if (!TRANSLATIONS[lang]) lang = 'en';
    this.currentLang = lang;
    if (save) {
      try { localStorage.setItem(this.storageKey, lang); } catch {}
    }
    document.documentElement.lang = lang;
    this.applyTranslations();
    this.updatePicker();
    window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang } }));
  }

  /**
   * Look up a translated string and replace {variable} placeholders.
   * Falls back to English, then the raw key if the string is missing.
   * @param {string} key
   * @param {object} [vars] - e.g. { count: 5, category: 'Finance' }
   * @returns {string}
   */
  static t(key, vars = {}) {
    const str = TRANSLATIONS[this.currentLang]?.[key] ?? TRANSLATIONS.en[key] ?? key;
    return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
  }

  /**
   * Walk the DOM and update every element with a data-i18n* attribute.
   *   data-i18n             → element.textContent  (plain text)
   *   data-i18n-html        → element.innerHTML    (trusted translation HTML only)
   *   data-i18n-placeholder → input.placeholder
   *   data-i18n-aria-label  → element aria-label attribute
   */
  static applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = this.t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      el.innerHTML = this.t(el.dataset.i18nHtml);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = this.t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
      el.setAttribute('aria-label', this.t(el.dataset.i18nAriaLabel));
    });
  }

  /** Sync the language picker <select> to the active language. */
  static updatePicker() {
    const picker = document.getElementById('langPicker');
    if (picker) picker.value = this.currentLang;
  }
}

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
      ToastManager.show(I18n.t('toastSaveError'), 'error');
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
      errors.push(I18n.t('errorNoFile'));
      return errors;
    }

    if (file.size > CONSTANTS.MAX_FILE_SIZE) {
      errors.push(I18n.t('errorFileTooLarge', { size: this.formatFileSize(CONSTANTS.MAX_FILE_SIZE) }));
    }

    if (!file.name.endsWith('.json')) {
      errors.push(I18n.t('errorFileType'));
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
   * Strategy:
   *  1. TLD fast-path — unambiguous signals that don't need a keyword list:
   *       .edu  → Education  (university and school sites)
   *       .gov  → Government (US federal/state agencies)
   *       .mil  → Government (US military)
   *  2. Keyword scan — iterate CATEGORY_MAPPINGS in insertion order (Finance first,
   *     Adult last). The first category whose keyword list is a substring of the
   *     domain wins. Keywords are intentionally specific to avoid false positives
   *     (e.g. 'delta.com' rather than plain 'delta' to exclude deltadentalins.com).
   *  3. Fallback — returns "Other" for unrecognised domains.
   *
   * @param {string} url — full URL from the Bitwarden export
   * @returns {string} category name, e.g. "Finance" or "Other"
   */
  categorizeUrl(url) {
    if (!url) return 'Other';

    const domain = this.extractDomain(url);
    if (!domain) return 'Other';

    // TLD fast-path — no keyword list needed for these
    if (domain.endsWith('.gov') || domain.endsWith('.mil')) return 'Government';
    if (domain.endsWith('.edu')) return 'Education';

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

      const handleKeydown = (e) => {
        if (e.key === CONSTANTS.KEYBOARD_SHORTCUTS.ESCAPE) {
          handleCancel();
          return;
        }
        // Focus trap: keep Tab cycling within the dialog
        if (e.key === 'Tab') {
          const focusable = [...this.overlay.querySelectorAll('button:not([disabled])')];
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      const cleanup = () => {
        document.removeEventListener('keydown', handleKeydown);
      };

      this.confirmBtn.addEventListener('click', () => {
        cleanup();
        handleConfirm();
      }, { once: true });
      this.cancelBtn.addEventListener('click', () => {
        cleanup();
        handleCancel();
      }, { once: true });
      document.addEventListener('keydown', handleKeydown);
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

    // --- Language picker ---
    document.getElementById('langPicker')?.addEventListener('change', (e) => {
      I18n.setLanguage(e.target.value);
    });

    // --- Language change: re-render any sections that are already visible ---
    window.addEventListener('languagechange', () => this.onLanguageChange());

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
        ToastManager.success(I18n.t('toastFileLoaded'));
      } catch (error) {
        console.error('JSON parse error:', error);
        ToastManager.error(I18n.t('toastFileInvalid'));
        this.state.rawData = null;
        this.elements.processBtn.disabled = true;
      }
    };

    reader.onerror = () => {
      ToastManager.error(I18n.t('toastFileReadError'));
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
      ToastManager.error(I18n.t('toastNoData'));
      return;
    }

    this.setProcessingState(true);
    LoadingOverlay.show();
    document.getElementById('main-content')?.setAttribute('aria-busy', 'true');

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

        ToastManager.success(I18n.t('toastProcessed', { count: this.state.stats.totalItems }));
        
        // Scroll to results
        this.elements.results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
      } catch (error) {
        console.error('Processing error:', error);
        ToastManager.error(error.message || I18n.t('toastProcessError'));
      } finally {
        LoadingOverlay.hide();
        this.setProcessingState(false);
        document.getElementById('main-content')?.removeAttribute('aria-busy');
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
      btnText.textContent = I18n.t('processing');
    } else {
      this.elements.processBtn.classList.remove('loading');
      this.elements.processBtn.disabled = false;
      spinner.classList.add('hidden');
      btnText.textContent = I18n.t('processFile');
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
        <span class="stat-label">${I18n.t('statTotalItems')}</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${withPasswords}</span>
        <span class="stat-label">${I18n.t('statWithPasswords')}</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${withTOTP}</span>
        <span class="stat-label">${I18n.t('statWith2FA')}</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${withPasskeys}</span>
        <span class="stat-label">${I18n.t('statWithPasskeys')}</span>
      </div>
    `;
    
    this.elements.stats.innerHTML = statsHTML;
    
    // Category breakdown
    if (Object.keys(byCategory).length > 0) {
      const categorySection = document.createElement('div');
      categorySection.className = 'category-breakdown';
      categorySection.innerHTML = `<h3>${I18n.t('categoriesHeading')}</h3>`;
      
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
      openBtn.textContent = I18n.t('openSite');
      openBtn.addEventListener('click', () => this.openPasskeySite(passkey.url));
      
      const doneBtn = document.createElement('button');
      doneBtn.className = 'btn btn-primary';
      doneBtn.textContent = I18n.t('markDone');
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
      ToastManager.warning(I18n.t('toastNoURL'));
      return;
    }

    try {
      window.open(url, '_blank', 'noopener,noreferrer');
      ToastManager.info(I18n.t('toastOpenedTab'));
    } catch (error) {
      ToastManager.error(I18n.t('toastOpenURLError'));
    }
  }

  /**
   * Mark passkey as done
   */
  async markPasskeyDone(name) {
    const confirmed = await DialogManager.show(
      I18n.t('dialogPasskeyTitle'),
      I18n.t('dialogPasskeyMessage', { name })
    );

    if (confirmed) {
      this.state.markPasskeyComplete(name);
      this.renderPasskeys();
      ToastManager.success(I18n.t('toastPasskeyDone'));
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
            placeholder="${I18n.t('vaultNamePlaceholder')}"
            aria-label="${I18n.t('vaultNamePlaceholder')} — ${Utils.sanitizeText(category)}"
            maxlength="50"
          >
          <span class="vault-item-count">${I18n.t(count !== 1 ? 'vaultItemCountPlural' : 'vaultItemCount', { count })}</span>
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
        ? `<span class="vault-merge-note">${I18n.t('vaultMergesPrefix')} ${v.categories.map(c => Utils.sanitizeText(c)).join(', ')}</span>`
        : '';
      return `<li class="vault-list-item">
        <span class="vault-list-name">${Utils.sanitizeText(v.name)}</span>
        <span class="vault-list-count">${I18n.t(v.count !== 1 ? 'vaultItemCountPlural' : 'vaultItemCount', { count: v.count })}</span>
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
      ToastManager.error(I18n.t('toastNoDownload'));
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
      
      ToastManager.success(I18n.t('toastDownloaded'));
    } catch (error) {
      console.error('Download error:', error);
      ToastManager.error(I18n.t('toastDownloadError'));
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
    allFilter.textContent = I18n.t('allFilter');
    allFilter.setAttribute('aria-pressed', 'true');
    allFilter.addEventListener('click', () => this.filterByCategory(null));
    categoryGrid.appendChild(allFilter);

    sortedCategories.forEach(([category, items]) => {
      const filter = document.createElement('button');
      filter.type = 'button';
      filter.className = 'category-filter';
      filter.textContent = `${category} (${items.length})`;
      filter.dataset.category = category;
      filter.setAttribute('aria-pressed', 'false');
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

      // Toggle expand/collapse on click
      header.addEventListener('click', () => {
        const expanded = section.classList.toggle('expanded');
        header.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      });

      // Keyboard navigation: arrow keys move focus between accordion headers
      header.addEventListener('keydown', (e) => {
        const headers = [
          ...this.elements.categoryAccordion.querySelectorAll('.category-section:not(.hidden) .category-header')
        ];
        const idx = headers.indexOf(e.currentTarget);
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          headers[(idx + 1) % headers.length]?.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          headers[(idx - 1 + headers.length) % headers.length]?.focus();
        } else if (e.key === 'Home') {
          e.preventDefault();
          headers[0]?.focus();
        } else if (e.key === 'End') {
          e.preventDefault();
          headers[headers.length - 1]?.focus();
        }
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
      const isActive = category === null ? !filter.dataset.category : filter.dataset.category === category;
      filter.classList.toggle('active', isActive);
      filter.setAttribute('aria-pressed', isActive ? 'true' : 'false');
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
      passwordTag.textContent = I18n.t('tagPassword');
      details.appendChild(passwordTag);
    }

    if (item.hasTotp) {
      const totpTag = document.createElement('span');
      totpTag.className = 'item-tag has-totp';
      totpTag.textContent = I18n.t('tag2FA');
      details.appendChild(totpTag);
    }

    if (item.email) {
      const emailTag = document.createElement('span');
      emailTag.className = 'item-tag';
      emailTag.textContent = I18n.t('tagEmail', { value: item.email });
      details.appendChild(emailTag);
    } else if (item.username) {
      const usernameTag = document.createElement('span');
      usernameTag.className = 'item-tag';
      usernameTag.textContent = I18n.t('tagUser', { value: item.username });
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
    
    ToastManager.success(I18n.t('toastMovedTo', { category: newCategory }));
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
   * Re-render all visible dynamic sections after a language change.
   * Static elements are already handled by I18n.applyTranslations().
   * This covers sections whose content is built entirely in JavaScript.
   */
  onLanguageChange() {
    if (!this.elements.results.classList.contains('hidden')) {
      this.renderStats();
    }
    if (!this.elements.categoryReview.classList.contains('hidden')) {
      this.renderCategoryReview(true);
    }
    if (!this.elements.vaultSetup.classList.contains('hidden')) {
      this.renderVaultSetup();
    }
    if (!this.elements.passkeySection.classList.contains('hidden')) {
      this.renderPasskeys();
    }
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
  // Detect and apply language before any rendering happens
  I18n.init();

  const appState = new AppState();
  const uiController = new UIController(appState); // eslint-disable-line no-unused-vars

  ToastManager.info(I18n.t('toastReady'));

  console.log('Password Migration Tool initialized');
  console.log('All processing happens locally — your data never leaves your device');
});