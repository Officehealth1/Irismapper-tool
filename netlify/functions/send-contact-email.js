const sgMail = require('@sendgrid/mail');

// Set SendGrid API Key from environment variables
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse the request body
    const { name, email, subject, message } = JSON.parse(event.body);

    // Validate required fields
    if (!name || !email || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing required fields: name, email, and message are required' 
        })
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid email format' })
      };
    }

    // Prepare email content
    const emailSubject = subject ? `Contact Form: ${subject}` : 'New Contact Form Submission';
    
    const emailContent = `
New contact form submission from IrisMapper Pro website:

Name: ${name}
Email: ${email}
Subject: ${subject || 'No subject provided'}

Message:
${message}

---
Submitted: ${new Date().toLocaleString('en-GB', { 
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
})}
IP Address: ${event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'Unknown'}
User Agent: ${event.headers['user-agent'] || 'Unknown'}
    `.trim();

    // Email configuration
    const msg = {
      to: process.env.SENDGRID_FROM_EMAIL, // Send to support email
      from: process.env.SENDGRID_FROM_EMAIL, // From verified sender
      replyTo: email, // Allow direct reply to customer
      subject: emailSubject,
      text: emailContent,
      html: emailContent.replace(/\n/g, '<br>')
    };

    // Send email via SendGrid
    console.log('Sending contact form email via SendGrid...');
    await sgMail.send(msg);
    
    console.log(`Contact form email sent successfully from ${name} (${email})`);

    // Return success response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        message: 'Your message has been sent successfully! We\'ll respond within 24 hours.'
      })
    };

  } catch (error) {
    console.error('SendGrid email error:', error);
    
    // Check if it's a SendGrid API error
    if (error.response) {
      console.error('SendGrid response:', error.response.body);
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to send message. Please try again later or contact support directly.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};