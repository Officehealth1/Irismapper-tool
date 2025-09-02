# Admin Dashboard Implementation Plan
## Date: August 29, 2025

## 🔄 To Continue This Session
```bash
claude --continue /mnt/e/irismapper/irismapperpro-main/ADMIN_DASHBOARD_PLAN.md
```
Or simply tell Claude: "Continue with the admin dashboard implementation from our saved plan"

## ✅ Completed Setup

### 1. Admin Account Configuration
- **Admin Email**: team@irislab.com
- **Admin UID**: rXaPvLXulrMz0HKlkNzRzUGD9v93
- **Status**: Created in Firebase Auth & Firestore

### 2. Admin Bypass Implementation
- Updated `netlify/functions/check-subscription.js` with:
  - Firestore role check (isAdmin: true)
  - Hardcoded email bypass for team@irislab.com
  - Returns unlimited access for admin users

### 3. Firestore Collections Created

#### Users Collection - Admin Document
```javascript
{
  email: "team@irislab.com",
  uid: "rXaPvLXulrMz0HKlkNzRzUGD9v93",
  role: "admin",
  isAdmin: true,
  hasFullAccess: true,
  bypassSubscription: true,
  subscriptionStatus: "admin",
  subscriptionTier: "unlimited",
  displayName: "IrisLab Admin",
  permissions: {
    canInviteUsers: true,
    canViewAllUsers: true,
    canModifyUsers: true
  },
  analytics: {
    canViewTraffic: true,
    canViewUsageStats: true,
    canViewMetadata: true,
    canExportReports: true
  },
  dashboardSettings: {
    defaultView: "overview",
    refreshInterval: 30,
    showRealTimeStats: true,
    enableNotifications: true
  }
}
```

#### Analytics Collection - System Metrics
```javascript
analytics/system_metrics {
  dailyActiveUsers: {
    today: 0,
    yesterday: 0,
    thisWeek: 0,
    thisMonth: 0
  },
  featureUsageStats: {
    totalMapsUsed: 0,
    totalExports: 0,
    totalAdjustments: 0,
    mostUsedMap: ""
  },
  storageConsumption: {
    totalImagesMB: 0,
    totalProjects: 0,
    averageSizeMB: 0
  },
  apiCalls: {
    todayTotal: 0,
    checkSubscription: 0,
    createCheckout: 0
  },
  trialConversions: {
    trialsStarted: 0,
    trialsConverted: 0,
    conversionRate: 0
  },
  subscriptionMetrics: {
    activePractitioner: 0,
    activeClinic: 0,
    monthlyRevenue: 0,
    churnedThisMonth: 0
  },
  lastUpdated: timestamp
}
```

### 4. Other Updates
- ✅ Stripe Live mode configured
- ✅ Live publishable key updated in pricing.js
- ✅ Webhook configured for Live mode
- ✅ Customer portal link updated to: https://billing.stripe.com/p/login/bJebJ15MN39E2QY3JN1gs00

## 📋 Pending Implementation

### Phase 1: Core Infrastructure
- [ ] Create `admin-dashboard.html` - Main admin interface
- [ ] Create `js/admin-dashboard.js` - Dashboard logic  
- [ ] Create `css/admin-dashboard.css` - Admin-specific styling
- [ ] Implement role-based routing after login

### Phase 2: Dashboard Features
- [ ] **Overview Panel**: Active users, revenue, trials display
- [ ] **User Management**: Table with all users and subscription status
- [ ] **Invite System**: Send free access invites with email
- [ ] **Analytics Widgets**: Real-time stats from Firestore
- [ ] **Quick Actions**: Test app, view as user, manage settings

### Phase 3: Backend Functions
- [ ] `netlify/functions/admin-invite-user.js` - Send invites
- [ ] `netlify/functions/admin-get-analytics.js` - Fetch analytics
- [ ] `netlify/functions/admin-get-users.js` - List all users
- [ ] `netlify/functions/admin-update-user.js` - Modify user access

## 🤔 Decisions Needed

### 1. Dashboard Features Priority
- A) User invite system
- B) Analytics/metrics display
- C) User management table  
- D) All equally important

### 2. Invite Email Preferences
- Permanent free access vs extended trial?
- Specific branding/message requirements?

### 3. Stripe Integration for Invites
- Create 100% off coupons in Stripe?
- Or bypass Stripe entirely for invited users?

### 4. Admin Dashboard URL
- `/admin`
- `/admin-dashboard`
- `/dashboard`

### 5. Implementation Strategy
- Build all at once then deploy?
- Or implement in phases with testing?

## 💡 Admin Dashboard Concept

### Login Flow
1. User logs in at `/login`
2. System checks if user.role === 'admin'
3. Admin → redirect to admin dashboard
4. Regular user → redirect to app.html
5. No subscription → redirect to pricing

### Admin Can
- View all users and their subscription status
- Send invite emails with free access
- View analytics and metrics
- Access app without subscription checks
- Switch between admin and user view
- Export reports and data

### Security Measures
- Double verification (client + server)
- Admin-only Netlify functions
- Firestore security rules
- Activity logging
- Role-based access control

## 🔗 Related Files Modified
- `/app.html` - Updated Manage Subscription link
- `/js/pricing.js` - Live Stripe key
- `/netlify/functions/check-subscription.js` - Admin bypass
- `/.gitignore` - Keeping sensitive files out of repo

## 📝 Notes
- Admin email (team@irislab.com) has full bypass
- Firebase manually created users need Firestore records for access
- Stripe customer portal is now using direct link
- System ready for admin dashboard implementation

## Next Session Starting Point
Begin with Phase 1 implementation based on decisions about:
1. Feature priorities
2. Dashboard URL preference  
3. Implementation strategy

---
*Last Updated: August 29, 2025*
*Session can be resumed from this point*