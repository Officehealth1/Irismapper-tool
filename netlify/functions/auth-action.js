// Netlify Function to redirect Firebase auth actions to custom pages
exports.handler = async (event, context) => {
  // Extract query parameters from the event
  const queryStringParameters = event.queryStringParameters || {};
  const { mode, oobCode, apiKey, continueUrl, lang } = queryStringParameters;
  
  console.log('Auth action handler called:', { mode, hasOobCode: !!oobCode });
  
  // Handle different auth action modes
  switch (mode) {
    case 'resetPassword':
      // Redirect to custom password reset page with the oobCode
      const resetUrl = `https://irismapper.com/reset-password?mode=resetPassword&oobCode=${oobCode}`;
      return {
        statusCode: 302,
        headers: {
          Location: resetUrl,
          'Cache-Control': 'no-cache'
        },
        body: ''
      };
      
    case 'verifyEmail':
      // Redirect to login page with verification parameters
      const verifyUrl = `https://irismapper.com/login?mode=verifyEmail&oobCode=${oobCode}&continueUrl=${encodeURIComponent(continueUrl || 'https://irismapper.com/app')}`;
      return {
        statusCode: 302,
        headers: {
          Location: verifyUrl,
          'Cache-Control': 'no-cache'
        },
        body: ''
      };
      
    default:
      // For unknown modes, redirect to Firebase default (fallback)
      const firebaseUrl = `https://irismapper-tool.firebaseapp.com/__/auth/action?${new URLSearchParams(queryStringParameters).toString()}`;
      return {
        statusCode: 302,
        headers: {
          Location: firebaseUrl,
          'Cache-Control': 'no-cache'
        },
        body: ''
      };
  }
};