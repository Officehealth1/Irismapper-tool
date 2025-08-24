const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Event deduplication now handled via Firestore collections

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

// Function to generate and send verification email via SendGrid
async function sendVerificationEmail(email) {
  try {
    // Add retry logic with exponential backoff for rate limiting
    let verificationLink;
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        const firebaseVerifyLink = await admin.auth().generateEmailVerificationLink(
          email,
          { url: 'https://irismapper.com/login' }
        );
        
        // Extract oobCode and create custom branded verification link
        const verifyUrl = new URL(firebaseVerifyLink);
        const verifyOobCode = verifyUrl.searchParams.get('oobCode');
        verificationLink = `https://irismapper.com/verify-email?mode=verifyEmail&oobCode=${verifyOobCode}`;
        break; // Success, exit loop
      } catch (error) {
        if (error.message?.includes('TOO_MANY_ATTEMPTS')) {
          retries++;
          if (retries >= maxRetries) {
            throw error; // Max retries reached
          }
          // Exponential backoff: 2s, 4s, 8s
          const delay = Math.pow(2, retries) * 1000;
          console.log(`Rate limited, retrying in ${delay}ms (attempt ${retries}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error; // Different error, don't retry
        }
      }
    }

    console.log(`✅ Verification link generated for ${email}`);

    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: 'Verify Your IrisMapper Account',
      text: `Welcome to IrisMapper! Please verify your email address by clicking this link: ${verificationLink}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">IrisMapper</h1>
                      <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px;">Welcome to Your Journey!</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px;">Verify Your Email Address</h2>
                      <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                        Thank you for subscribing to IrisMapper! To complete your registration and access all features,
                        please verify your email address by clicking the button below.
                      </p>
                      <table role="presentation" style="margin: 30px auto;">
                        <tr>
                          <td style="border-radius: 6px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                            <a href="${verificationLink}"
                               target="_blank"
                               style="display: inline-block; padding: 16px 36px; color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none; border-radius: 6px;">
                              Verify Email Address
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin: 30px 0 20px 0; color: #999999; font-size: 14px;">Or copy and paste this link into your browser:</p>
                      <p style="margin: 0 0 30px 0; padding: 15px; background-color: #f8f9fa; border-radius: 4px; word-break: break-all; color: #666666; font-size: 12px;">
                        ${verificationLink}
                      </p>
                      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eeeeee;">
                      <p style="margin: 0; color: #999999; font-size: 14px; line-height: 1.5;">
                        This verification link will expire in 24 hours. If you didn't create an account with IrisMapper,
                        you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 30px; text-align: center; background-color: #f8f9fa; border-radius: 0 0 8px 8px;">
                      <p style="margin: 0 0 10px 0; color: #999999; font-size: 12px;">Need help? Contact us at support@irismapper.com</p>
                      <p style="margin: 0; color: #999999; font-size: 12px;">© 2025 IrisMapper. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    };

    await sgMail.send(msg);
    console.log(`✅ Verification email sent successfully to ${email}`);

    return { success: true, message: 'Verification email sent successfully' };
  } catch (error) {
    console.error('Error sending verification email:', error);
    if (error.response) {
      console.error('SendGrid error response:', error.response.body);
    }
    return { success: false, error: error.message };
  }
}


exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const sig = event.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;

  try {
    // Verify webhook signature
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      endpointSecret
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `Webhook Error: ${err.message}` })
    };
  }

  // Check if this Stripe event has already been processed
  const eventId = stripeEvent.id;
  const eventCheck = await db.collection('processed_stripe_events').doc(eventId).get();
  
  if (eventCheck.exists) {
    console.log(`Event ${eventId} already processed - skipping`);
    return {
      statusCode: 200,
      body: JSON.stringify({ received: true, duplicate: true })
    };
  }
  
  // Mark this event as being processed (with TTL for cleanup)
  const twentyFourHoursFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.collection('processed_stripe_events').doc(eventId).set({
    processedAt: admin.firestore.FieldValue.serverTimestamp(),
    eventType: stripeEvent.type,
    expiresAt: twentyFourHoursFromNow
  });

  // Handle the event
  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        const session = stripeEvent.data.object;
        await handleCheckoutCompleted(session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated': // do not send verification here; guard prevents duplicates
        const subscription = stripeEvent.data.object;
        await updateSubscription(subscription);
        break;

      case 'customer.subscription.deleted':
        const canceledSub = stripeEvent.data.object;
        await cancelSubscription(canceledSub);
        break;

      case 'customer.subscription.trial_will_end':
        const trialEndingSub = stripeEvent.data.object;
        await handleTrialEnding(trialEndingSub);
        break;

      default:
        // Intentionally ignored event
        break;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    };

  } catch (error) {
    console.error('Webhook processing error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Webhook processing failed' })
    };
  }
};


