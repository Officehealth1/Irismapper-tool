# Email Configuration Guide - Prevent Spam Issues

## SendGrid Domain Authentication Setup

To ensure emails reach inbox instead of spam, configure SendGrid domain authentication:

### 1. DNS Records Required

Add these records to your domain (irismapper.com) in GoDaddy:

#### SPF Record
- **Type**: TXT
- **Host**: @
- **Value**: `v=spf1 include:sendgrid.net ~all`

#### DKIM Records (Get from SendGrid)
1. Log into SendGrid Dashboard
2. Go to Settings → Sender Authentication
3. Click "Authenticate Your Domain"
4. Follow the wizard for irismapper.com
5. Add the provided CNAME records to GoDaddy

Example DKIM records:
- **s1._domainkey** → sendgrid.net
- **s2._domainkey** → sendgrid.net

#### DMARC Record (Optional but recommended)
- **Type**: TXT
- **Host**: _dmarc
- **Value**: `v=DMARC1; p=none; rua=mailto:admin@irismapper.com`

### 2. SendGrid Settings

1. **Verify Domain**: Complete domain authentication in SendGrid
2. **Set FROM address**: Use `noreply@irismapper.com` or `support@irismapper.com`
3. **Update environment variable**: 
   ```
   SENDGRID_FROM_EMAIL=noreply@irismapper.com
   ```

### 3. Email Best Practices

- Use authenticated domain email (not gmail.com)
- Include unsubscribe links
- Avoid spam trigger words
- Test with mail-tester.com

### 4. Monitoring

- Check SendGrid Activity Feed for bounces/spam reports
- Monitor email reputation in SendGrid dashboard
- Review spam complaints regularly

## Troubleshooting

### Emails Still Going to Spam?
1. Wait 24-48 hours for DNS propagation
2. Check SPF/DKIM/DMARC alignment
3. Review email content for spam triggers
4. Consider using a dedicated IP (SendGrid Pro)

### Rate Limiting Issues
- Firebase limits verification emails to prevent abuse
- Implement exponential backoff for retries
- Cache verification status to avoid duplicates