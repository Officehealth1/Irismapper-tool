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

  try {
    const { email } = JSON.parse(event.body);

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    console.log(`Sending welcome email to: ${email}`);
    
    // Send welcome verification email
    const result = await sendWelcomeVerificationEmail(email);
    
    if (result.success) {
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true, 
          message: 'Welcome email sent successfully' 
        })
      };
    } else {
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
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        error: 'Internal server error' 
      })
    };
  }
};