const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

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

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

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

    // Prepare email verification link (Admin SDK generates URL; we will send via SendGrid)
    const siteUrl = (process.env.SITE_URL || 'https://irismapper.com').replace(/\/$/, '');

    // Generate a verification link that redirects to our page with oobCode parameters
    const verificationLink = await admin.auth().generateEmailVerificationLink(normalizedEmail, {
      url: `${siteUrl}/verify-email`,
      handleCodeInApp: true,
    });

    // Also generate a password reset link so user can set their password after verifying
    const passwordResetLink = await admin.auth().generatePasswordResetLink(normalizedEmail, {
      url: `${siteUrl}/reset-password`,
      handleCodeInApp: true,
    });

    // Build direct app URLs with extracted params (avoid client losing query on redirect)
    const verificationURL = new URL(verificationLink);
    const verifyParams = verificationURL.searchParams;
    const verifyOob = verifyParams.get('oobCode');
    const verifyApiKey = verifyParams.get('apiKey');
    const verifyMode = verifyParams.get('mode') || 'verifyEmail';
    const appVerificationUrl = verifyOob
      ? `${siteUrl}/verify-email?mode=${encodeURIComponent(verifyMode)}&oobCode=${encodeURIComponent(verifyOob)}${verifyApiKey ? `&apiKey=${encodeURIComponent(verifyApiKey)}` : ''}`
      : `${siteUrl}/verify-email`;

    const resetURL = new URL(passwordResetLink);
    const resetParams = resetURL.searchParams;
    const resetOob = resetParams.get('oobCode');
    const resetApiKey = resetParams.get('apiKey');
    const resetMode = resetParams.get('mode') || 'resetPassword';
    const appResetUrl = resetOob
      ? `${siteUrl}/reset-password?mode=${encodeURIComponent(resetMode)}&oobCode=${encodeURIComponent(resetOob)}${resetApiKey ? `&apiKey=${encodeURIComponent(resetApiKey)}` : ''}`
      : `${siteUrl}/reset-password`;

    // Send transactional email with SendGrid
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;
    if (!process.env.SENDGRID_API_KEY || !fromEmail) {
      throw new Error('Email service not configured. Missing SENDGRID_API_KEY or SENDGRID_FROM_EMAIL');
    }

    const subject = 'Activate your 14-day IrisMapper Pro trial';
    const textBody = `Welcome to IrisMapper Pro!\n\nPlease verify your email to activate your 14-day trial:\n${appVerificationUrl}\n\nAfter verifying, set your password here:\n${appResetUrl}\n\nIf you didn\'t request this, you can ignore this email.\n\nIf the above links do not work, you can also try these alternate links:\nVerify (fallback): ${verificationLink}\nSet Password (fallback): ${passwordResetLink}`;
    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #333; line-height: 1.6;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4A90E2; margin-top: 0;">Welcome to IrisMapper Pro</h2>
            <p>Thanks for starting your 14-day trial. Please verify your email, then set your password to access the app.</p>
            <div style="margin: 20px 0;">
              <a href="${appVerificationUrl}" style="background: #0dc5a1; color: #fff; padding: 12px 18px; border-radius: 6px; text-decoration: none; display: inline-block;">Verify Email</a>
            </div>
            <p>If the button doesn’t work, copy and paste this link:</p>
            <p style="word-break: break-all; color: #555;">${appVerificationUrl}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <div style="margin: 20px 0;">
              <a href="${appResetUrl}" style="background: #4A90E2; color: #fff; padding: 12px 18px; border-radius: 6px; text-decoration: none; display: inline-block;">Set Password</a>
            </div>
            <p>If the button doesn’t work, copy and paste this link:</p>
            <p style="word-break: break-all; color: #555;">${appResetUrl}</p>
            <p style="margin-top: 28px; font-size: 12px; color: #888;">If you didn’t request this, you can ignore this email.</p>
          </div>
        </body>
      </html>
    `;

    await sgMail.send({
      to: normalizedEmail,
      from: fromEmail,
      subject,
      text: textBody,
      html: htmlBody,
    });

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


