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

  try {
    const { email } = JSON.parse(event.body);

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    console.log(`Creating portal session for: ${email}`);

    // Find user in Firestore to get Stripe customer ID
    const userQuery = await db.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (userQuery.empty) {
      console.log('User not found in database');
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    const userData = userQuery.docs[0].data();
    const stripeCustomerId = userData.stripeCustomerId;

    if (!stripeCustomerId) {
      console.log('No Stripe customer ID found for user');
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'No subscription found' })
      };
    }

    // Create Stripe Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: 'https://irismapper.com/app.html'
    });

    console.log('Portal session created successfully');

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        url: session.url,
        success: true 
      })
    };

  } catch (error) {
    console.error('Portal session error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to create portal session',
        message: error.message 
      })
    };
  }
};