# 🚀 Deployment Checklist - Email Function (Gen 2)

Use this checklist to deploy your migrated Gen 2 Cloud Function to production.

## Pre-Deployment Checklist

### ✅ 1. Verify Local Setup

- [ ] `functions/.env` file created (for local testing only)
- [ ] Dependencies installed: `cd functions && npm install`
- [ ] Code syntax verified: `node -c functions/index.js`
- [ ] Local emulator test completed: `firebase emulators:start`

### ✅ 2. Gmail Configuration

- [ ] Gmail account: kalarang.team@gmail.com accessible
- [ ] 2-Factor Authentication enabled on Gmail
- [ ] Gmail App Password generated (16 characters)
- [ ] Test email sent to verify Gmail SMTP works

### ✅ 3. Firebase Project Setup

- [ ] Firebase CLI installed: `npm install -g firebase-tools`
- [ ] Firebase CLI version 11.0.0 or higher: `firebase --version`
- [ ] Logged in to Firebase: `firebase login`
- [ ] Correct project selected: `firebase use <project-id>`

## Production Deployment Steps

### Step 1: Set Production Secrets

```bash
# Navigate to project root
cd "C:\Users\ASUS\Desktop\Kalarang MVP\kalarang"

# Set the Gmail App Password as a secret
firebase functions:secrets:set GMAIL_APP_PASSWORD

# When prompted, paste your 16-character Gmail App Password
# Example: abcd efgh ijkl mnop (without spaces: abcdefghijklmnop)
```

**Verify secret was set:**

```bash
firebase functions:secrets:access GMAIL_APP_PASSWORD
```

### Step 2: Optional - Set Custom Email Address

If you want to use a different email than the default (kalarang.team@gmail.com):

**Option A: Via .env (not recommended for production)**

```bash
# In functions/.env
GMAIL_EMAIL=kalarang.team@gmail.com
```

**Option B: Update default in code (recommended)**
Edit `functions/index.js` line 27:

```javascript
const gmailEmail = defineString("GMAIL_EMAIL", {
  description: "Gmail address for sending support emails",
  default: "kalarang.team@gmail.com", // Change this
});
```

### Step 3: Deploy the Function

```bash
# Deploy only the email function
firebase deploy --only functions:sendSupportEmail

# Or deploy all functions
firebase deploy --only functions
```

**Expected output:**

```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/your-project/overview
Function URL (sendSupportEmail): https://us-central1-your-project.cloudfunctions.net/sendSupportEmail
```

### Step 4: Verify Deployment

1. **Check Firebase Console:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Navigate to your project → Functions
   - Verify `sendSupportEmail` is listed and healthy

2. **Check function details:**

   ```bash
   firebase functions:list
   ```

3. **View recent logs:**
   ```bash
   firebase functions:log --only sendSupportEmail --limit 10
   ```

## Post-Deployment Testing

### Test 1: Frontend Integration

1. Open your Kalarang app in production
2. Log in to your account
3. Navigate to Profile page
4. Scroll to "Support & Suggestions" section
5. Type a test message: "Testing production email function"
6. Click "Send Message"
7. **Expected**: Success toast notification appears
8. **Verify**: Check kalarang.team@gmail.com inbox

### Test 2: Error Handling

1. Try sending an empty message (should fail with validation)
2. Try sending a very long message (>5000 chars, should fail)
3. Verify error toast appears with appropriate message

### Test 3: Email Content

Verify the received email contains:

- [ ] Correct subject: "Support/Suggestion from [User Name]"
- [ ] User's name
- [ ] User's email address (clickable)
- [ ] Timestamp
- [ ] Message content
- [ ] Reply-To header set to user's email
- [ ] HTML formatting (Kalarang branding)

## Monitoring Setup

### Set up Cloud Logging Alerts (Optional)

