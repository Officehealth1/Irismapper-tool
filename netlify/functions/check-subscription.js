const admin = require('firebase-admin');

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

exports.handler = async (event) => {
  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get user ID from query parameters or authorization header
    const userId = event.queryStringParameters?.userId;
    const email = event.queryStringParameters?.email;
    
    if (!userId && !email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'User ID or email required' })
      };
    }

    let userDoc;
    
    if (userId) {
      userDoc = await db.collection('users').doc(userId).get();
    } else {
      const userQuery = await db.collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();
      
      if (!userQuery.empty) {
        userDoc = userQuery.docs[0];
      }
    }

    if (!userDoc || !userDoc.exists) {
      return {
        statusCode: 404,
        body: JSON.stringify({ 
          hasSubscription: false,
          message: 'User not found' 
        })
      };
    }

    const userData = userDoc.data();
    const now = new Date();

    // Check subscription status
    let isActive = false;
    let isTrialing = false;
    let daysRemaining = 0;

    if (userData.subscriptionStatus === 'active') {
      isActive = true;
    } else if (userData.subscriptionStatus === 'trialing') {
      if (userData.trialEndsAt && userData.trialEndsAt.toDate() > now) {
        isTrialing = true;
        isActive = true;
        // Calculate days remaining in trial
        const diffTime = userData.trialEndsAt.toDate() - now;
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    // Check if subscription period is still valid
    if (userData.currentPeriodEnd && userData.currentPeriodEnd.toDate() < now) {
      isActive = false;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        hasSubscription: isActive,
        isTrialing: isTrialing,
        trialDaysRemaining: daysRemaining,
        subscriptionTier: userData.subscriptionTier || null,
        subscriptionPlan: userData.subscriptionPlan || null,
        subscriptionStatus: userData.subscriptionStatus || 'none',
        currentPeriodEnd: userData.currentPeriodEnd || null,
        cancelAtPeriodEnd: userData.cancelAtPeriodEnd || false
      })
    };

  } catch (error) {
    console.error('Check subscription error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to check subscription',
        details: error.message 
      })
    };
  }
};