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
- **Build Tools**: Netlify (hosting), Node.js (serverless functions), Stripe (payments)

## Development Commands

```bash
# Install dependencies
npm install

# Development with Netlify Dev (includes serverless functions)
npm run dev

# Manual Netlify dev server
netlify dev

# Build command (returns success - no build process needed)
npm run build

# No test runner or linting configured
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

2. **Authentication & Subscription System** 
   - `js/auth-check.js`: Firebase authentication check for main app
   - `js/auth-redirect.js`: Subscription gate for main app access
   - `js/admin.js`: Admin panel functionality with user management
   - `js/pricing.js`: Stripe payment integration with modal system
   - `netlify/functions/`: Serverless payment processing functions

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
- **Authentication**: Firebase-based access control with Stripe subscription gating
- **Payment System**: Stripe integration with 14-day free trials and tiered pricing

### File Structure

```
/
├── grids/              # SVG iris map templates
├── css/                # Stylesheets (admin, auth, login, pricing)
├── js/                 # JavaScript modules
│   ├── admin.js        # Admin panel logic
│   ├── auth-check.js   # Authentication verification
│   ├── auth-redirect.js # Subscription access control
│   ├── pricing.js      # Stripe payment integration
│   └── firebase-config.js # Firebase configuration
├── netlify/
│   └── functions/      # Serverless payment functions
├── app.html            # Main iris mapping application
├── pricing.html        # Homepage with subscription plans
├── success.html        # Post-payment confirmation
├── login.html          # User authentication
├── script.js           # Core application logic
├── style.css           # Main stylesheet
├── histogramWorker.js  # Web Worker for histogram
├── _redirects          # Netlify routing configuration
└── netlify.toml        # Netlify deployment configuration
```

## Important Patterns

### Image Processing Pipeline
1. Image upload → Canvas rendering
2. Apply adjustments via CSS filters
3. Overlay SVG map with configurable opacity
4. Calculate histogram in Web Worker
5. Export combined result with html2canvas

### State Management
- Global variables in `script.js` for current image, map, and adjustment values
- Gallery state maintained in accordion structure with image data persistence
- Authentication state managed by Firebase with subscription gating
- Image adjustments stored per-image in gallery using CSS filter strings

### Firebase Integration
- User authentication required for app access
- Admin panel for user management
- Path detection for deployment flexibility

### Netlify Serverless Functions
- Payment processing via Stripe webhooks
- Subscription status verification
- Auto-login token generation for seamless user experience
- CORS headers configured for cross-origin requests

## Common Tasks

### Adding New Iris Maps
1. Add SVG files to `/grids/` directory with naming pattern: `MapName_Map_LANG_Version_L/R.svg`
2. Update `availableMaps` array in `script.js` around line 22
3. Maps automatically appear in modal selection with left/right eye variants

### Modifying Image Adjustments
- Adjustment sliders defined in `adjustmentSliders` object in `script.js:33`
- Processing applied via Canvas filter strings (exposure, contrast, saturation, etc.)
- Values persist per image in gallery structure
- Histogram calculations performed in `histogramWorker.js`

### Working with Authentication
- Firebase config in `js/firebase-config.js` (not in repo for security)
- Authentication check runs on page load via `js/auth-check.js`
- Admin status verification for admin panel access in `js/admin.js`
- Subscription gating enforced via `js/auth-redirect.js` before main app access

### Payment System Development
- Use Stripe test keys for development (4242 4242 4242 4242)
- Environment variables required for Netlify deployment
- Functions handle checkout, subscription checks, and webhook processing
- Email modal system for user data collection before payment in `js/pricing.js`

### Debugging Tips
- Check browser console for Canvas/CORS errors with image uploads
- Firebase auth state changes logged in browser console
- Netlify function logs available in deployment dashboard
- SVG map rendering issues usually related to file paths or naming conventions

### User Flow
- **Homepage** (`https://irismapper.com/`) → Serves pricing page content with clean URL
- **"Start Free Trial" buttons** throughout page → Scroll to pricing cards section (`#pricing-cards`)
- **Pricing card buttons** → Email modal → Stripe checkout → Success page → Main app
- **Login** accessible via `/login` for existing users with active subscriptions

## Subscription System

### Pricing Tiers
**Practitioner:** £10/month, £80/year, £120/2years  
**Clinic:** £30/month, £160/year, £240/2years  
All plans include 14-day free trial

### Environment Variables Required
Set these in Netlify deployment:
- `STRIPE_PUBLISHABLE_KEY` / `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- Price IDs for each tier (`PRICE_PRACTITIONER_MONTHLY`, etc.)
- Firebase service account credentials

### Netlify Functions
- `create-checkout.js` - Stripe checkout session creation
- `stripe-webhook.js` - Payment event processing  
- `check-subscription.js` - Subscription status verification
- `manage-billing.js` - Customer portal access
- `create-auto-login.js` - Seamless post-payment authentication