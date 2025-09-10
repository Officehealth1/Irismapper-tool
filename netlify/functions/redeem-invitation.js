const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const { couponCode, userEmail, userId } = JSON.parse(event.body);

    if (!couponCode || !userEmail || !userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Find the invitation
    const invitesSnapshot = await db.collection('invites')
      .where('couponId', '==', couponCode)
      .limit(1)
      .get();

    if (invitesSnapshot.empty) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Invitation not found' })
      };
    }

    const inviteDoc = invitesSnapshot.docs[0];
    const inviteData = inviteDoc.data();

    // Check if already redeemed
    if (inviteData.status === 'redeemed') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invitation already redeemed' })
      };
    }

    // Update invitation status
    await inviteDoc.ref.update({
      status: 'redeemed',
      redeemedBy: userEmail,
      redeemedByUid: userId,
      redeemedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Handle different access types
    const accessType = inviteData.accessType;
    let userData = {};

    if (accessType === 'permanent') {
      // Permanent free access - no subscription needed
      userData = {
        email: userEmail,
        subscriptionStatus: 'active',
        subscriptionPlan: 'permanent_free',
        subscriptionTier: 'unlimited',
        isAdmin: false,
        role: 'user',
        invitedBy: inviteData.invitedBy,
        invitationRedeemed: true,
        couponId: couponCode,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
    } else if (accessType === 'extended_trial') {
      // Extended trial (90 days)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 90);
      
      userData = {
        email: userEmail,
        subscriptionStatus: 'trialing',
        subscriptionPlan: 'extended_trial',
        subscriptionTier: 'unlimited',
        isAdmin: false,
        role: 'user',
        invitedBy: inviteData.invitedBy,
        invitationRedeemed: true,
        couponId: couponCode,
        trialEndDate: admin.firestore.Timestamp.fromDate(trialEndDate),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
    } else if (accessType === 'practitioner' || accessType === 'clinic') {
      // Free plan access with coupon
      userData = {
        email: userEmail,
        subscriptionStatus: 'active',
        subscriptionPlan: accessType,
        subscriptionTier: accessType,
        isAdmin: false,
        role: 'user',
        invitedBy: inviteData.invitedBy,
        invitationRedeemed: true,
        couponId: couponCode,
        freeAccessGranted: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
    }

    // Create or update user document
    const userRef = db.collection('users').doc(userId);
    await userRef.set(userData, { merge: true });

    // Log the redemption
    await db.collection('invite_redemptions').add({
      couponCode: couponCode,
      userEmail: userEmail,
      userId: userId,
      accessType: accessType,
      invitedBy: inviteData.invitedBy,
      redeemedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Invitation redeemed successfully',
        accessType: accessType,
        userData: userData
      })
    };

  } catch (error) {
    console.error('Redemption error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to redeem invitation',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};















