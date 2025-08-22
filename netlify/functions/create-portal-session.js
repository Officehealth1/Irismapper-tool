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
  console.log('create-portal-session function called');
  
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    console.log('Method not allowed:', event.httpMethod);
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('Request body:', event.body);
    const { email } = JSON.parse(event.body);

    if (!email) {
      console.log('No email provided');
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
      console.log('User not found in database for email:', email);
      // Try to find by different email format or create a test portal session
      // For testing, let's try to get customer from Stripe directly
      try {
        const customers = await stripe.customers.list({
          email: email,
          limit: 1
        });
        
        if (customers.data.length > 0) {
          const stripeCustomerId = customers.data[0].id;
          console.log('Found customer in Stripe:', stripeCustomerId);
          
          // Create portal session with Stripe customer
          const session = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: 'https://irismapper.com/app.html'
          });
          
          return {
            statusCode: 200,
            body: JSON.stringify({ 
              url: session.url,
              success: true 
            })
          };
        }
      } catch (stripeError) {
        console.error('Error searching Stripe customers:', stripeError);
      }
      
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    const userData = userQuery.docs[0].data();
    console.log('User data found:', { 
      hasStripeCustomerId: !!userData.stripeCustomerId,
      email: userData.email 
    });
    
    const stripeCustomerId = userData.stripeCustomerId;

    if (!stripeCustomerId) {
      console.log('No Stripe customer ID found for user, checking Stripe directly');
      
      // Try to find customer in Stripe by email
      try {
        const customers = await stripe.customers.list({
          email: email,
          limit: 1
        });
        
        if (customers.data.length > 0) {
          const stripeCustomerId = customers.data[0].id;
          console.log('Found customer in Stripe:', stripeCustomerId);
          
          // Update Firestore with the customer ID for future use
          await userQuery.docs[0].ref.update({
            stripeCustomerId: stripeCustomerId
          });
          
          // Create portal session
          const session = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: 'https://irismapper.com/app.html'
          });
          
          return {
            statusCode: 200,
            body: JSON.stringify({ 
              url: session.url,
              success: true 
            })
          };
        }
      } catch (stripeError) {
        console.error('Error searching Stripe customers:', stripeError);
      }
      
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'No subscription found' })
      };
    }

    // Create Stripe Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: 'https://irismapper.com/app.html',
      configuration: undefined // Uses default configuration
    });

    console.log('Portal session created successfully');
    console.log('Portal URL:', session.url);

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