# Auto-Categorization Reference

The Password Migration Tool automatically categorizes your passwords based on their URLs. Here's what categories are available and some examples:

## Available Categories

### Finance
Banking, investments, cryptocurrency, payment services
- **Examples:** Bank of America, Chase, PayPal, Coinbase, Robinhood, Stripe

### Tech
Developer tools, cloud services, code repositories
- **Examples:** GitHub, AWS, Google, Microsoft Azure, Docker, npm

### Social
Social media and messaging platforms
- **Examples:** Facebook, Twitter, LinkedIn, Discord, Slack, Reddit

### Shopping
E-commerce and retail stores
- **Examples:** Amazon, eBay, Walmart, Target, Etsy, Best Buy

### Entertainment
Streaming services, gaming platforms, music
- **Examples:** Netflix, Spotify, Steam, PlayStation, YouTube, Twitch

### Productivity
Work tools, file storage, collaboration software
- **Examples:** Notion, Dropbox, Zoom, Trello, Figma, Adobe

### Education
Learning platforms and educational resources
- **Examples:** Coursera, Udemy, Khan Academy, Duolingo, Codecademy

### Travel
Hotels, airlines, transportation
- **Examples:** Airbnb, Uber, Delta, Expedia, Booking.com, Lyft

### Health
Fitness, wellness, medical services
- **Examples:** MyFitnessPal, Fitbit, CVS, Peloton, Calm, Headspace

### News
News sites and information platforms
- **Examples:** NY Times, WSJ, Medium, TechCrunch, BBC, Reuters

### Utilities
ISPs, phone carriers, delivery services
- **Examples:** Verizon, AT&T, Comcast, UPS, FedEx, Yelp

### Government
Government websites and services
- **Examples:** IRS, SSA, USPS, DMV, USA.gov

### Other
Anything that doesn't match the above categories

## How It Works

1. The app extracts the domain from your URL (e.g., `chase.com` from `https://www.chase.com/login`)
2. It checks the domain against a database of known keywords
3. If a match is found, it assigns that category
4. If no match, it defaults to "Other"

## Adding Custom Categories

To add more domains or create custom categories, edit the `CATEGORY_MAPPINGS` object in `app.js`:

```javascript
const CATEGORY_MAPPINGS = {
  'YourCategory': [
    'domain1', 'domain2', 'keyword1', 'keyword2'
  ],
  // ... existing categories
};
```

The matching is case-insensitive and checks if the domain *contains* any of the keywords.

## Category Stats

After processing, you'll see:
- A breakdown showing how many items are in each category
- Categories sorted by count (most items first)
- Visual icons for each category
- Interactive hover effects

Enjoy organized password migration!
