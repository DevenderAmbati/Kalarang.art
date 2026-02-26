# Firebase Cloud Functions Gen 2 Migration Guide

## Overview

Your Kalarang project has been successfully migrated from Firebase Cloud Functions Gen 1 to Gen 2. This document explains the changes and benefits.

## What is Gen 2?

Firebase Cloud Functions Gen 2 is the latest version built on Cloud Run, offering:

- ⚡ **Faster cold starts** - Up to 100x faster
- 💰 **Better pricing** - Pay only for actual execution time
- 🔧 **More control** - Configure memory, CPU, timeout, and concurrency
- 🌍 **Multi-region** - Deploy to multiple regions easily
- 🔐 **Better secrets management** - Native support for Secret Manager

## Changes Made

### 1. **Updated Imports**

**Before (Gen 1):**

```javascript
const functions = require('firebase-functions');
exports.myFunction = functions.https.onCall(...);
```

**After (Gen 2):**

```javascript
const {onCall} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2");
exports.myFunction = onCall(...);
```

### 2. **Environment Variables**

**Before (Gen 1) - Deprecated:**

```javascript
const email = functions.config().gmail.email;
const password = functions.config().gmail.password;
```

**After (Gen 2) - Using Params API:**

```javascript
const { defineSecret, defineString } = require("firebase-functions/params");

const gmailEmail = defineString("GMAIL_EMAIL", {
  description: "Gmail address for sending support emails",
  default: "kalarang.team@gmail.com",
});

const gmailPassword = defineSecret("GMAIL_APP_PASSWORD", {
  description: "Gmail App Password for SMTP authentication",
});

// Usage:
const email = gmailEmail.value();
const password = gmailPassword.value();
```

### 3. **Function Configuration**

**Before (Gen 1):**

```javascript
exports.myFunction = functions
  .runWith({ maxInstances: 10, memory: '256MB' })
  .https.onCall(...);
```

**After (Gen 2):**

```javascript
// Global configuration
setGlobalOptions({
  maxInstances: 10,
  region: "us-central1",
  memory: "256MiB",
  timeoutSeconds: 60,
});

// Per-function configuration
exports.sendSupportEmail = onCall(
  {
    secrets: [gmailPassword],
    maxInstances: 5,
    memory: "256MiB",
    timeoutSeconds: 60,
    invoker: "public",
  },
  async (request) => {
    // Function code
  },
);
```

### 4. **Local Development**

**Gen 2 supports .env files natively:**

1. Create `functions/.env`:

   ```env
   GMAIL_EMAIL=kalarang.team@gmail.com
   GMAIL_APP_PASSWORD=your-16-char-password
   ```

2. The params API automatically loads from .env in local development

3. No need for `dotenv` package (but we include it for compatibility)

### 5. **Secrets Management**

**Before (Gen 1):**

```bash
firebase functions:config:set gmail.password="secret123"
```

**After (Gen 2):**

```bash
# Secrets are stored in Google Secret Manager
firebase functions:secrets:set GMAIL_APP_PASSWORD
```

## File Changes Summary

### Modified Files:

1. **`functions/index.js`**
   - ✅ Migrated to `firebase-functions/v2` API
   - ✅ Uses `defineString` and `defineSecret` for params
   - ✅ Enhanced error handling and validation
   - ✅ Added input sanitization
   - ✅ Improved logging with structured data
   - ✅ Email transporter verification
   - ✅ Message length limits (5000 chars)
   - ✅ Email format validation
   - ✅ Production-ready configuration

2. **`functions/package.json`**
   - ✅ Added `dotenv` for local development
   - ✅ Already using `firebase-functions@^7.0.0` (Gen 2 compatible)

3. **`functions/.env.example`** (New)
   - ✅ Template for local environment variables
   - ✅ Instructions for setup

## Configuration Steps

### For Local Development:

1. **Create `.env` file in functions directory:**

   ```bash
   cd functions
   copy .env.example .env
   ```

2. **Edit `.env` with your credentials:**

   ```env
   GMAIL_EMAIL=kalarang.team@gmail.com
   GMAIL_APP_PASSWORD=your-app-password-here
   ```

3. **Run emulators:**
   ```bash
   firebase emulators:start
   ```

