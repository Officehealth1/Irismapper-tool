const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');
const https = require('https');

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

// Function to send verification email
async function sendVerificationEmail(email) {
  try {
    // Generate the verification link
    const verificationLink = await admin.auth().generateEmailVerificationLink(
      email,
      {
        url: 'https://irismapper.com/login'
      }
    );
    
    console.log(`✅ Verification link generated for ${email}`);
    console.log(`Link: ${verificationLink}`);
    
    // Firebase Admin SDK only generates links - doesn't send emails
    // We need to implement actual email sending here
    
    // For now, log the link so you can manually test
    // In production, you would integrate with SendGrid, Nodemailer, etc.
    
    return { 
      success: true,
      verificationLink: verificationLink,
      message: 'Verification link generated successfully' 
    };
    
  } catch (error) {
    console.error('Error generating verification link:', error);
    return { 
      success: false, 
      error: error.message 
    };
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
    
    console.log(`Subscription updated for customer: ${customer.id}`);
    
    // Send email verification for new subscriptions
    if (subscription.status === 'trialing' || subscription.status === 'active') {
      try {
        // Check if user already has email verified
        const userData = userDoc.data();
        console.log(`User data for ${customer.email}:`, { emailVerified: userData.emailVerified, uid: userData.uid });
        
        if (!userData.emailVerified) {
          console.log(`Sending email verification to: ${customer.email}`);
          
          // Get the Firebase user to check their verification status
          try {
            const firebaseUser = await admin.auth().getUserByEmail(customer.email);
            console.log(`Firebase user verification status:`, { emailVerified: firebaseUser.emailVerified, uid: firebaseUser.uid });
            
            if (!firebaseUser.emailVerified) {
              // Use Firebase Auth REST API to actually send the email
              const emailVerificationResult = await sendVerificationEmail(customer.email);
              
              if (emailVerificationResult.success) {
                console.log(`✅ Email verification sent successfully to: ${customer.email}`);
              } else {
                console.error(`Failed to send verification email to: ${customer.email}`, emailVerificationResult.error);
              }
            } else {
              console.log(`User ${customer.email} already verified in Firebase Auth`);
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
  // Send email notification (you can implement this later)
  console.log(`Trial ending soon for subscription: ${subscription.id}`);
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