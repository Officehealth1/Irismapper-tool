const admin = require('firebase-admin');

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(),
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { email, tier } = JSON.parse(event.body || '{}');

    if (!email || typeof email !== 'string') {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'Email is required' }),
      };
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Create or fetch Firebase Auth user
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(normalizedEmail);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        const tempPassword = generateStrongTempPassword();
        userRecord = await admin.auth().createUser({
          email: normalizedEmail,
          password: tempPassword,
          emailVerified: false,
        });
      } else {
        throw err;
      }
    }

    // Compute trial end (14 days from now)
    const now = new Date();
    const trialEndsAtDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Upsert Firestore user record
    const userRef = db.collection('users').doc(userRecord.uid);
    const userSnap = await userRef.get();

    const baseData = {
      email: normalizedEmail,
      uid: userRecord.uid,
      subscriptionStatus: 'trialing',
      subscriptionPlan: 'trial',
      subscriptionTier: tier || 'practitioner',
      trialStartsAt: admin.firestore.FieldValue.serverTimestamp(),
      trialEndsAt: admin.firestore.Timestamp.fromDate(trialEndsAtDate),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (userSnap.exists) {
      await userRef.update(baseData);
    } else {
      await userRef.set({
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        ...baseData,
      });
    }

    // Prepare email verification link (Admin SDK does NOT send emails by itself)
    const siteUrl = (process.env.SITE_URL || 'https://irismapper.com').replace(/\/$/, '');

    // Generate a verification link that goes directly to our domain (no Firebase redirect)
    const verificationLink = await admin.auth().generateEmailVerificationLink(normalizedEmail, {
      url: `${siteUrl}/verify-email`,
      handleCodeInApp: false, // This prevents Firebase from processing the link first
    });

    // Also generate a password reset link so user can set their password after verifying (for testing convenience)
    const passwordResetLink = await admin.auth().generatePasswordResetLink(normalizedEmail, {
      url: `${siteUrl}/setup-password`,
      handleCodeInApp: false, // This prevents Firebase from processing the link first
    });

    // NOTE: We are not sending the link here via email provider; Firebase sends it.
    // The generated link can be used with your ESP if needed.

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        message: 'Trial started. Please check your email to verify your account.',
        email: normalizedEmail,
        userId: userRecord.uid,
        // For local/dev testing only: include links when explicitly enabled
        ...(includeTestLinks() ? { verificationLink, passwordResetLink } : {}),
      }),
    };
  } catch (error) {
    console.error('start-trial error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Failed to start trial', details: error.message }),
    };
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function generateStrongTempPassword() {
  // 24+ char random string with mixed charset
  const part = () => Math.random().toString(36).slice(-12);
  return part() + part();
}

function includeTestLinks() {
  return process.env.NETLIFY_DEV === 'true' || process.env.SEND_TEST_LINKS_IN_RESPONSE === 'true';
}


