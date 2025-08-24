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

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { token } = JSON.parse(event.body);

    // Validate input
    if (!token) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          valid: false, 
          error: 'Token is required' 
        })
      };
    }

    console.log(`Validating setup token: ${token.substring(0, 8)}...`);

    // Get token from Firestore
    const tokenDoc = await db.collection('auth_tokens').doc(token).get();

    if (!tokenDoc.exists) {
      console.log('Token not found in database');
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          valid: false, 
          error: 'Invalid or expired token. Please request a new setup link.' 
        })
      };
    }

    const tokenData = tokenDoc.data();

    // Check if token has been used
    if (tokenData.used) {
      console.log('Token has already been used');
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          valid: false, 
          error: 'This setup link has already been used. Please sign in with your password.' 
        })
      };
    }

    // Check if token has expired
    const expiresAt = tokenData.expiresAt.toDate ? tokenData.expiresAt.toDate() : new Date(tokenData.expiresAt);
    if (new Date() > expiresAt) {
      console.log('Token has expired');
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          valid: false, 
          error: 'This setup link has expired. Please request a new one.' 
        })
      };
    }

    // Token is valid
    console.log(`Token validated successfully for email: ${tokenData.email}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        valid: true, 
        email: tokenData.email,
        type: tokenData.type 
      })
    };

  } catch (error) {
    console.error('Token validation error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        valid: false, 
        error: 'An error occurred while validating the token.' 
      })
    };
  }
};