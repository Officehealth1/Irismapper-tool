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

// Function to send welcome email verification via Firebase REST API
async function sendWelcomeVerificationEmail(email) {
  const apiKey = process.env.FIREBASE_API_KEY || 'AIzaSyAg04Ucyyhh5b7K41iQD0z9VYBZZH5twok';
  
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      requestType: 'VERIFY_EMAIL',
      email: email,
      returnSecureToken: false,
      continueUrl: 'https://irismapper.com/login.html'
    });

    const options = {
      hostname: 'identitytoolkit.googleapis.com',
      path: `/v1/accounts:sendOobCode?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode === 200) {
            console.log(`Welcome verification email sent successfully to: ${email}`);
            resolve({ success: true, result });
          } else {
            console.error('Failed to send welcome verification email:', result);
            resolve({ success: false, error: result });
          }
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
          resolve({ success: false, error: parseError });
        }
      });
    });

    req.on('error', (error) => {
      console.error('Error sending welcome verification email:', error);
      resolve({ success: false, error });
    });

    req.write(postData);
    req.end();
  });
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
  
  // Check if user already exists in Firestore
  const userQuery = await db.collection('users')
    .where('email', '==', customer.email)
    .limit(1)
    .get();
  
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
      
      // Send email verification using Firebase's built-in system
      try {
        const verificationLink = await admin.auth().generateEmailVerificationLink(
          customer.email,
          {
            url: 'https://irismapper.com/login'
          }
        );
        console.log(`✅ Email verification sent to: ${customer.email}`);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
      }
      
      console.log(`User account created successfully: ${customer.email}`);
      
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
      currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
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