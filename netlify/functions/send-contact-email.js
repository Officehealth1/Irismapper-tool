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
    
    const submittedDate = new Date().toLocaleString('en-GB', { 
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Plain text version
    const emailContentText = `
New contact form submission from IrisMapper Pro website:

Name: ${name}
Email: ${email}
Subject: ${subject || 'No subject provided'}

Message:
${message}

---
Submitted: ${submittedDate}
IP Address: ${event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'Unknown'}
User Agent: ${event.headers['user-agent'] || 'Unknown'}
    `.trim();
    
    // Professional HTML version
    const emailContentHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Contact Form Submission</title>
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
                margin: 0; 
                padding: 0; 
                background-color: #f8f9fa;
                line-height: 1.6;
            }
            .container { 
                max-width: 600px; 
                margin: 20px auto; 
                background: white; 
                border-radius: 12px; 
                overflow: hidden;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            }
            .header { 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: white; 
                padding: 30px 20px; 
                text-align: center; 
            }
            .header h1 { 
                margin: 0; 
                font-size: 24px; 
                font-weight: 600; 
            }
            .header p { 
                margin: 5px 0 0; 
                opacity: 0.9; 
                font-size: 14px; 
            }
            .content { 
                padding: 30px 20px; 
            }
            .info-card {
                background: #f8f9fa;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 20px;
                border-left: 4px solid #0dc5a1;
            }
            .info-row {
                display: flex;
                margin-bottom: 12px;
                align-items: flex-start;
            }
            .info-label {
                font-weight: 600;
                color: #333;
                min-width: 80px;
                margin-right: 15px;
            }
            .info-value {
                color: #555;
                flex: 1;
            }
            .message-section {
                background: #fff;
                border: 2px solid #e9ecef;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
            }
            .message-section h3 {
                margin: 0 0 15px;
                color: #333;
                font-size: 16px;
            }
            .message-text {
                color: #555;
                white-space: pre-wrap;
                word-wrap: break-word;
            }
            .tech-details {
                background: #f1f3f4;
                border-radius: 6px;
                padding: 15px;
                margin-top: 20px;
                border-left: 3px solid #667eea;
            }
            .tech-details h4 {
                margin: 0 0 10px;
                color: #666;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .tech-row {
                font-size: 12px;
                color: #777;
                margin-bottom: 5px;
            }
            .reply-section {
                text-align: center;
                padding: 20px;
                border-top: 1px solid #e9ecef;
                background: #f8f9fa;
            }
            .reply-button {
                display: inline-block;
                background: linear-gradient(135deg, #0dc5a1 0%, #0aa08b 100%);
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                font-size: 14px;
            }
            .footer {
                text-align: center;
                color: #999;
                font-size: 12px;
                padding: 15px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📧 New Contact Form</h1>
                <p>IrisMapper Pro Website</p>
            </div>
            
            <div class="content">
                <div class="info-card">
                    <div class="info-row">
                        <span class="info-label">Name:</span>
                        <span class="info-value">${name}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Email:</span>
                        <span class="info-value"><a href="mailto:${email}" style="color: #667eea;">${email}</a></span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Subject:</span>
                        <span class="info-value">${subject || 'No subject provided'}</span>
                    </div>
                </div>

                <div class="message-section">
                    <h3>💬 Message</h3>
                    <div class="message-text">${message}</div>
                </div>

                <div class="tech-details">
                    <h4>Submission Details</h4>
                    <div class="tech-row"><strong>Submitted:</strong> ${submittedDate}</div>
                    <div class="tech-row"><strong>IP Address:</strong> ${event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'Unknown'}</div>
                    <div class="tech-row"><strong>User Agent:</strong> ${(event.headers['user-agent'] || 'Unknown').substring(0, 100)}${(event.headers['user-agent'] || '').length > 100 ? '...' : ''}</div>
                </div>
            </div>

            <div class="reply-section">
                <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subject || 'Your inquiry')}&body=Hi ${encodeURIComponent(name)},%0A%0AThank you for contacting IrisMapper Pro.%0A%0A" class="reply-button">
                    Reply to Customer
                </a>
            </div>

            <div class="footer">
                <p>This email was sent from the IrisMapper Pro contact form</p>
            </div>
        </div>
    </body>
    </html>
    `;

    // Email configuration
    const msg = {
      to: 'team@irislab.com', // Send to IrisLab team
      from: process.env.SENDGRID_FROM_EMAIL, // From verified sender (support@irismapper.com)
      replyTo: email, // Allow direct reply to customer
      subject: emailSubject,
      text: emailContentText,
      html: emailContentHTML
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