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
    const { couponCode } = JSON.parse(event.body);

    if (!couponCode) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Coupon code is required' })
      };
    }

    // Check if invitation exists in Firestore
    const invitesSnapshot = await db.collection('invites')
      .where('couponId', '==', couponCode)
      .limit(1)
      .get();

    if (invitesSnapshot.empty) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Invalid invitation code' })
      };
    }

    const inviteDoc = invitesSnapshot.docs[0];
    const inviteData = inviteDoc.data();

    // Check if invitation is already redeemed
    if (inviteData.status === 'redeemed') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'This invitation has already been redeemed' })
      };
    }

    // Check if invitation is expired (optional - you can set expiration dates)
    const sentAt = inviteData.sentAt?.toDate();
    if (sentAt) {
      const daysSinceSent = (new Date() - sentAt) / (1000 * 60 * 60 * 24);
      if (daysSinceSent > 30) { // 30 days expiration
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'This invitation has expired' })
        };
      }
    }

    // Validate coupon exists in Stripe (for non-permanent access types)
    let stripeCoupon = null;
    if (inviteData.accessType !== 'permanent') {
      try {
        stripeCoupon = await stripe.coupons.retrieve(couponCode);
      } catch (stripeError) {
        console.error('Stripe coupon validation failed:', stripeError);
        // Continue without Stripe validation for now
      }
    }

    // Return invitation details
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        invitationId: inviteDoc.id,
        accessType: inviteData.accessType,
        invitedBy: inviteData.invitedBy,
        personalMessage: inviteData.personalMessage,
        sentAt: sentAt,
        stripeCoupon: stripeCoupon,
        isPermanent: inviteData.accessType === 'permanent'
      })
    };

  } catch (error) {
    console.error('Validation error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to validate invitation',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};















