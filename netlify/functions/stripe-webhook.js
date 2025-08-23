const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
    const verificationLink = await admin.auth().generateEmailVerificationLink(
      email,
      { url: 'https://irismapper.com/login' }
    );

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

  // Handle the event
  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        const session = stripeEvent.data.object;
        await handleCheckoutCompleted(session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
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
        console.log(`Unhandled event type: ${stripeEvent.type}`);
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
    
    // Send email verification for new subscriptions
    if (subscription.status === 'trialing' || subscription.status === 'active') {
      try {
        // Check if user already has email verified
        const userData = userDoc.data();
        console.log(`User data for ${customer.email}:`, { emailVerified: userData.emailVerified, uid: userData.uid });
        
        if (!userData.emailVerified) {
          console.log(`Attempting to send email verification to: ${customer.email}`);
          
          // Get the Firebase user to check their verification status
          try {
            const firebaseUser = await admin.auth().getUserByEmail(customer.email);
            console.log(`Firebase user verification status:`, { emailVerified: firebaseUser.emailVerified, uid: firebaseUser.uid });
            
            if (!firebaseUser.emailVerified) {
              // Send the verification email using SendGrid
              const emailVerificationResult = await sendVerificationEmail(customer.email);
              
              if (emailVerificationResult.success) {
                console.log(`✅ Email verification sent successfully to: ${customer.email}`);
                await userDoc.ref.update({
                  verificationEmailSent: true,
                  verificationEmailSentAt: admin.firestore.FieldValue.serverTimestamp()
                });
              } else {
                console.error(`Failed to send verification email to: ${customer.email}`, emailVerificationResult.error);
              }
            } else {
              console.log(`User ${customer.email} already verified in Firebase Auth`);
              await userDoc.ref.update({ emailVerified: true });
            }
          } catch (authError) {
            console.error(`Error checking Firebase Auth user:`, authError);
          }
        } else {
          console.log(`User ${customer.email} already marked as verified in Firestore`);
        }
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
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
  const userData = {
    stripeCustomerId: customer.id,
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    subscriptionTier: subscription.metadata.tier || 'practitioner',
    subscriptionPlan: subscription.metadata.plan || 'monthly',
    trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  try {
    // Generate a temporary password for new user
    const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
    
    // Create Firebase Auth user  
    const userRecord = await admin.auth().createUser({
      email: customer.email,
      password: tempPassword,
      emailVerified: false,
      disabled: false
    });
    
    // Create Firestore user record
    await db.collection('users').doc(userRecord.uid).set({
      email: customer.email,
      uid: userRecord.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      needsPasswordReset: true,
      ...userData
    });
    
    // Send email verification
    try {
      const emailVerificationResult = await sendVerificationEmail(customer.email);
      
      if (emailVerificationResult.success) {
        console.log(`✅ Email verification sent successfully to new user: ${customer.email}`);
        // Update that we sent the verification email
        await db.collection('users').doc(userRecord.uid).update({
          verificationEmailSent: true,
          verificationEmailSentAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Also send a welcome email with password reset link
        const passwordResetLink = await admin.auth().generatePasswordResetLink(customer.email, {
          url: 'https://irismapper.com/login'
        });

        const welcomeMsg = {
          to: customer.email,
          from: process.env.SENDGRID_FROM_EMAIL,
          subject: 'Welcome to IrisMapper - Set Your Password',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2>Welcome to IrisMapper!</h2>
              <p>Your account has been created. Please follow these steps:</p>
              <ol>
                <li>First, verify your email address (check your inbox for the verification email)</li>
                <li>Then, set your password by clicking the link below:</li>
              </ol>
              <a href="${passwordResetLink}" 
                 style="display: inline-block; padding: 10px 20px; background-color: #667eea; 
                        color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
                Set Your Password
              </a>
              <p>If you have any questions, please contact our support team.</p>
            </div>
          `
        };
        
        await sgMail.send(welcomeMsg);
        console.log(`Welcome email with password reset sent to: ${customer.email}`);

      } else {
        console.error(`Failed to send verification email to new user: ${customer.email}`, emailVerificationResult.error);
      }
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }
    
    console.log(`New user created and subscription activated: ${customer.email}`);
    
  } catch (error) {
    console.error('Error creating user:', error);
    // If user creation fails, still create Firestore record for manual cleanup
    await db.collection('users').add({
      email: customer.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      authCreationFailed: true,
      ...userData
    });
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

      // Send verification if needed
      try {
        const firebaseUser = await admin.auth().getUserByEmail(email);
        if (!firebaseUser.emailVerified) {
          const result = await sendVerificationEmail(email);
          if (result.success) {
            await userDoc.ref.update({
              verificationEmailSent: true,
              verificationEmailSentAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      } catch (e) {
        // If user not found, create below
      }
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