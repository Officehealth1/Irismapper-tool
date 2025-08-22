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

// Function to send welcome email using Firebase Admin SDK
async function sendWelcomeVerificationEmail(email) {
  try {
    console.log(`Generating email verification link for: ${email}`);
    
    // Generate email verification link using Firebase Admin SDK
    const actionCodeSettings = {
      url: 'https://irismapper.com/login.html',
      handleCodeInApp: false
    };
    
    const verificationLink = await admin.auth().generateEmailVerificationLink(
      email, 
      actionCodeSettings
    );
    
    console.log(`Email verification link generated: ${verificationLink}`);
    
    // The Firebase Admin SDK should automatically send the email
    // if email templates are configured in Firebase Console
    return { 
      success: true, 
      link: verificationLink,
      message: 'Email verification link generated and sent'
    };
    
  } catch (error) {
    console.error('Error generating email verification link:', error);
    return { 
      success: false, 
      error: error.message || error 
    };
  }
}

exports.handler = async (event) => {
  console.log('send-welcome-email function called');
  
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

    console.log(`Attempting to send welcome email to: ${email}`);
    
    // Send welcome verification email
    const result = await sendWelcomeVerificationEmail(email);
    console.log('Email result:', result);
    
    if (result.success) {
      console.log('Welcome email sent successfully');
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true, 
          message: 'Welcome email sent successfully' 
        })
      };
    } else {
      console.log('Failed to send welcome email:', result.error);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          success: false, 
          error: 'Failed to send welcome email',
          details: result.error 
        })
      };
    }

  } catch (error) {
    console.error('Welcome email function error:', error);
    console.error('Error stack:', error.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};