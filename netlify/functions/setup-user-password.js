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
    const { email, password, token } = JSON.parse(event.body);

    // Validate input
    if (!email || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email and password are required' })
      };
    }

    if (password.length < 6) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Password must be at least 6 characters' })
      };
    }

    console.log(`Setting up password for user: ${email}`);
    
    // If token is provided, validate and mark as used
    if (token) {
      const tokenDoc = await db.collection('auth_tokens').doc(token).get();
      
      if (tokenDoc.exists && !tokenDoc.data().used) {
        // Mark token as used
        await db.collection('auth_tokens').doc(token).update({
          used: true,
          usedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('Token marked as used');
      }
    }

    try {
      // Get the user by email
      const userRecord = await admin.auth().getUserByEmail(email);
      
      // Update the user's password
      await admin.auth().updateUser(userRecord.uid, {
        password: password,
        emailVerified: true // Also mark email as verified since they came from our email
      });

      console.log(`Password updated successfully for: ${email}`);

      // Generate a custom token for auto-login
      const customToken = await admin.auth().createCustomToken(userRecord.uid);

      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true, 
          message: 'Password set successfully',
          customToken: customToken // Return token for auto-login
        })
      };

    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // User doesn't exist yet, create them
        try {
          const newUser = await admin.auth().createUser({
            email: email,
            password: password,
            emailVerified: true
          });

          console.log(`Created new user with password: ${email}`);

          // Generate a custom token for auto-login
          const customToken = await admin.auth().createCustomToken(newUser.uid);

          return {
            statusCode: 200,
            body: JSON.stringify({ 
              success: true, 
              message: 'Account created successfully',
              customToken: customToken
            })
          };
        } catch (createError) {
          console.error('Error creating user:', createError);
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Failed to create account. Please try again.' })
          };
        }
      } else {
        console.error('Error updating password:', error);
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Failed to update password. Please try again.' })
        };
      }
    }

  } catch (error) {
    console.error('Setup password error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'An error occurred. Please try again.' })
    };
  }
};