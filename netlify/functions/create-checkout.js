const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Price IDs for each plan (you'll create these in Stripe Dashboard)
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
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { plan, tier, email, successUrl, cancelUrl } = JSON.parse(event.body);
    
    // Get the correct price ID
    const priceKey = `${tier}_${plan}`;
    const priceId = PRICES[priceKey];
    
    if (!priceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid plan selected' })
      };
    }

    // Create Stripe checkout session
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
      success_url: successUrl || 'https://irismapper.com/success',
      cancel_url: cancelUrl || 'https://irismapper.com/pricing',
      allow_promotion_codes: true
    });

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
      body: JSON.stringify({ 
        error: 'Failed to create checkout session',
        details: error.message 
      })
    };
  }
};