1. Go to [Cloud Console Logging](https://console.cloud.google.com/logs)
2. Filter by: `resource.type="cloud_function" AND resource.labels.function_name="sendSupportEmail"`
3. Create alert for error logs

### Monitor Function Performance

```bash
# View recent logs
firebase functions:log --only sendSupportEmail

# Monitor in real-time (Cloud Console)
# Console → Cloud Functions → sendSupportEmail → Logs
```

## Rollback Plan (If Needed)

### Quick Rollback:

```bash
# Rollback to previous version
firebase functions:delete sendSupportEmail
# Then redeploy old version from git history
```

### Emergency: Disable Function

```bash
# Delete the function temporarily
firebase functions:delete sendSupportEmail

# Users will see: "Function not found" error
# Update frontend to show: "Email service temporarily unavailable"
```

## Cost Estimation

**Estimated costs (as of 2024):**

| Usage Level | Invocations/month | Estimated Cost |
| ----------- | ----------------- | -------------- |
| Light       | < 100             | $0 (Free tier) |
| Medium      | 100 - 1,000       | $0 (Free tier) |
| Heavy       | 1,000 - 10,000    | $0 - $2        |
| Very Heavy  | 10,000+           | $2 - $10       |

**Free tier includes:**

- 2 million invocations/month
- 400,000 GB-seconds of compute time
- 200,000 GHz-seconds of compute time
- 5 GB network egress

## Troubleshooting

### Issue: "Secret GMAIL_APP_PASSWORD not found"

**Solution:**

```bash
firebase functions:secrets:set GMAIL_APP_PASSWORD
```

### Issue: "Failed to send email" in logs

**Possible causes:**

1. Gmail App Password expired or incorrect
2. Gmail account locked or 2FA disabled
3. SMTP blocked by firewall

**Debug:**

```bash
# Check function logs
firebase functions:log --only sendSupportEmail --limit 50

# Test Gmail credentials locally
cd functions
node -e "require('./index.js')"
```

### Issue: Function timeout

**Current timeout:** 60 seconds  
**If needed, increase in index.js:**

```javascript
exports.sendSupportEmail = onCall({
  timeoutSeconds: 120, // Increase to 2 minutes
  // ...
}, ...);
```

### Issue: High invocation costs

**Solutions:**

1. Implement rate limiting per user (client-side)
2. Add cooldown period between messages
3. Monitor for abuse in logs

## Security Checklist

- [x] Gmail App Password stored as secret (not in code)
- [x] Input validation (email format, message length)
- [x] XSS prevention (HTML sanitization)
- [x] Rate limiting (maxInstances: 5)
- [x] Error messages don't expose sensitive data
- [x] HTTPS only (enforced by Cloud Functions)
- [x] Authentication required (Firebase Auth)

## Success Criteria

Deployment is successful when:

- ✅ Function deploys without errors
- ✅ Function appears in Firebase Console
- ✅ Test email sends successfully
- ✅ Email received at kalarang.team@gmail.com
- ✅ Email has correct formatting and content
- ✅ Reply-To works (can reply to user directly)
- ✅ Error handling works (invalid inputs rejected)
- ✅ Logs show successful execution
- ✅ No errors in Firebase Console

## Deployment Command Summary

```bash
# Quick deployment (copy-paste these commands)

# 1. Navigate to project
cd "C:\Users\ASUS\Desktop\Kalarang MVP\kalarang"

# 2. Set secret (first time only)
firebase functions:secrets:set GMAIL_APP_PASSWORD

# 3. Deploy function
firebase deploy --only functions:sendSupportEmail

# 4. Verify deployment
firebase functions:list

# 5. Check logs
firebase functions:log --only sendSupportEmail --limit 10

# 6. Test in your app
# Go to Profile → Support & Suggestions → Send test message
```

## Support

If you encounter issues:

1. **Check logs first:**

   ```bash
   firebase functions:log --only sendSupportEmail --limit 50
   ```

2. **Review documentation:**
   - [EMAIL_SETUP_GUIDE.md](./EMAIL_SETUP_GUIDE.md)
   - [GEN2_MIGRATION_GUIDE.md](./GEN2_MIGRATION_GUIDE.md)

3. **Test locally:**

   ```bash
   firebase emulators:start
   ```

4. **Firebase Support:**
   - [Firebase Documentation](https://firebase.google.com/docs/functions)
   - [Stack Overflow](https://stackoverflow.com/questions/tagged/google-cloud-functions)

---

**Deployment Status**: ⏳ Pending  
**Estimated Time**: 5-10 minutes  
**Difficulty**: Easy

Good luck with your deployment! 🚀
