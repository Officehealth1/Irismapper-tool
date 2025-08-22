const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { customerId, returnUrl } = JSON.parse(event.body);
    
    if (!customerId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Customer ID required' })
      };
    }

    // Create a billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || 'https://irismapper.com/account'
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        url: session.url 
      })
    };

  } catch (error) {
    console.error('Billing portal error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to create billing portal session',
        details: error.message 
      })
    };
  }
};