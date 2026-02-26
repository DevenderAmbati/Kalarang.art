# Artist Reach-Out Feature - Implementation Guide

## ✅ What Was Implemented

A comprehensive reach-out system that allows users to contact artists through:

1. **Email** - Professional system email with user's email as reply-to
2. **WhatsApp** - Direct chat with pre-filled message (if artist added WhatsApp number)

## 📦 Files Created/Modified

### **New Files Created:**

1. **src/components/Modals/ReachOutModal.tsx**
   - Modal component with two reach-out options
   - Email and WhatsApp buttons with beautiful UI
   - Handles sending email via Cloud Function
   - Opens WhatsApp chat with pre-filled message

2. **src/components/Modals/ReachOutModal.css**
   - Modern, responsive styling
   - Gradient icons for email (purple) and WhatsApp (green)
   - Hover effects and animations
   - Mobile-friendly design

3. **functions/index.js - sendArtistReachOut** (New Cloud Function)
   - Sends professional emails from system to artist
   - Sets user's email as reply-to
   - Beautiful HTML email template
   - Includes artwork title and user details

### **Modified Files:**

1. **src/firebase.ts**
   - Added `getFunctions` import
   - Exported `functions` instance

2. **src/pages/artwork/CardDetail.tsx**
   - Integrated ReachOutModal
   - Fetches artist's email and WhatsApp from profile
   - Opens modal on "Reach Out" button click
   - Added validation checks

## 🎯 Features

### Email Option

**From:** kalarang.team@gmail.com  
**To:** Artist's email  
**Reply-To:** User's email  
**Subject:** "Interest in Your Artwork: [Artwork Title] - Kalarang"

**Email Content:**

- Professional Kalarang branding
- User's name and email
- Artwork title highlighted
- Call-to-action button to reply
- Tips for artists

**When Artist Replies:**

- Reply goes directly to the user's email
- Seamless communication

### WhatsApp Option

**Shows only if:** Artist has added WhatsApp number  
**Opens:** WhatsApp chat in new tab  
**Pre-filled Message:**

```
Hi [Artist Name]! I came across your artwork "[Artwork Title]" on Kalarang and I'm interested in learning more about it. Looking forward to connecting with you!
```

## 🚀 How It Works

### User Flow:

1. User clicks "Reach Out" on artwork detail page
2. Modal opens with two options:
   - **Email Icon** (Purple gradient) - Always shown
   - **WhatsApp Icon** (Green gradient) - Only if artist has WhatsApp

3. **If Email is clicked:**
   - Cloud Function `sendArtistReachOut` is called
   - Email sent to artist from system email
   - User's email set as reply-to
   - Success toast notification shown
   - Modal closes

4. **If WhatsApp is clicked:**
   - WhatsApp URL constructed with artist's number
   - Pre-filled message included
   - Opens in new browser tab
   - WhatsApp app/web opens automatically
   - Modal closes

### Technical Flow:

```
User clicks "Reach Out"
  ↓
CardDetail fetches artist profile (email, WhatsApp)
  ↓
ReachOutModal opens
  ↓
User selects Email or WhatsApp
  ↓
Email: Cloud Function → Gmail SMTP → Artist's Inbox
WhatsApp: Browser → WhatsApp API → Artist's Chat
  ↓
Success notification
```

## 🔧 Prerequisites

### Already Set Up ✅

- Firebase Functions configured
- Gmail App Password set as secret
- `sendSupportEmail` function working
- Artist profiles have email and optional WhatsApp fields

### Email Configuration:

The same Gmail configuration used for support emails works for artist reach-out:

- Gmail: kalarang.team@gmail.com
- Secret: GMAIL_APP_PASSWORD (already configured)

## 📱 UI/UX Details

### Modal Design:

- **Large Icons:** 56x56px with gradient backgrounds
- **Email:** Purple gradient (#667eea → #764ba2)
- **WhatsApp:** Green gradient (#25D366 → #128C7E)
- **Hover Effect:** Lifts card, changes border to primary color
- **Artist Info:** Shows avatar, name, and artwork title

### Responsive:

- Desktop: Wide modal with side-by-side icons
- Mobile: Stacked cards, smaller icons (48x48px)
- Touch-friendly: Large click targets

## 🔐 Security & Validation

### Email Validation:

- User must be logged in
- Cannot reach out to themselves
- Artist email must be available
- Email format validated in Cloud Function

### WhatsApp Validation:

- Only shows if artist has WhatsApp number
- Phone number sanitized (removes spaces, dashes)
- URL encoded properly

### Rate Limiting:

- Cloud Function: maxInstances: 5
- Firebase: Built-in rate limiting

## 📊 Cloud Function Details

### sendArtistReachOut

**Parameters:**

- `artistName`: Artist's display name
- `artistEmail`: Artist's email address
- `artworkTitle`: Title of the artwork
- `userName`: User's name
- `userEmail`: User's email (for reply-to)

**Returns:**

```json
{
  "success": true,
  "message": "Email sent successfully to artist",
  "messageId": "firebase-generated-id"
}
```

**Region:** us-central1  
**Memory:** 256MiB  
**Timeout:** 60 seconds  
**Secrets Used:** GMAIL_APP_PASSWORD

## 🧪 Testing

### Test Email:

1. Go to artwork detail page
2. Click "Reach Out"
3. Click "Send Email"
4. Check artist's email inbox
5. Verify reply-to is set correctly
6. Try replying - should go to user's email

### Test WhatsApp:

1. Ensure artist has WhatsApp number in profile
2. Go to artwork detail page
3. Click "Reach Out"
4. Verify WhatsApp option appears
5. Click WhatsApp button
6. Verify WhatsApp opens with pre-filled message
7. Check phone number is correct

### Edge Cases Tested:

- ✅ User not logged in → Shows error toast
- ✅ User tries to reach out to themselves → Shows info toast
- ✅ Artist has no email → Shows error (shouldn't happen)
- ✅ Artist has no WhatsApp → WhatsApp option not shown
- ✅ Network error during email send → Shows error toast

## 🎨 Customization

### Change Email Template:

Edit `functions/index.js` → `sendArtistReachOut` → `html` section

### Change WhatsApp Message:

Edit `src/components/Modals/ReachOutModal.tsx` → `handleWhatsAppClick` → `message` variable

### Change Modal Styling:

Edit `src/components/Modals/ReachOutModal.css`

## 📝 Future Enhancements

- [ ] Add in-app messaging system
- [ ] Track reach-out analytics
- [ ] Add message templates
- [ ] Allow custom message before sending email
- [ ] Add phone call option
- [ ] Instagram/social media links
- [ ] Scheduling feature for follow-ups

## 🐛 Troubleshooting

### Email not sending:

- Check Gmail App Password is set correctly
- Verify artist email is valid
- Check Cloud Function logs: `firebase functions:log`

### WhatsApp not opening:

- Verify phone number format (include country code)
- Check WhatsApp is installed/accessible
- Test with different browsers

### Modal not opening:

- Check console for errors
- Verify artist profile loaded correctly
- Check user is logged in

## 📄 Related Files

- [EMAIL_IMPLEMENTATION_SUMMARY.md](./EMAIL_IMPLEMENTATION_SUMMARY.md) - Support email details
- [EMAIL_SETUP_GUIDE.md](./EMAIL_SETUP_GUIDE.md) - Gmail configuration
- [EMAIL_SUBJECT_FORMAT.md](./EMAIL_SUBJECT_FORMAT.md) - Email formatting

## ✨ Summary

The reach-out feature provides users with **two convenient ways** to contact artists:

1. **Professional email** through the system with easy reply
2. **Direct WhatsApp chat** for instant communication

Both options are **one-click** actions with no additional forms, making it **frictionless** for users to express interest in artworks.