async function updateSubscription(subscription) {
  const customer = await stripe.customers.retrieve(subscription.customer);
  
  // For new subscriptions, check if we've already processed this subscription creation
  if (subscription.status === 'trialing' || subscription.status === 'active') {
    const subCheck = await db.collection('processed_subscriptions').doc(subscription.id).get();
    
    if (subCheck.exists) {
      console.log(`Subscription ${subscription.id} creation already processed, skipping new user flow`);
      // Continue with regular update flow below
    } else {
      // Mark this subscription as processed for new user creation
      const twentyFourHoursFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await db.collection('processed_subscriptions').doc(subscription.id).set({
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        customerId: customer.id,
        customerEmail: customer.email,
        status: subscription.status,
        expiresAt: twentyFourHoursFromNow
      });
    }
  }
  
  // Find user by Stripe customer ID or email
  let userQuery = await db.collection('users')
    .where('stripeCustomerId', '==', customer.id)
    .limit(1)
    .get();
    
  // If not found by customer ID, try by email
  if (userQuery.empty) {
    userQuery = await db.collection('users')
      .where('email', '==', customer.email)
      .limit(1)
      .get();
  }
  
  if (!userQuery.empty) {
    const userDoc = userQuery.docs[0];
    
    await userDoc.ref.update({
      subscriptionStatus: subscription.status,
      currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Backfill identifiers if missing
    const existingData = userDoc.data();
    const backfill = {};
    if (!existingData.stripeCustomerId) backfill.stripeCustomerId = customer.id;
    if (!existingData.subscriptionId) backfill.subscriptionId = subscription.id;
    if (Object.keys(backfill).length > 0) {
      await userDoc.ref.set(backfill, { merge: true });
    }

    console.log(`Subscription updated for customer: ${customer.id}`);
    
    // Check if user is verified in Firebase Auth (for existing users)
    if (subscription.status === 'trialing' || subscription.status === 'active') {
      try {
        const userData = userDoc.data();
        if (!userData.emailVerified) {
          try {
            const firebaseUser = await admin.auth().getUserByEmail(customer.email);
            if (firebaseUser.emailVerified) {
              await userDoc.ref.update({ emailVerified: true });
              console.log(`User ${customer.email} already verified in Firebase Auth - updated Firestore`);
            } else {
              console.log(`User ${customer.email} not verified yet - verification handled during account creation`);
            }
          } catch (authError) {
            console.error(`Error checking Firebase Auth user:`, authError);
          }
        }
      } catch (error) {
        console.error('Failed verification status check:', error);
      }
    }
  } else {
    // If user doesn't exist, check if this subscription was already processed for user creation
    const subCheck = await db.collection('processed_subscriptions').doc(subscription.id).get();
    
    if (!subCheck.exists && (subscription.status === 'trialing' || subscription.status === 'active')) {
      // Only create user if subscription hasn't been processed yet
      console.log(`Creating new user for subscription: ${customer.email}`);
      await handleNewSubscriptionUser(customer, subscription);
    } else {
      console.log(`Subscription ${subscription.id} already processed for user creation or not in active state, skipping user creation`);
    }
  }
}

async function cancelSubscription(subscription) {
  const userQuery = await db.collection('users')
    .where('subscriptionId', '==', subscription.id)
    .limit(1)
    .get();
  
  if (!userQuery.empty) {
    const userDoc = userQuery.docs[0];
    
    await userDoc.ref.update({
      subscriptionStatus: 'canceled',
      canceledAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`Subscription canceled: ${subscription.id}`);
  }
}

async function handleTrialEnding(subscription) {
  const customer = await stripe.customers.retrieve(subscription.customer);
  const msg = {
    to: customer.email,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'Your IrisMapper Trial is Ending Soon',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Your trial period is ending soon!</h2>
        <p>Your IrisMapper trial will end in 3 days. To continue enjoying our services, 
           make sure your payment method is up to date.</p>
        <p>If you have any questions, please don't hesitate to contact our support team.</p>
        <a href="https://irismapper.com/account" 
           style="display: inline-block; padding: 10px 20px; background-color: #667eea; 
                  color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">
          Manage Your Subscription
        </a>
      </div>
    `
  };
  
  try {
    await sgMail.send(msg);
    console.log(`Trial ending notification sent to: ${customer.email}`);
  } catch (error) {
    console.error('Failed to send trial ending email:', error);
  }
}

async function handleNewSubscriptionUser(customer, subscription) {
  // Check if we've already processed this user recently (deduplication)
  const recentUserCheck = await db.collection('users')
    .where('email', '==', customer.email)
    .where('createdAt', '>=', new Date(Date.now() - 60000)) // Within last minute
    .limit(1)
    .get();
    
  if (!recentUserCheck.empty) {
    console.log(`User ${customer.email} was just created, skipping duplicate processing`);
    return;
  }

  const userData = {
    stripeCustomerId: customer.id,
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    subscriptionTier: subscription.metadata?.tier || 'practitioner',
    subscriptionPlan: subscription.metadata?.plan || 'monthly',
    trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  let userRecord = null;
  let userAlreadyExisted = false;

  try {
    // First, check if user already exists in Firebase Auth
    try {
      userRecord = await admin.auth().getUserByEmail(customer.email);
      userAlreadyExisted = true;
      console.log(`User already exists in Firebase Auth: ${customer.email}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // User doesn't exist, create them
        const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
        
        userRecord = await admin.auth().createUser({
          email: customer.email,
          password: tempPassword,
          emailVerified: false,
          disabled: false
        });
        console.log(`Created new Firebase Auth user: ${customer.email}`);
      } else {
        throw error; // Re-throw if it's a different error
      }
    }

    // Check if Firestore document exists
    const existingDoc = await db.collection('users').doc(userRecord.uid).get();
    
    if (existingDoc.exists) {
      // Update existing document
      await db.collection('users').doc(userRecord.uid).update({
        ...userData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Updated existing Firestore document for: ${customer.email}`);
      
      // Check if we already sent verification email recently
      const existingData = existingDoc.data();
      const sentAt = existingData.verificationEmailSentAt;
      const sentDate = sentAt?.toDate ? sentAt.toDate() : sentAt;
      const sentRecently = sentDate && (Date.now() - new Date(sentDate).getTime() < 24 * 60 * 60 * 1000);
      
      if (sentRecently) {
        console.log(`Email already sent recently to ${customer.email}, skipping`);
        return;
      }
    } else {
      // Create new Firestore document
      await db.collection('users').doc(userRecord.uid).set({
        email: customer.email,
        uid: userRecord.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        needsPasswordReset: !userAlreadyExisted, // Only need reset if we just created the user
        verificationEmailSent: true, // Mark as sent immediately to prevent race conditions
        verificationEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        ...userData
      });
      console.log(`Created new Firestore document for: ${customer.email}`);
    }
    
    // Send ONE combined email with both verification and password reset
    try {
      let verificationLink = null;
      let passwordResetLink = null;
      
      // Try to generate both links
      try {
        // Try verification link with rate limit handling
        const firebaseVerifyLink = await admin.auth().generateEmailVerificationLink(
          customer.email,
          { url: 'https://irismapper.com/login' }
        );
        
        // Extract oobCode and create custom branded verification link
        const verifyUrl = new URL(firebaseVerifyLink);
        const verifyOobCode = verifyUrl.searchParams.get('oobCode');
        verificationLink = `https://irismapper.com/verify-email?mode=verifyEmail&oobCode=${verifyOobCode}`;
        console.log(`✅ Verification link generated for ${customer.email}`);
      } catch (error) {
        if (error.message?.includes('TOO_MANY_ATTEMPTS')) {
          console.log(`⚠️ Rate limited on verification link for ${customer.email}`);
        } else {
          console.error('Error generating verification link:', error);
        }
      }
      
      // Only generate password reset if user is new or needs reset
      if (!userAlreadyExisted || !existingDoc.exists) {
        try {
          // Generate a secure token for password setup
          const crypto = require('crypto');
          const setupToken = crypto.randomBytes(32).toString('hex');
          
          // Store token in Firestore with expiration
          const tokenData = {
            email: customer.email,
            used: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            type: 'password_setup'
          };
          
          await db.collection('auth_tokens').doc(setupToken).set(tokenData);
          
          // Create secure link with token
          passwordResetLink = `https://irismapper.com/setup-password?token=${setupToken}`;
          console.log(`✅ Secure password setup token generated for ${customer.email}`);
        } catch (error) {
          console.error('Error generating password setup token:', error);
        }
      }
      
      // Send ONE combined email
      const combinedMsg = {
        to: customer.email,
        from: process.env.SENDGRID_FROM_EMAIL,
        subject: userAlreadyExisted ? 'Activate Your IrisMapper Pro Account' : 'Welcome to IrisMapper Pro - Get Started',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
            <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa;">
              <tr>
                <td align="center" style="padding: 40px 20px;">
                  <table role="presentation" style="width: 640px; max-width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.08);">
                    <!-- Header -->
                    <tr>
                      <td style="padding: 40px 40px 30px 40px; text-align: center; border-bottom: 1px solid #e9ecef;">
                        <h1 style="margin: 0; color: #1c262f; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">IrisMapper</h1>
                        <p style="margin: 10px 0 0 0; color: #0dc5a1; font-size: 16px; font-weight: 500;">
                          ${userAlreadyExisted ? '✅ Subscription Activated!' : '✅ Account Created Successfully!'}
                        </p>
                      </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                      <td style="padding: 40px;">
                        <h2 style="margin: 0 0 20px 0; color: #1c262f; font-size: 24px; font-weight: 600;">
                          ${userAlreadyExisted ? 'Activate Your Full Access' : 'Your IrisMapper Pro is Ready!'}
                        </h2>
                        <p style="margin: 0 0 30px 0; color: #495057; font-size: 16px; line-height: 1.6;">
                          ${userAlreadyExisted 
                            ? 'Your subscription is now active. Complete these quick steps to unlock all professional iris mapping features:' 
                            : 'Just 2 quick steps to start using professional iris mapping tools:'}
                        </p>
                        
                        ${passwordResetLink ? `
                          <!-- Step 1: Set Password -->
                          <div style="background-color: #ffffff; padding: 24px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e9ecef;">
                            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                              <tr>
                                <td style="width: 36px; vertical-align: top;">
                                  <div style="width: 32px; height: 32px; background: #4A90E2; color: white; border-radius: 50%; text-align: center; line-height: 32px; font-size: 14px; font-weight: 600;">1</div>
                                </td>
                                <td style="padding-left: 16px;">
                                  <h3 style="margin: 0 0 8px 0; color: #1c262f; font-size: 18px; font-weight: 600;">Create Your Secure Password</h3>
                                  <p style="margin: 0 0 16px 0; color: #6c757d; font-size: 14px; line-height: 1.5;">
                                    Set up your account password to protect your data:
                                  </p>
                                  <table role="presentation" style="margin: 0;">
                                    <tr>
                                      <td align="center" style="background: #4A90E2; border-radius: 6px;">
                                        <a href="${passwordResetLink}"
                                           target="_blank"
                                           style="display: inline-block; padding: 12px 32px; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 6px;">
                                          Create Password →
                                        </a>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </div>
                        ` : ''}
                        
                        <!-- Verify Email Section -->
                        <div style="background-color: #ffffff; padding: 24px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e9ecef;">
                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="width: 36px; vertical-align: top;">
                                <div style="width: 32px; height: 32px; background: #0dc5a1; color: white; border-radius: 50%; text-align: center; line-height: 32px; font-size: 14px; font-weight: 600;">
                                  ${passwordResetLink ? '2' : '1'}
                                </div>
                              </td>
                              <td style="padding-left: 16px;">
                                <h3 style="margin: 0 0 8px 0; color: #1c262f; font-size: 18px; font-weight: 600;">Confirm Your Email Address</h3>
                                ${verificationLink ? `
                                  <p style="margin: 0 0 16px 0; color: #6c757d; font-size: 14px; line-height: 1.5;">
                                    Verify your email to unlock all professional features:
                                  </p>
                                  <table role="presentation" style="margin: 0;">
                                    <tr>
                                      <td align="center" style="background: #0dc5a1; border-radius: 6px;">
                                        <a href="${verificationLink}"
                                           target="_blank"
                                           style="display: inline-block; padding: 12px 32px; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 6px;">
                                          Verify Email →
                                        </a>
                                      </td>
                                    </tr>
                                  </table>
                                ` : `
                                  <p style="margin: 0; color: #6c757d; font-size: 14px; line-height: 1.5;">
                                    You can verify your email from your account dashboard after logging in.
                                  </p>
                                `}
                              </td>
                            </tr>
                          </table>
                        </div>
                        
                        <!-- Benefits Section -->
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                          <h4 style="margin: 0 0 12px 0; color: #1c262f; font-size: 16px; font-weight: 600;">What you'll get access to:</h4>
                          <ul style="margin: 0; padding-left: 20px; color: #495057; font-size: 14px; line-height: 1.8;">
                            <li>Professional iris mapping tools</li>
                            <li>Multiple iris chart overlays</li>
                            <li>High-resolution image analysis</li>
                            <li>Client report generation</li>
                            <li>Secure cloud storage</li>
                          </ul>
                        </div>
                        
                        ${(verificationLink || passwordResetLink) ? `
                          <div style="padding: 16px; background-color: #fff8e1; border: 1px solid #ffecb3; border-radius: 6px; margin-top: 30px;">
                            <p style="margin: 0 0 12px 0; color: #856404; font-size: 13px; font-weight: 600;">
                              Having trouble with the buttons?
                            </p>
                            <p style="margin: 0; color: #856404; font-size: 12px; line-height: 1.5;">
                              Copy and paste these links into your browser:
                            </p>
                            ${passwordResetLink ? `
                              <p style="margin: 12px 0 0 0; color: #856404; font-size: 11px;">
                                <strong>Password setup:</strong><br>
                                <code style="word-break: break-all; background: #fff; padding: 4px; border-radius: 3px; display: inline-block; margin-top: 4px;">${passwordResetLink}</code>
                              </p>
                            ` : ''}
                            ${verificationLink ? `
                              <p style="margin: 12px 0 0 0; color: #856404; font-size: 11px;">
                                <strong>Email verification:</strong><br>
                                <code style="word-break: break-all; background: #fff; padding: 4px; border-radius: 3px; display: inline-block; margin-top: 4px;">${verificationLink}</code>
                              </p>
                            ` : ''}
                          </div>
                        ` : ''}
                        
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 30px 40px; text-align: center; background-color: #f8f9fa; border-top: 1px solid #e9ecef;">
                        <p style="margin: 0 0 8px 0; color: #6c757d; font-size: 13px;">
                          Questions? Email us at <a href="mailto:support@irismapper.com" style="color: #0dc5a1; text-decoration: none;">support@irismapper.com</a>
                        </p>
                        <p style="margin: 0; color: #adb5bd; font-size: 12px;">
                          © 2025 IrisMapper Pro. All rights reserved.
                        </p>
                        ${(verificationLink || passwordResetLink) ? `
                          <p style="margin: 12px 0 0 0; color: #adb5bd; font-size: 11px;">
                            Links expire in 24 hours for security reasons.
                          </p>
                        ` : ''}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `
      };
      
      // Send the SINGLE combined email
      await sgMail.send(combinedMsg);
      console.log(`✅ Combined welcome email sent to: ${customer.email}`);
      
      // Update that we sent the email
      await db.collection('users').doc(userRecord.uid).update({
        verificationEmailSent: true,
        verificationEmailSentAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Reset the flag if email failed
      await db.collection('users').doc(userRecord.uid).update({
        verificationEmailSent: false
      });
    }
    
    console.log(`User subscription activated: ${customer.email}`);
    
  } catch (error) {
    console.error('Error in handleNewSubscriptionUser:', error);
    
    // If everything failed, create a Firestore record for manual cleanup
    if (!userRecord) {
      await db.collection('users').add({
        email: customer.email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        authCreationFailed: true,
        error: error.message,
        ...userData
      });
    }
  }
}

// Handle successful checkout to create/update user and send verification immediately
async function handleCheckoutCompleted(session) {
  try {
    // Check if this session has already been processed
    const sessionCheck = await db.collection('processed_sessions').doc(session.id).get();
    
    if (sessionCheck.exists) {
      console.log(`Session ${session.id} already processed, skipping`);
      return;
    }
    
    // Get customer email from session
    let email = session.customer_details?.email || session.customer_email;
    let customerId = session.customer;
    if (!email || !customerId) {
      // Retrieve customer from Stripe if needed
      if (customerId) {
        const customer = await stripe.customers.retrieve(customerId);
        email = email || customer.email;
      }
    }
    
    // Mark this session as being processed
    const twentyFourHoursFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.collection('processed_sessions').doc(session.id).set({
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      email: email,
      customerId: customerId,
      expiresAt: twentyFourHoursFromNow
    });

    // Get subscription info if present
    let subscription = null;
    if (session.subscription) {
      subscription = await stripe.subscriptions.retrieve(session.subscription);
    }

    // Find existing user by stripeCustomerId or email
    let userQuery = await db.collection('users')
      .where('stripeCustomerId', '==', customerId)
      .limit(1)
      .get();

    if (userQuery.empty && email) {
      userQuery = await db.collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();
    }

    if (!userQuery.empty) {
      const userDoc = userQuery.docs[0];
      const userData = userDoc.data();
      const updates = {
        stripeCustomerId: customerId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      if (subscription) {
        updates.subscriptionId = subscription.id;
        updates.subscriptionStatus = subscription.status;
        updates.currentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null;
        updates.cancelAtPeriodEnd = subscription.cancel_at_period_end;
      }
      await userDoc.ref.set(updates, { merge: true });

      // Skip verification email here - it will be handled by subscription.updated webhook
      // This prevents duplicate emails and rate limiting
      console.log(`User updated from checkout.session.completed: ${email} (verification will be handled by subscription webhook)`);
    } else {
      // Create new user path
      if (!email) {
        console.error('checkout.session.completed missing customer email');
        return;
      }
      const customer = customerId ? await stripe.customers.retrieve(customerId) : { id: customerId, email };
      if (!subscription && session.subscription) {
        subscription = await stripe.subscriptions.retrieve(session.subscription);
      }
      await handleNewSubscriptionUser(customer, subscription || { id: null, status: 'active' });
    }
  } catch (err) {
    console.error('Error handling checkout.session.completed:', err);
  }
}