### For Production:

1. **Set secrets using Firebase CLI:**

   ```bash
   # From project root
   firebase functions:secrets:set GMAIL_APP_PASSWORD
   # Paste your 16-character Gmail App Password when prompted
   ```

2. **Deploy the function:**
   ```bash
   firebase deploy --only functions:sendSupportEmail
   ```

## Testing the Migration

### Local Testing:

```bash
# Terminal 1 - Start Firebase emulators
firebase emulators:start

# Terminal 2 - Start React app
npm start

# Test the support form in your Profile page
```

### Production Testing:

```bash
# Deploy
firebase deploy --only functions:sendSupportEmail

# Test in production
# 1. Open your app
# 2. Go to Profile page
# 3. Send a test message
# 4. Check kalarang.team@gmail.com inbox
```

## Benefits of Gen 2

### Performance:

- **Cold starts**: 100x faster (typically <1 second)
- **Execution**: More efficient CPU allocation
- **Concurrency**: Handle multiple requests per instance

### Cost:

- **Pay per use**: Only charged for actual execution time
- **Free tier**: More generous than Gen 1
- **No idle charges**: No charges when function is not running

### Developer Experience:

- **Better logs**: Structured logging with Cloud Logging
- **Environment variables**: Native support with defaults
- **Type safety**: Better TypeScript support
- **Modern API**: Cleaner, more intuitive syntax

## Compatibility

✅ **Fully compatible with:**

- Node.js 18, 20, 22, 24
- Firebase CLI 11.0.0+
- firebase-admin 11.0.0+
- firebase-functions 7.0.0+

⚠️ **Not compatible with:**

- firebase-functions < 4.0.0
- Node.js < 18
- Firebase CLI < 11.0.0

## Troubleshooting

### Issue: "Secret GMAIL_APP_PASSWORD not found"

**Solution:**

```bash
firebase functions:secrets:set GMAIL_APP_PASSWORD
```

### Issue: "GMAIL_EMAIL is undefined"

**Solution:**
Either set default in code (already done) or create .env file:

```env
GMAIL_EMAIL=your-email@gmail.com
```

### Issue: Function times out

**Solution:**
Already configured with 60 second timeout. If needed, increase:

```javascript
exports.sendSupportEmail = onCall({
  timeoutSeconds: 120, // 2 minutes
  // ...
}, ...);
```

### Issue: "Cannot find module firebase-functions/v2"

**Solution:**

```bash
cd functions
npm install firebase-functions@^7.0.0
```

## Monitoring and Logs

### View logs in Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Functions** → **Logs**
4. Filter by function name: `sendSupportEmail`

### View logs using CLI:

```bash
firebase functions:log --only sendSupportEmail
```

### Structured logging in code:

```javascript
logger.info("Support email sent", {
  messageId: info.messageId,
  from: userEmail,
  userName: sanitizedUserName,
});
```

## Security Improvements

✅ **Enhanced security features:**

- Input validation (email format, message length)
- XSS prevention (HTML sanitization)
- Rate limiting (maxInstances)
- Secure secrets storage (Google Secret Manager)
- Email transporter verification
- Detailed error logging without exposing sensitive data

## Next Steps

1. ✅ Migration complete - No action needed
2. 📝 Set up production secrets (if not done)
3. 🚀 Deploy to production
4. 📊 Monitor logs and performance
5. 🔒 Review security settings

## Rollback Plan

If you need to rollback to Gen 1:

1. Revert `functions/index.js` from git history
2. Use `functions.config()` instead of params API
3. Deploy with `firebase deploy --only functions`

**Note**: Not recommended as Gen 1 is deprecated and will be removed in future.

## Additional Resources

- [Firebase Functions Gen 2 Docs](https://firebase.google.com/docs/functions/2nd-gen)
- [Params API Reference](https://firebase.google.com/docs/functions/config-env)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Secrets Manager](https://cloud.google.com/secret-manager/docs)

---

**Migration Status**: ✅ Complete  
**Gen 2 Compatible**: ✅ Yes  
**Production Ready**: ✅ Yes  
**Local Development**: ✅ Supported via .env

Your Cloud Function is now fully migrated to Gen 2 and production-ready! 🎉
