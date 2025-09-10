const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.handler = async (event) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
    // Parse request body
    const { email, accessType, personalMessage, adminUid, selectedPlan, selectedPeriod } = JSON.parse(event.body);

    // Validate required fields
    if (!email || !accessType || !adminUid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Verify admin permissions
    const adminDoc = await db.collection('users').doc(adminUid).get();
    if (!adminDoc.exists) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Admin user not found' })
      };
    }

    const adminData = adminDoc.data();
    if (!adminData.isAdmin && adminData.role !== 'admin') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Insufficient permissions' })
      };
    }

    // Ensure admin email is available (fallback to hardcoded if missing)
    const adminEmail = adminData.email || 'team@irislab.com';

    // Create Stripe coupon if needed
    let couponId = null;
    let checkoutUrl = null;
    
    if (accessType === 'permanent' || accessType === 'practitioner' || accessType === 'clinic') {
      try {
        const coupon = await stripe.coupons.create({
          percent_off: 100,
          duration: 'forever',
          name: `Free Access - ${email}`,
          metadata: {
            invited_by: adminData.email,
            invite_type: accessType
          }
        });
        couponId = coupon.id;
      } catch (stripeError) {
        console.error('Stripe coupon creation failed:', stripeError);
        // Continue without coupon - we'll handle this in the email
      }
    } else if (accessType.startsWith('discount_')) {
      // Handle discount invitations
      const discountPercent = parseInt(accessType.split('_')[1]);
      
      try {
        // Create percentage discount coupon
        const coupon = await stripe.coupons.create({
          percent_off: discountPercent,
          duration: 'forever',
          name: `${discountPercent}% Discount - ${email}`,
          metadata: {
            invited_by: adminData.email,
            invite_type: accessType,
            plan: selectedPlan,
            period: selectedPeriod
          }
        });
        couponId = coupon.id;
        
        // Create direct checkout session with pre-applied discount
        const priceKey = `${selectedPlan}_${selectedPeriod}`;
        const priceId = process.env[`PRICE_${priceKey.toUpperCase()}`];
        
        if (priceId) {
          const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: email,
            line_items: [{
              price: priceId,
              quantity: 1
            }],
            mode: 'subscription',
            discounts: [{
              coupon: couponId
            }],
            subscription_data: {
              trial_period_days: 14,
              metadata: {
                tier: selectedPlan,
                plan: selectedPeriod,
                discount_percent: discountPercent,
                invited_by: adminData.email,
                invitation_type: 'discount'
              }
            },
            success_url: `https://irismapper.com/success.html?email=${encodeURIComponent(email)}`,
            cancel_url: 'https://irismapper.com/pricing.html'
          });
          
          checkoutUrl = session.url;
        }
      } catch (stripeError) {
        console.error('Stripe discount creation failed:', stripeError);
        // Continue without coupon - we'll handle this in the email
      }
    }

    // Prepare email content
    const emailSubject = 'You\'re invited to IrisMapper Pro!';
    const accessDescription = {
      'permanent': 'Permanent free access to all features',
      'extended_trial': '90-day extended trial with full access',
      'practitioner': 'Free Practitioner plan access',
      'clinic': 'Free Clinic plan access',
      'discount_20': `20% discount on ${selectedPlan} plan (${selectedPeriod})`,
      'discount_30': `30% discount on ${selectedPlan} plan (${selectedPeriod})`,
      'discount_50': `50% discount on ${selectedPlan} plan (${selectedPeriod})`
    };

    const emailContentHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>IrisMapper Pro Invitation</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <img src="https://irismapper.com/grids/irismapper-logo.png" alt="IrisMapper Pro" style="height: 60px;">
            </div>
            
            <h2 style="color: #4A90E2;">You're invited to IrisMapper Pro!</h2>
            
            <p>Hello,</p>
            
            <p>You've been invited by <strong>${adminEmail}</strong> to join IrisMapper Pro with <strong>${accessDescription[accessType]}</strong>.</p>
            
            ${personalMessage ? `<div style="background: #f5f7fa; padding: 15px; border-left: 4px solid #4A90E2; margin: 20px 0;">
                <p><strong>Personal message:</strong></p>
                <p>${personalMessage}</p>
            </div>` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
                ${accessType.startsWith('discount_') && checkoutUrl ? 
                  `<a href="${checkoutUrl}" style="background: #0dc5a1; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                    Subscribe Now with Discount
                  </a>` :
                  `<a href="https://irismapper.com/invite?code=${couponId}&email=${email}" style="background: #0dc5a1; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                    Redeem Your Invitation
                  </a>`
                }
            </div>
            
            ${couponId && !accessType.startsWith('discount_') ? `<div style="background: #e8f8f5; border: 2px dashed #0dc5a1; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;">
                <p style="margin: 0; color: #0dc5a1; font-weight: bold;">Your Invitation Code</p>
                <p style="margin: 5px 0 0 0; font-family: 'Courier New', monospace; font-size: 1.2rem; letter-spacing: 2px;">${couponId}</p>
                <p style="margin: 10px 0 0 0; font-size: 0.9rem; color: #666;">This code will be automatically applied when you click the button above</p>
            </div>` : ''}
            
            ${accessType.startsWith('discount_') ? `<div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;">
                <p style="margin: 0; color: #856404; font-weight: bold;">🎉 Special Discount Applied!</p>
                <p style="margin: 5px 0 0 0; font-size: 1.1rem; color: #856404;">Your discount has been automatically applied to the checkout</p>
                <p style="margin: 10px 0 0 0; font-size: 0.9rem; color: #856404;">Click the button above to subscribe with your exclusive discount</p>
            </div>` : ''}
            
            <p>IrisMapper Pro is a professional iris analysis tool used by practitioners worldwide. With your invitation, you'll have access to:</p>
            
            <ul>
                <li>Advanced iris mapping technology</li>
                <li>Professional analysis tools</li>
                <li>Export and sharing capabilities</li>
                <li>Priority support</li>
            </ul>
            
            <p>If you have any questions, feel free to reply to this email.</p>
            
            <p>Best regards,<br>The IrisMapper Pro Team</p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="font-size: 12px; color: #666;">
                This invitation was sent by an admin user. If you believe this was sent in error, please ignore this email.
            </p>
        </div>
    </body>
    </html>
    `;

    // Send email
    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: emailSubject,
      html: emailContentHTML
    };

    let emailSent = false;
    let trackingError = null;

    try {
      await sgMail.send(msg);
      emailSent = true;
      console.log('Email sent successfully to:', email);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      throw new Error('Failed to send email: ' + emailError.message);
    }

    // Try to save invite to Firestore (non-critical)
    try {
      const inviteData = {
        email: email,
        accessType: accessType,
        personalMessage: personalMessage || '',
        invitedBy: adminEmail,
        adminUid: adminUid,
        couponId: couponId,
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      // Add discount-specific data
      if (accessType.startsWith('discount_')) {
        inviteData.selectedPlan = selectedPlan;
        inviteData.selectedPeriod = selectedPeriod;
        inviteData.checkoutUrl = checkoutUrl;
        inviteData.discountPercent = parseInt(accessType.split('_')[1]);
      }
      
      await db.collection('invites').add(inviteData);
      console.log('Invite tracking saved successfully');
    } catch (trackingErr) {
      console.error('Failed to save invite tracking:', trackingErr);
      trackingError = trackingErr.message;
      // Don't fail the whole request if tracking fails
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Invitation sent successfully',
        couponId: couponId,
        checkoutUrl: checkoutUrl,
        emailSent: emailSent,
        trackingError: trackingError
      })
    };

  } catch (error) {
    console.error('Invite error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to send invitation',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};
