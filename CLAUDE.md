# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Iris Mapper Pro is a web-based iris mapping application that allows users to overlay diagnostic iris maps onto iris photographs. The application supports single and dual eye views, image adjustments, and multiple iris mapping templates.

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Libraries**: 
  - html2canvas (for image export)
  - DOMPurify (for sanitisation)
  - Firebase (authentication and database)
- **Image Processing**: Canvas API with Web Workers for histogram calculations
- **Build Tools**: Node.js with Express (optional server setup)

## Development Commands

```bash
# Install dependencies
npm install

# No build process - static files served directly
# No test runner configured
# No linting configured

# For development with live reload (if using nodemon)
npx nodemon [server-file]
```

## Architecture

### Core Components

1. **Main Application** (`script.js`)
   - Image upload and management
   - SVG map overlay system
   - Image adjustment controls (exposure, contrast, saturation, etc.)
   - Gallery management for multiple images
   - Histogram analysis with Web Workers
   - Save/export functionality

2. **Authentication System** 
   - `js/auth-check.js`: Firebase authentication check for main app
   - `js/admin.js`: Admin panel functionality with user management
   - Firebase integration for user authentication

3. **UI Structure**
   - Single mapper view and dual mapper view (L+R eyes)
   - Control panels (top-left menu, bottom controls, gallery)
   - Modal system for map selection and notes
   - Real-time image adjustments with sliders

### Key Features

- **Map Overlays**: 8 different iris mapping systems (Angerer, Bourdiol, IrisLAB, Jaussas, Jensen, Roux) with left/right eye variants
- **Image Processing**: Real-time adjustments using Canvas filters
- **Histogram Analysis**: Web Worker-based histogram calculation for auto-levels
- **Multi-image Support**: Gallery with accordion-style image management
- **Authentication**: Firebase-based access control

### File Structure

```
/
├── grids/              # SVG iris map templates
├── css/                # Stylesheets
│   ├── admin.css
│   └── auth.css
├── js/                 # JavaScript modules
│   ├── admin.js        # Admin panel logic
│   └── auth-check.js   # Authentication verification
├── index.html          # Main application
├── script.js           # Core application logic
├── style.css           # Main stylesheet
└── histogramWorker.js  # Web Worker for histogram
```

## Important Patterns

### Image Processing Pipeline
1. Image upload → Canvas rendering
2. Apply adjustments via CSS filters
3. Overlay SVG map with configurable opacity
4. Calculate histogram in Web Worker
5. Export combined result with html2canvas

### State Management
- Global variables for current image, map, and adjustment values
- Gallery state maintained in accordion structure
- Authentication state managed by Firebase

### Firebase Integration
- User authentication required for app access
- Admin panel for user management
- Path detection for deployment flexibility

## Common Tasks

### Adding New Iris Maps
1. Add SVG files to `/grids/` directory with naming pattern: `MapName_Map_LANG_Version_L/R.svg`
2. Update `availableMaps` array in `script.js`

### Modifying Image Adjustments
- Adjustment sliders defined in `adjustmentSliders` object
- Processing applied via Canvas filter strings
- Values persist per image in gallery

### Working with Authentication
- Firebase config expected in separate `firebase-config.js` file
- Authentication check runs on page load
- Admin status verification for admin panel access

## Subscription System Plan (In Progress)

### Pricing Tiers
**Practitioner:**
- Monthly: £10/month
- Yearly: £80/year (33% off)
- 2 Years: £120/2years (50% off)

**Clinic:**
- Monthly: £30/month
- Yearly: £160/year (56% off)
- 2 Years: £240/2years (67% off)

All plans include 14-day free trial

### Implementation Status
- ✅ Domain configured: irismapper.com on Netlify
- ✅ DNS setup complete with GoDaddy
- ⏳ Stripe integration pending
- ⏳ Netlify Functions for payments pending
- ⏳ Feature differentiation between tiers pending

### Implementation Status - READY FOR DEPLOYMENT
- ✅ Domain configured: irismapper.com on Netlify
- ✅ DNS setup complete with GoDaddy
- ✅ Stripe account created with test keys
- ✅ Professional pricing page designed (matches irislab.com aesthetic)
- ✅ Netlify Functions for payments created
- ✅ Email modal system implemented
- ✅ Security audit passed - safe for GitHub

### Deployment Checklist - READY TO DEPLOY

#### 1. Environment Variables for Netlify
```
STRIPE_PUBLISHABLE_KEY=pk_test_51RM3mWFqKKPQ6G55T0c4kmMJgVZGobBatUXrTWE16BrYJgDhrZ28LMaicuXveqQQ8k461fPFNLCL1v1IIlGq6OBR00lPAvZr1R
STRIPE_SECRET_KEY=sk_test_51RM3mWFqKKPQ6G55mIZv9ktdFixiraxCiizdrgsCNOnwLxTuCk7YiGDKa8QqleoipYrXGIliBxsSeCK4JXOu9JmV001mLExJw6
STRIPE_WEBHOOK_SECRET=whsec_17BbsXO9CRIzcCSLFW6lZo5vTP6cAGTO

PRICE_PRACTITIONER_MONTHLY=price_1Ryl4vFqKKPQ6G55rwaBOdT0
PRICE_PRACTITIONER_YEARLY=price_1Ryl8PFqKKPQ6G557x2YEQMq
PRICE_PRACTITIONER_2YEAR=price_1Ryl8PFqKKPQ6G55oFWQXZhi

PRICE_CLINIC_MONTHLY=price_1Ryl7FFqKKPQ6G55VaLmEhM1
PRICE_CLINIC_YEARLY=price_1Ryl7FFqKKPQ6G55wlwJItIO
PRICE_CLINIC_2YEAR=price_1Ryl7FFqKKPQ6G55Qww2Rxpx
```

#### 2. Files Created/Modified
- ✅ `pricing.html` - Professional pricing page
- ✅ `css/pricing.css` - Dark theme matching irislab.com
- ✅ `js/pricing.js` - Modal system & Stripe integration
- ✅ `js/auth-redirect.js` - Subscription gate for main app
- ✅ `netlify/functions/` - 4 serverless functions for payments
- ✅ `success.html` - Post-payment confirmation
- ✅ `_redirects` - Netlify routing configuration
- ✅ `.gitignore` - Security protection

#### 3. User Flow
1. irismapper.com → Redirects to pricing page
2. Professional pricing selection → Email modal
3. Stripe checkout → 14-day trial starts
4. Success page → Access to main app

#### 4. Test Cards
- Card: 4242 4242 4242 4242
- Any future expiry, any CVC

### Still Needed
1. Firebase service account credentials
2. Test complete flow on live site
3. Switch to live Stripe keys for production

### Git Commands to Deploy
```bash
git init
git add .
git commit -m "Add subscription system"
git push to GitHub
```

### Next Session Tasks
1. Add Firebase credentials to Netlify
2. Test payment flow end-to-end
3. Switch to production Stripe keys when ready