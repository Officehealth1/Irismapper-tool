const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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
        await handleCheckoutComplete(session);
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

async function handleCheckoutComplete(session) {
  const customer = await stripe.customers.retrieve(session.customer);
  const subscription = await stripe.subscriptions.retrieve(session.subscription);
  
<<<<<<< HEAD
  // Get user by email
=======
  // Check if user already exists in Firestore
>>>>>>> 15f58fa (Add complete subscription system with Firebase authentication)
  const userQuery = await db.collection('users')
    .where('email', '==', customer.email)
    .limit(1)
    .get();
  
<<<<<<< HEAD
  if (!userQuery.empty) {
    const userDoc = userQuery.docs[0];
    
    // Update user subscription info
    await userDoc.ref.update({
      stripeCustomerId: customer.id,
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionTier: subscription.metadata.tier || 'practitioner',
      subscriptionPlan: subscription.metadata.plan || 'monthly',
      trialEndsAt: new Date(subscription.trial_end * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`Subscription activated for user: ${customer.email}`);
=======
  const userData = {
    stripeCustomerId: customer.id,
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    subscriptionTier: subscription.metadata.tier || 'practitioner',
    subscriptionPlan: subscription.metadata.plan || 'monthly',
    trialEndsAt: new Date(subscription.trial_end * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  if (!userQuery.empty) {
    // Update existing user
    const userDoc = userQuery.docs[0];
    await userDoc.ref.update(userData);
    console.log(`Subscription updated for existing user: ${customer.email}`);
  } else {
    // Create new Firebase user and Firestore record
    try {
      // Generate a temporary password for new user
      const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
      
      // Create Firebase Auth user
      const userRecord = await admin.auth().createUser({
        email: customer.email,
        password: tempPassword,
        emailVerified: false
      });
      
      // Create Firestore user record
      await db.collection('users').doc(userRecord.uid).set({
        email: customer.email,
        uid: userRecord.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        needsPasswordReset: true,
        ...userData
      });
      
      // Send password reset email so user can set their password
      await admin.auth().generatePasswordResetLink(customer.email);
      
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
>>>>>>> 15f58fa (Add complete subscription system with Firebase authentication)
  }
}

async function updateSubscription(subscription) {
  const customer = await stripe.customers.retrieve(subscription.customer);
  
  // Find user by Stripe customer ID
  const userQuery = await db.collection('users')
    .where('stripeCustomerId', '==', customer.id)
    .limit(1)
    .get();
  
  if (!userQuery.empty) {
    const userDoc = userQuery.docs[0];
    
    await userDoc.ref.update({
      subscriptionStatus: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`Subscription updated for customer: ${customer.id}`);
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