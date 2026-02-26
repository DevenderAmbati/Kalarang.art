# Email Configuration Quick Reference

## Email Details

### Recipient

- **To**: kalarang.team@gmail.com

### From User's Email

- **From**: Kalarang System (kalarang.team@gmail.com)
- **Reply-To**: User's actual email address (so you can reply directly)

### Subject Format

```
Support/Suggestion from [User's Name]
```

**Examples**:

- `Support/Suggestion from John Doe`
- `Support/Suggestion from Artist123`
- `Support/Suggestion from User` (if no name available)

## Email Content Structure

### Header Section

- User's full name
- User's email address (clickable mailto link)
- Timestamp of when the message was sent

### Message Body

- The actual message typed by the user
- Preserves line breaks and formatting

### Footer

- Quick reply instructions
- Branding information

## How It Works

1. **User Action**: User types a message in Profile page → Support & Suggestions section
2. **Click Send**: Triggers the `handleSendMessage` function
3. **Cloud Function**: Calls `sendSupportEmail` Firebase Cloud Function
4. **Email Sent**: Nodemailer sends email via Gmail SMTP
5. **Confirmation**: User sees success toast notification

## Custom Subject (Optional)

If you want to allow users to specify their own subject, you can modify the Profile.tsx form to include a subject field. The Cloud Function already supports a custom subject parameter.

## Testing

To test the email functionality:

1. Log in to the application
2. Go to Profile page
3. Scroll to "Support & Suggestions" section
4. Type: "This is a test message from [Your Name]"
5. Click "Send Message"
6. Check kalarang.team@gmail.com inbox

## Email Preview

```
From: Kalarang User <kalarang.team@gmail.com>
Reply-To: user@example.com
To: kalarang.team@gmail.com
Subject: Support/Suggestion from John Doe

────────────────────────────────────────
     Kalarang Support Message
────────────────────────────────────────

New Message from John Doe

From: John Doe
Email: user@example.com
Received: 2/22/2026, 10:30:00 AM

Message:
I love the platform! Could you add a dark mode
feature? It would be really helpful for night
browsing.

───────────────────────────────────────
💡 Quick Reply: Simply reply to this email
to respond directly to John Doe.
───────────────────────────────────────

This message was sent via Kalarang Support System
```

## Important Notes

- ✅ Emails include user's information for context
- ✅ Reply-To header allows direct user response
- ✅ HTML and plain text versions included
- ✅ Professional formatting with Kalarang branding
- ✅ Timestamp in user's local timezone
- ⚠️ Note the email typo: "tem" not "team" (as per your requirement)
