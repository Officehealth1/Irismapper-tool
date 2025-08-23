const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Event deduplication cache
const processedEvents = new Set();
const EVENT_CACHE_DURATION = 60000; // 1 minute

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
        verificationLink = await admin.auth().generateEmailVerificationLink(
          email,
          { url: 'https://irismapper.com/login' }
        );
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

  // Deduplicate events
  const eventId = stripeEvent.id;
  if (processedEvents.has(eventId)) {
    console.log(`Duplicate event ${eventId} - skipping`);
    return {
      statusCode: 200,
      body: JSON.stringify({ received: true, duplicate: true })
    };
  }
  
  // Add to cache and clean old entries
  processedEvents.add(eventId);
  setTimeout(() => processedEvents.delete(eventId), EVENT_CACHE_DURATION);

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
    // If user doesn't exist, create them (fallback from checkout.session.completed)
    console.log(`Creating new user for subscription: ${customer.email}`);
    await handleNewSubscriptionUser(customer, subscription);
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
        verificationLink = await admin.auth().generateEmailVerificationLink(
          customer.email,
          { url: 'https://irismapper.com/login' }
        );
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
          passwordResetLink = await admin.auth().generatePasswordResetLink(
            customer.email,
            { url: 'https://irismapper.com/login' }
          );
          console.log(`✅ Password reset link generated for ${customer.email}`);
        } catch (error) {
          if (error.message?.includes('TOO_MANY_ATTEMPTS')) {
            console.log(`⚠️ Rate limited on password reset link for ${customer.email}`);
          } else {
            console.error('Error generating password reset link:', error);
          }
        }
      }
      
      // Send ONE combined email
      const combinedMsg = {
        to: customer.email,
        from: process.env.SENDGRID_FROM_EMAIL,
        subject: userAlreadyExisted ? 'Complete Your IrisMapper Setup' : 'Welcome to IrisMapper - Complete Your Setup',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet">
          </head>
          <body style="margin: 0; padding: 0; background-color: #1c262f; font-family: 'Josefin Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td align="center" style="padding: 40px 20px;">
                  <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3);">
                    <tr>
                      <td style="padding: 50px 40px; text-align: center; background: linear-gradient(135deg, #1c262f 0%, #2a3b47 100%); border-radius: 12px 12px 0 0;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 300; letter-spacing: 1px;">IrisMapper</h1>
                        <p style="margin: 15px 0 0 0; color: #0dc5a1; font-size: 16px; font-weight: 400;">
                          ${userAlreadyExisted ? 'Complete Your Setup' : 'Welcome to Your Journey!'}
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 40px;">
                        <h2 style="margin: 0 0 20px 0; color: #1c262f; font-size: 26px; font-weight: 300; letter-spacing: 0.5px;">
                          ${userAlreadyExisted ? 'Complete Your Account Setup' : 'Welcome! Let\'s Get You Started'}
                        </h2>
                        <p style="margin: 0 0 35px 0; color: #666; font-size: 16px; line-height: 1.6; font-weight: 300;">
                          ${userAlreadyExisted 
                            ? 'Your subscription is active! Please complete the setup steps below to access all features.' 
                            : 'Thank you for subscribing to IrisMapper! Your account has been created successfully. Please complete these steps to activate your account:'}
                        </p>
                        
                        ${passwordResetLink ? `
                          <!-- Step 1: Set Password -->
                          <div style="background-color: #f5f5f5; padding: 25px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #4A90E2;">
                            <h3 style="margin: 0 0 15px 0; color: #1c262f; font-size: 18px; font-weight: 400; display: flex; align-items: center;">
                              <span style="background: #4A90E2; color: white; padding: 4px 10px; border-radius: 50%; margin-right: 12px; font-size: 14px; font-weight: 600; min-width: 24px; text-align: center;">1</span>
                              Set Your Password
                            </h3>
                            <p style="margin: 0 0 20px 0; color: #666; font-size: 14px; line-height: 1.5; font-weight: 300;">
                              First, create a secure password for your account:
                            </p>
                            <table role="presentation" style="margin: 0;">
                              <tr>
                                <td style="border-radius: 6px; background: #4A90E2; box-shadow: 0 2px 8px rgba(74, 144, 226, 0.3);">
                                  <a href="${passwordResetLink}"
                                     target="_blank"
                                     style="display: inline-block; padding: 14px 28px; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 6px; transition: all 0.2s ease;">
                                    Set Password
                                  </a>
                                </td>
                              </tr>
                            </table>
                          </div>
                        ` : ''}
                        
                        <!-- Verify Email Section -->
                        <div style="background-color: #f5f5f5; padding: 25px; border-radius: 8px; border-left: 4px solid #0dc5a1;">
                          <h3 style="margin: 0 0 15px 0; color: #1c262f; font-size: 18px; font-weight: 400; display: flex; align-items: center;">
                            <span style="background: #0dc5a1; color: white; padding: 4px 10px; border-radius: 50%; margin-right: 12px; font-size: 14px; font-weight: 600; min-width: 24px; text-align: center;">
                              ${passwordResetLink ? '2' : '✓'}
                            </span>
                            Verify Your Email
                          </h3>
                          ${verificationLink ? `
                            <p style="margin: 0 0 20px 0; color: #666; font-size: 14px; line-height: 1.5; font-weight: 300;">
                              ${passwordResetLink ? 'Then, verify' : 'Please verify'} your email address to unlock all features:
                            </p>
                            <table role="presentation" style="margin: 0;">
                              <tr>
                                <td style="border-radius: 6px; background: #0dc5a1; box-shadow: 0 2px 8px rgba(13, 197, 161, 0.3);">
                                  <a href="${verificationLink}"
                                     target="_blank"
                                     style="display: inline-block; padding: 14px 28px; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 6px; transition: all 0.2s ease;">
                                    Verify Email
                                  </a>
                                </td>
                              </tr>
                            </table>
                          ` : `
                            <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.5; font-weight: 300;">
                              After ${passwordResetLink ? 'setting your password and ' : ''}logging in, you can request email verification from your account settings.
                            </p>
                          `}
                        </div>
                        
                        ${(verificationLink || passwordResetLink) ? `
                          <div style="margin-top: 30px; padding: 20px; background-color: rgba(13, 197, 161, 0.1); border: 1px solid rgba(13, 197, 161, 0.2); border-radius: 8px;">
                            <p style="margin: 0 0 15px 0; color: #1c262f; font-size: 13px; font-weight: 600;">
                              Can't click the buttons? Copy these links:
                            </p>
                            ${verificationLink ? `
                              <p style="margin: 0 0 10px 0; color: #666; font-size: 12px; font-weight: 300;">
                                <strong>Email verification:</strong><br>
                                <span style="word-break: break-all; font-size: 11px; font-family: monospace; background: #f0f0f0; padding: 4px 6px; border-radius: 3px;">${verificationLink}</span>
                              </p>
                            ` : ''}
                            ${passwordResetLink ? `
                              <p style="margin: 0; color: #666; font-size: 12px; font-weight: 300;">
                                <strong>Password reset:</strong><br>
                                <span style="word-break: break-all; font-size: 11px; font-family: monospace; background: #f0f0f0; padding: 4px 6px; border-radius: 3px;">${passwordResetLink}</span>
                              </p>
                            ` : ''}
                          </div>
                        ` : ''}
                        
                        <hr style="margin: 35px 0; border: none; border-top: 1px solid #e0e0e0;">
                        
                        <p style="margin: 0; color: #999; font-size: 13px; line-height: 1.5; font-weight: 300;">
                          ${(verificationLink || passwordResetLink) ? 'These links will expire in 24 hours. ' : ''}
                          If you didn't create an account with IrisMapper, you can safely ignore this email.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 25px 40px; text-align: center; background-color: #f5f5f5; border-radius: 0 0 12px 12px;">
                        <p style="margin: 0 0 8px 0; color: #999; font-size: 12px; font-weight: 300;">
                          Need help? Contact us at <span style="color: #0dc5a1;">support@irismapper.com</span>
                        </p>
                        <p style="margin: 0; color: #999; font-size: 11px; font-weight: 300;">
                          © 2025 IrisMapper. All rights reserved.
                        </p>
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