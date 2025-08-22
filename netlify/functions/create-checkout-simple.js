// Simplified checkout for testing Stripe without Firebase
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Price IDs for each plan
const PRICES = {
  practitioner_monthly: process.env.PRICE_PRACTITIONER_MONTHLY,
  practitioner_yearly: process.env.PRICE_PRACTITIONER_YEARLY,
  practitioner_2year: process.env.PRICE_PRACTITIONER_2YEAR,
  clinic_monthly: process.env.PRICE_CLINIC_MONTHLY,
  clinic_yearly: process.env.PRICE_CLINIC_YEARLY,
  clinic_2year: process.env.PRICE_CLINIC_2YEAR
};

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    };
  }

  try {
    const { plan, tier, email, successUrl, cancelUrl } = JSON.parse(event.body);
    
    console.log('Creating checkout for:', { plan, tier, email });
    
    // Get the correct price ID
    const priceKey = `${tier}_${plan}`;
    const priceId = PRICES[priceKey];
    
    if (!priceId) {
      console.error('Invalid price key:', priceKey);
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          error: 'Invalid plan selected',
          details: `Price not found for ${priceKey}`
        })
      };
    }

    // Create Stripe checkout session (simplified - no Firebase)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      mode: 'subscription',
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          tier: tier,
          plan: plan
        }
      },
<<<<<<< HEAD
      success_url: successUrl || 'https://irismapper.com/success.html',
=======
      success_url: successUrl ? `${successUrl}?email=${encodeURIComponent(email)}` : `https://irismapper.com/success.html?email=${encodeURIComponent(email)}`,
>>>>>>> 15f58fa (Add complete subscription system with Firebase authentication)
      cancel_url: cancelUrl || 'https://irismapper.com/pricing.html',
      allow_promotion_codes: true
    });

    console.log('Checkout session created:', session.id);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        sessionId: session.id,
        url: session.url 
      })
    };

  } catch (error) {
    console.error('Checkout error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Failed to create checkout session',
        details: error.message 
      })
    };
  }
};