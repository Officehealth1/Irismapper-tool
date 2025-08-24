# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Iris Mapper Pro is a web-based SaaS application for iris mapping diagnostics. Users can upload iris photographs, apply professional image adjustments, overlay diagnostic iris maps, and export results. The application supports both single and dual eye views with multiple iris mapping systems.

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Netlify Functions (serverless)
- **Authentication**: Firebase Auth
- **Database**: Firebase Firestore
- **Payments**: Stripe (subscriptions & checkout)
- **Email**: SendGrid (transactional emails)
- **Hosting**: Netlify
- **Image Processing**: Canvas API, Web Workers

## Development Commands

```bash
# Install dependencies
npm install

# Run local development server with Netlify Dev
npm run dev

# No build process required - static files served directly
# No test suite configured
# No linting configured
```

## Architecture

### Application Pages

1. **Main Application** (`app.html`, `script.js`)
   - Core iris mapping functionality
   - Protected by authentication & subscription

2. **Authentication Flow**
   - `login.html` - User login with Firebase
   - `forgot-password.html` - Password reset initiation
   - `reset-password.html` - Password reset completion
   - `setup-password.html` - Initial password setup
   - `verify-email.html` - Email verification

3. **Subscription System**
   - `pricing.html` - Pricing tiers & checkout
   - `success.html` - Post-payment confirmation
   - Stripe integration via Netlify Functions

### Netlify Functions (serverless endpoints)

```
netlify/functions/
├── create-checkout.js          # Stripe checkout session
├── stripe-webhook.js           # Handle Stripe events
├── check-subscription.js       # Verify subscription status
├── create-portal-session.js    # Customer billing portal
├── setup-user-password.js      # Password setup flow
├── validate-setup-token.js     # Token validation
└── cleanup-expired-tokens.js   # Maintenance task
```

### Core Features

1. **Image Processing**
   - Real-time adjustments (exposure, contrast, saturation, hue, etc.)
   - Histogram analysis with Web Workers
   - Auto-level calculation
   - Multi-image gallery management

2. **Iris Maps** (8 systems, 16 total maps)
   - Angerer (DE), Bourdiol (FR), IrisLAB (EN/FR)
   - Jaussas (FR), Jensen (EN/FR), Roux (FR)
   - Left/Right eye variants for each

3. **Subscription Tiers**
   - Practitioner: £10/month, £80/year, £120/2years
   - Clinic: £30/month, £160/year, £240/2years
   - 14-day free trial for all plans

### State Management

- **Authentication**: Firebase Auth state
- **Subscription**: Stored in Firebase custom claims
- **Image State**: Global variables in script.js
- **Gallery**: Accordion-based multi-image management

## Deployment Configuration

### Required Environment Variables

```bash
# Stripe (Test Mode)
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs
PRICE_PRACTITIONER_MONTHLY=price_...
PRICE_PRACTITIONER_YEARLY=price_...
PRICE_PRACTITIONER_2YEAR=price_...
PRICE_CLINIC_MONTHLY=price_...
PRICE_CLINIC_YEARLY=price_...
PRICE_CLINIC_2YEAR=price_...

# SendGrid
SENDGRID_API_KEY=SG...
SENDGRID_FROM_EMAIL=noreply@irismapper.com

# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT={"type":"service_account"...}
```

### Email Configuration

See `EMAIL_SETUP.md` for SendGrid domain authentication:
- SPF records configured
- DKIM authentication pending
- DMARC policy optional

## Key Implementation Details

### Image Processing Pipeline

1. Upload → Canvas rendering
2. Apply CSS filters for adjustments
3. Overlay SVG map with opacity control
4. Calculate histogram in Web Worker
5. Export via html2canvas

### Authentication Flow

1. User visits site → Redirects to pricing
2. Selects plan → Email collection modal
3. Stripe checkout → 14-day trial begins
4. Email verification → Access granted
5. Firebase custom claims store subscription

### Adding New Features

**New Iris Maps:**
- Add SVG to `/grids/` with pattern: `Name_Map_LANG_V1_L/R.svg`
- Update `availableMaps` array in script.js

**New Image Adjustments:**
- Add to `adjustmentSliders` object
- Implement filter in Canvas processing

## Security Considerations

- Never commit API keys or secrets
- Firebase config is public (OK by design)
- Stripe keys use test mode for development
- All sensitive operations in serverless functions
- CORS headers configured in netlify.toml