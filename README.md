# 🔐 Password Migration Tool

A secure, client-side password migration tool for converting Bitwarden exports to Proton Pass format. All processing happens locally in your browser - **your data never leaves your device**.

![License](https://img.shields.io/badge/license-CC%20BY--NC--SA%204.0-blue.svg)
![Version](https://img.shields.io/badge/version-2.0.0-green.svg)
![Non-Commercial](https://img.shields.io/badge/commercial%20use-requires%20permission-red.svg)

## ✨ Features

### 🎯 Core Functionality
- **Client-Side Processing** - All data processing happens in your browser, ensuring complete privacy
- **Automatic Categorization** - 12 smart categories with 200+ pre-mapped domains
- **Interactive Category Review** - Review and edit categories before export
- **Passkey Detection** - Identifies and tracks passkeys that need manual migration
- **Comprehensive Data Migration** - Preserves passwords, 2FA codes, notes, custom fields, and password history

### 🏷️ Smart Categories
- 💰 Finance (Banking, investments, cryptocurrency)
- 💻 Tech (Developer tools, cloud services)
- 👥 Social (Social media, messaging)
- 🛒 Shopping (E-commerce, retail)
- 🎬 Entertainment (Streaming, gaming, music)
- 📝 Productivity (Work tools, file storage)
- 📚 Education (Learning platforms)
- ✈️ Travel (Hotels, airlines, transportation)
- 🏥 Health (Fitness, wellness)
- 📰 News (News sites, information)
- 🔧 Utilities (ISPs, carriers, delivery)
- 🏛️ Government (Government websites)
- 📁 Other (Everything else)

### 🎨 Professional UI/UX
- Modern, responsive design
- Toast notifications for all actions
- Loading states and animations
- Keyboard shortcuts (Ctrl+O, Ctrl+P, Ctrl+F)
- Accessibility features (ARIA labels, keyboard navigation)
- Dark theme optimized for password management

### 🔍 Category Review Features
- **Expandable Categories** - Click to view items in each category
- **Live Search** - Filter items by name instantly
- **Category Editing** - Change any item's category with a dropdown
- **Real-time Stats** - See counts update as you make changes
- **Expand/Collapse All** - Quick controls for easy navigation

## 🚀 Quick Start

### Option 1: Direct File Access
1. Download or clone this repository
2. Open `index.html` in any modern browser
3. That's it! No server needed.

### Option 2: Local Server (Recommended for Development)
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server

# Then visit http://localhost:8000
```

## 📖 How to Use

### Step 1: Export from Bitwarden
1. Open Bitwarden
2. Go to **File** → **Export Vault**
3. Select **JSON** format
4. Save the export file

### Step 2: Process Your Data
1. Open the Password Migration Tool
2. Click **Select File** or drag & drop your Bitwarden JSON export
3. Click **Process File**
4. Wait for processing to complete

### Step 3: Review & Edit Categories
1. Scroll to the **"Review & Edit Categories"** section
2. Click any category to expand and see items
3. Use the dropdown on each item to change its category
4. Use the search box to find specific items

### Step 4: Download & Import
1. Click **Download CSV for Proton Pass**
2. Go to Proton Pass
3. Import the CSV file
4. Manually re-register any passkeys

## 🔒 Security & Privacy

- ✅ **100% Client-Side** - All processing happens in your browser
- ✅ **No Network Requests** - Your data never leaves your device
- ✅ **No Tracking** - No analytics or external services
- ✅ **Open Source** - Audit the code yourself
- ✅ **Content Security Policy** - Protection against XSS attacks

## 🛠️ Technical Details

### Built With
- Pure HTML5, CSS3, and ES6 JavaScript
- No frameworks or dependencies
- Modern browser APIs (FileReader, Blob, localStorage)

### Browser Compatibility
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

### File Structure
```
chatpass/
├── index.html          # Main HTML structure
├── app.js              # Application logic
├── styles.css          # Styling and theme
├── CATEGORIES.md       # Category reference guide
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

### Key Features Implementation
- **State Management** - `AppState` class for centralized data
- **UI Controller** - `UIController` class for all UI interactions
- **Data Processor** - `DataProcessor` class for CSV generation
- **Toast System** - `ToastManager` for user notifications
- **Dialog System** - `DialogManager` for confirmations
- **CSV Escaping** - RFC 4180 compliant escaping

## 🎯 CSV Output Format

The tool generates a CSV file with the following columns:
- `type` - Always "login"
- `name` - Item name
- `url` - Primary URL
- `email` - Email/username field
- `username` - Username
- `password` - Password
- `note` - Combined notes (original notes, custom fields, password history, TOTP, extra URLs, metadata)
- `totp` - 2FA TOTP code
- `createTime` - Creation timestamp
- `modifyTime` - Last modified timestamp
- `vault` - Category name (Finance, Tech, etc.)

## ⌨️ Keyboard Shortcuts

- **Ctrl/Cmd + O** - Open file dialog
- **Ctrl/Cmd + P** - Process file (when enabled)
- **Ctrl/Cmd + F** - Focus search (in category review)
- **Enter/Space** - Activate focused elements

## 🐛 Known Limitations

- **Passkeys** - Cannot be exported due to security restrictions; must be manually re-registered
- **File Attachments** - Not supported in CSV format
- **Folders** - Bitwarden folders are not preserved; use categories instead

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Adding New Categories
Edit `CATEGORY_MAPPINGS` in `app.js`:
```javascript
const CATEGORY_MAPPINGS = {
  'YourCategory': [
    'domain1', 'domain2', 'keyword1'
  ],
  // ... existing categories
};
```

## 📝 License

This project is licensed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0)**.

### What this means:

✅ **You CAN:**
- Use this tool for personal, educational, or non-profit purposes
- Modify and improve the code
- Share it with others
- Create derivative works

❌ **You CANNOT:**
- Use this commercially without written permission
- Sell this software or services based on it
- Use it in commercial products without authorization

### Commercial Use

**To use this software commercially, you must obtain written permission from the copyright holder.**

📧 Contact for commercial licensing: Create an issue in the GitHub repository

### Full License

See the [LICENSE](LICENSE) file for the complete terms, or visit:
https://creativecommons.org/licenses/by-nc-sa/4.0/

---

**Copyright © 2026 bict0r. All Rights Reserved (for commercial use).**

## 🙏 Acknowledgments

- Inspired by the need for secure, client-side password migration
- Built with privacy and security as top priorities
- Thanks to the Bitwarden and Proton Pass communities

## 📧 Support

If you encounter any issues or have questions:
1. Check the [Issues](../../issues) page
2. Search for similar problems
3. Create a new issue with details about your problem

## 🔗 Related Projects

- [Bitwarden](https://bitwarden.com/) - Open-source password manager
- [Proton Pass](https://proton.me/pass) - Privacy-focused password manager

---

**⚠️ Important Security Note:** Always verify the CSV output before importing into Proton Pass. Keep your Bitwarden export file in a secure location and delete it after successful migration.
