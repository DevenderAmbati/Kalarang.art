# Email Functionality Setup Guide

This guide explains how to set up and use the email sending functionality for the support/suggestion form in your Kalarang application.

## Overview

When users type a message in the Profile page support section and click "Send Message", an email is sent to **kalarang.team@gmail.com** from the user's registered email address.

## Components

### 1. **Cloud Function** (`functions/index.js`)

- Function name: `sendSupportEmail`
- Uses Nodemailer to send emails via Gmail SMTP
- Sends beautifully formatted HTML emails with user information

### 2. **Frontend Integration** (`src/pages/user/Profile.tsx`)

- Updated to call the Cloud Function
- Provides user feedback via toast notifications
- Handles errors gracefully

## Setup Instructions

### Step 0: Install Dependencies (If Not Already Done)

```bash
# Navigate to functions directory
cd "C:\Users\ASUS\Desktop\Kalarang MVP\kalarang\functions"

# Install dependencies including dotenv for local development
npm install
```

**For Local Emulator Testing (Optional):**

Firebase emulators require Java (JDK 11 or higher). If you plan to test locally:

1. **Check if Java is installed:**

   ```powershell
   java -version
   ```

2. **If not installed, install Java:**
   - Quick: Download [Microsoft OpenJDK 17](https://learn.microsoft.com/en-us/java/openjdk/download)
   - Or via winget: `winget install Microsoft.OpenJDK.17`
   - See [JAVA_INSTALLATION_GUIDE.md](./JAVA_INSTALLATION_GUIDE.md) for detailed instructions

3. **Alternative**: Skip emulators and test directly in production (see Step 4)

### Step 1: Create Gmail App Password

1. **Log in to Gmail** (kalarang.team@gmail.com or the email you want to use)

2. **Enable 2-Factor Authentication** (if not already enabled):
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Enable "2-Step Verification"

3. **Create App Password**:
   - Go to [App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" and "Other (Custom name)"
   - Name it "Kalarang Support"
   - Click "Generate"
   - **Copy the 16-character password** (you'll need this in the next step)

### Step 2: Configure Firebase Secrets (Gen 2 Functions)

The function now uses Firebase Functions Gen 2 with the modern params API. You can configure it in two ways:

#### Option A: Using Firebase CLI (Recommended for Production)

```bash
# Navigate to your project directory
cd "C:\Users\ASUS\Desktop\Kalarang MVP\kalarang"

# Set the Gmail app password as a secret (Gen 2)
firebase functions:secrets:set GMAIL_APP_PASSWORD
# When prompted, paste the 16-character app password you generated

# Optional: Set a custom Gmail email (default is kalarang.team@gmail.com)
# Create a .env file in the functions directory or set via Firebase:
firebase functions:config:set gmail.email="kalarang.team@gmail.com"
```

#### Option B: Using .env File for Local Development

1. Copy the `.env.example` file in the `functions` directory:

   ```bash
   cd functions
   copy .env.example .env
   ```

2. Edit `.env` file and add your credentials:

   ```env
   GMAIL_EMAIL=kalarang.team@gmail.com
   GMAIL_APP_PASSWORD=your-16-char-app-password
   ```

3. **IMPORTANT**: Never commit the `.env` file to version control!

#### Option C: Using Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your Kalarang project
3. Go to **Functions** → **Secrets**
4. Add secret:
   - Name: `GMAIL_APP_PASSWORD`

#### For Local Testing with Firebase Emulators (Requires Java):

**Prerequisites**: Java JDK 11+ must be installed. Check with `java -version`

If Java is not installed, see [JAVA_INSTALLATION_GUIDE.md](./JAVA_INSTALLATION_GUIDE.md)

```bash
# In functions directory, create .env file with your credentials (see Step 2, Option B)

# Start Firebase emulators from project root
cd "C:\Users\ASUS\Desktop\Kalarang MVP\kalarang"
firebase emulators:start

# In another terminal, start your React app
npm start
```

**Note**: If you get "Could not spawn java -version" error, install Java first or skip to production testing below.

#### For Production Testing:

1. Start your development server:

```bash
npm start
```

2. Log in to your application
3. Navigate to **Profile** page
4. Scroll to the "Support & Suggestions" section
5. Type a test message
6. Click "Send Message"
7. Check the email inbox at kalarang.team@gmail.com

## Technology Stack

This implementation uses:

- **Firebase Functions Gen 2** (v2 API) - Modern, faster, more scalable
- **firebase-functions/params** - Type-safe environment variables
- **Nodemailer** - Email sending library
- **Gmail SMTP** - Email delivery service
- **dotenv** - Local environment variable management

## What Changed in Gen 2 Migration

✅ **Improvements**:

- ✅ Uses `firebase-functions/v2` API (faster cold starts)
- ✅ Uses `defineString` and `defineSecret` from params API
- ✅ Better type safety and default values
- ✅ Local `.env` file support for development
- ✅ Enhanced error handling and logging
- ✅ Input validation and sanitization
- ✅ Configurable memory, timeout, and region
- ✅ Email transporter verification before sending
- ✅ Message length limits (max 5000 chars)
- ✅ Email format validation
- ✅ Detailed structured logging

⚠️ **Breaking Changes from Gen 1**:

- No longer uses deprecated `functions.config()`
- Requires Firebase CLI 11.0.0 or higher
- Secrets must be set using `firebase functions:secrets:set`

````

### Step 4: Test the Function

1. Start your development server:
```bash
npm start
````

2. Log in to your application
3. Navigate to **Profile** page
4. Scroll to the "Support & Suggestions" section
5. Type a test message
6. Click "Send Message"
7. Check the email inbox at kalarang.team@gmail.com

## Email Template

The sent email includes:

- **Subject**: `Support/Suggestion from [User Name]`
- **From**: The Kalarang system email (kalarang.team@gmail.com)
- **Reply-To**: User's actual email address
- **Content**:
  - User's name
  - User's email address
  - Timestamp
  - The message
  - Formatted in a beautiful HTML template with Kalarang branding

## Troubleshooting

### Issue: "Failed to send email"

**Solutions**:

1. Verify Gmail App Password is correct
2. Check if 2-Factor Authentication is enabled on the Gmail account
3. Ensure the secrets are properly set in Firebase
4. Check Firebase Functions logs:
   ```bash
   firebase functions:log
   ```

### Issue: Email not receiving

**Solutions**:

1. Check spam/junk folder
2. Verify the email address `kalarang.team@gmail.com` is correct (note: it's "tem" not "team")
3. Check Firebase Functions logs for errors

### Issue: "CORS error" or "Function not found"

**Solutions**:

1. Make sure the function is deployed:

   ```bash"Could not spawn java -version"

   ```

**Cause**: Firebase emulators require Java JDK 11 or higher

**Solutions**:

1. Install Java:
   - Quick: `winget install Microsoft.OpenJDK.17` (Windows Package Manager)
   - Or download from: https://learn.microsoft.com/en-us/java/openjdk/download
   - See [JAVA_INSTALLATION_GUIDE.md](./JAVA_INSTALLATION_GUIDE.md) for details

2. Verify Java installation:

   ```powershell
   java -version
   ```

3. Restart PowerShell and try again:
   ```bash
   firebase emulators:start
   ```

**Alternative**: Skip emulators and test directly in production (deploy and test)

### Issue: Local Testing

To test locally with Firebase emulators:

````bash
# Prerequisite: Install Java (see above)
re your Firebase project is properly initialized

### Issue: Local Testing

To test locally with Firebase emulators:

```bash
# Start emulators
firebase emulators:start

# In your app, the function will automatically use the local emulator
````

## Security Considerations

✅ **Best Practices Implemented**:

- Gmail App Password is stored as a Firebase secret (not in code)
- User emails are validated before sending
- Rate limiting via Firebase Functions maxInstances
- CORS is properly configured
- Reply-To header allows direct response to users

⚠️ **Important Notes**:

- Never commit the App Password to version control
- The App Password should only be stored in Firebase secrets
- Consider implementing rate limiting per user to prevent spam
- Monitor Firebase Functions usage to control costs

## Cost Considerations

Firebase Functions pricing:

- **Free tier**: 2 million invocations per month
- **After free tier**: $0.40 per million invocations
- For support emails, this should be well within free tier limits

## Future Enhancements

Consider adding:

1. Email templates for different message types
2. Automatic response emails to users
3. Admin dashboard to view messages
4. Email categorization (bug report, feature request, etc.)
5. File attachments support

## Support

If you need help with the setup:

1. Check Firebase Console → Functions for error logs
2. Review the code in `functions/index.js`
3. Test with Firebase emulators locally

---

**Setup Complete! 🎉**

Your support email system is now ready to use. Users can send messages directly from their Profile page, and you'll receive them at kalarang.team@gmail.com with the ability to reply directly.
