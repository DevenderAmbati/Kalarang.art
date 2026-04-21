/**
 * Firebase Cloud Functions - Gen 2 (v2 API)
 * Email Support System for Kalarang
 * 
 * This module handles sending support/suggestion emails from users
 * to the Kalarang team using Gmail SMTP with Nodemailer.
 * 
 * Environment Variables Required:
 * - GMAIL_EMAIL: The Gmail address to send from (e.g., kalarang.team@gmail.com)
 * - GMAIL_APP_PASSWORD: Gmail App Password (Secret)
 * 
 * For local development, create a .env file in the functions directory.
 * For production, set secrets using:
 *   firebase functions:secrets:set GMAIL_APP_PASSWORD
 * 
 * @see https://firebase.google.com/docs/functions/get-started
 */

const {onCall, onRequest, HttpsError} = require("firebase-functions/v2/https");
const {onDocumentCreated, onDocumentWritten} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {setGlobalOptions} = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const {defineSecret, defineString} = require("firebase-functions/params");
const nodemailer = require("nodemailer");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {getMessaging} = require("firebase-admin/messaging");

const admin = initializeApp();
const db = getFirestore();
const messaging = getMessaging();
const {FieldValue} = require("firebase-admin/firestore");

/** Buyer accepts artist offer from commission chat — mirrors hire flow + updates offer message. */
exports.acceptCommissionOffer = onCall(
  {
    invoker: "public",
    cors: true,
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "Sign in to accept this offer.");
    }
    const buyerId = request.auth.uid;
    const chatId = String((request.data && request.data.chatId) || "").trim();
    const messageId = String((request.data && request.data.messageId) || "").trim();
    if (!chatId || !messageId) {
      throw new HttpsError("invalid-argument", "chatId and messageId are required.");
    }

    const chatRef = db.collection("commissionChats").doc(chatId);
    const msgRef = chatRef.collection("messages").doc(messageId);

    const chatSnap = await chatRef.get();
    const msgSnap = await msgRef.get();
    if (!chatSnap.exists || !msgSnap.exists) {
      throw new HttpsError("not-found", "Chat or message not found.");
    }

    const chat = chatSnap.data();
    const msg = msgSnap.data();

    const participants = chat.participants || [];
    if (!participants.includes(buyerId)) {
      throw new HttpsError("permission-denied", "Not a participant in this chat.");
    }
    if (msg.senderId === buyerId) {
      throw new HttpsError("permission-denied", "Only the buyer can accept this offer.");
    }
    if (msg.messageType !== "commission_offer" || msg.offerStatus !== "pending") {
      throw new HttpsError("failed-precondition", "This offer cannot be accepted.");
    }

    const artistId = msg.senderId;
    const commissionId = msg.commissionId;
    if (!commissionId || chat.commissionId !== commissionId) {
      throw new HttpsError("failed-precondition", "Invalid commission for this chat.");
    }

    const commRef = db.collection("commissions").doc(commissionId);
    const commSnap = await commRef.get();
    if (!commSnap.exists) {
      throw new HttpsError("not-found", "Commission not found.");
    }
    const comm = commSnap.data();
    if (comm.buyerId !== buyerId) {
      throw new HttpsError("permission-denied", "Not allowed.");
    }
    const st = String(comm.status || "").trim().toLowerCase().replace(/\s+/g, "");
    if (st !== "open") {
      throw new HttpsError("failed-precondition", "This commission is no longer open.");
    }

    const finalPrice = String(msg.offerFinalPrice || "").trim();
    const advanceAmount = String(msg.offerAdvanceAmount || "").trim();
    const deliveryDate = String(msg.offerDeliveryDate || "").trim();

    await db.runTransaction(async (t) => {
      const freshComm = await t.get(commRef);
      const freshMsg = await t.get(msgRef);
      if (!freshComm.exists || !freshMsg.exists) {
        throw new HttpsError("not-found", "Commission or message was removed.");
      }
      const c = freshComm.data();
      const m = freshMsg.data();
      const cst = String(c.status || "").trim().toLowerCase().replace(/\s+/g, "");
      if (cst !== "open" || c.buyerId !== buyerId) {
        throw new HttpsError("failed-precondition", "Commission is no longer open.");
      }
      if (m.offerStatus !== "pending" || m.messageType !== "commission_offer") {
        throw new HttpsError("failed-precondition", "This offer is no longer pending.");
      }

      t.update(commRef, {
        status: "inprogress",
        hiredArtistId: artistId,
        agreedFinalPrice: finalPrice,
        agreedAdvanceAmount: advanceAmount,
        agreedDeliveryDate: deliveryDate,
        updatedAt: FieldValue.serverTimestamp(),
      });
      t.update(msgRef, {
        offerStatus: "accepted",
        acceptedAt: FieldValue.serverTimestamp(),
      });
    });

    const offerAcceptedText = "Offer accepted. Payment is sent and address details are provided.";
    await chatRef.collection("messages").add({
      senderId: buyerId,
      text: offerAcceptedText,
      seenBy: [buyerId],
      commissionId,
      commissionTitle: msg.commissionTitle || "",
      commissionImage: msg.commissionImage || "",
      createdAt: FieldValue.serverTimestamp(),
    });

    const otherUnreadPatch = {};
    otherUnreadPatch[`unreadFor.${artistId}`] = FieldValue.increment(1);
    otherUnreadPatch[`unreadFor.${buyerId}`] = 0;
    await chatRef.update({
      lastMessage: offerAcceptedText,
      updatedAt: FieldValue.serverTimestamp(),
      ...otherUnreadPatch,
    });

    const hiredElsewhereText = "Another artist was hired for this commission";
    const otherChats = await db.collection("commissionChats")
      .where("participants", "array-contains", buyerId)
      .get();

    const batch = db.batch();
    let closeCount = 0;
    for (const docSnap of otherChats.docs) {
      if (docSnap.id === chatId) continue;
      const d = docSnap.data();
      if (d.commissionId !== commissionId) continue;
      if (d.closed) continue;
      const parts = d.participants || [];
      const otherUid = parts.find((u) => u !== buyerId);
      if (!otherUid || otherUid === artistId) continue;
      batch.update(docSnap.ref, {
        closed: true,
        closedReason: "other_hired",
        lastMessage: hiredElsewhereText,
        updatedAt: FieldValue.serverTimestamp(),
        [`unreadFor.${buyerId}`]: 0,
        [`unreadFor.${otherUid}`]: FieldValue.increment(1),
      });
      closeCount++;
    }
    if (closeCount > 0) {
      await batch.commit();
    }

    return {success: true};
  },
);

// Define environment parameters using Gen 2 params API
// These values can be set via .env file locally or Firebase secrets in production
const gmailEmail = defineString("GMAIL_EMAIL", {
  description: "Gmail address for sending support emails",
  default: "kalarang.team@gmail.com",
});

const gmailPassword = defineSecret("GMAIL_APP_PASSWORD", {
  description: "Gmail App Password for SMTP authentication",
});

// Gen 2 global options - applies to all functions in this file
setGlobalOptions({
  maxInstances: 10,
  region: "us-central1", // Specify region for Gen 2
  memory: "256MiB", // Optimize memory allocation
  timeoutSeconds: 60, // Set reasonable timeout
});

/**
 * POST /post/view
 * Body: { userId, postId }
 * Upserts a unique post view record into "post_views".
 */
exports.postView = onRequest(
  {
    cors: true,
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({error: "Method Not Allowed"});
      return;
    }

    const userId = String((req.body && req.body.userId) || "").trim();
    const postId = String((req.body && req.body.postId) || "").trim();
    if (!userId || !postId) {
      res.status(400).json({error: "userId and postId are required"});
      return;
    }

    try {
      const docId = `${userId.replace(/\//g, "_")}__${postId.replace(/\//g, "_")}`;
      await db.collection("post_views").doc(docId).set(
        {
          userId,
          postId,
          seenAt: FieldValue.serverTimestamp(),
        },
        {merge: true}
      );
      res.status(200).json({success: true});
    } catch (err) {
      logger.error("postView failed", {
        userId,
        postId,
        error: err && err.message ? err.message : String(err),
      });
      res.status(500).json({error: "Failed to store post view"});
    }
  }
);

/**
 * All commissions (any status) for server-side search; optional text filter in the handler.
 */
async function fetchAllCommissionDocs() {
  const snap = await db.collection("commissions").get();
  return snap.docs;
}

function serializeCommissionDoc(docSnap) {
  const d = docSnap.data();
  const ts = (t) => {
    if (!t) return null;
    if (typeof t.toMillis === "function") {
      return {seconds: t.seconds, nanoseconds: t.nanoseconds || 0};
    }
    if (t.seconds != null) {
      return {seconds: t.seconds, nanoseconds: t.nanoseconds || 0};
    }
    return null;
  };
  return {
    id: docSnap.id,
    buyerId: d.buyerId || "",
    buyerName: d.buyerName || "",
    buyerAvatar: d.buyerAvatar || "",
    title: d.title || "",
    description: d.description || "",
    referenceImages: Array.isArray(d.referenceImages) ? d.referenceImages : [],
    budget: d.budget || "",
    deadline: d.deadline || "",
    type: d.type || "",
    style: Array.isArray(d.style) ? d.style : [],
    subject: Array.isArray(d.subject) ? d.subject : [],
    deliveryType: d.deliveryType || "",
    cityOrPincode: d.cityOrPincode || "",
    status: d.status || "open",
    hiredArtistId: d.hiredArtistId || "",
    agreedFinalPrice: d.agreedFinalPrice || "",
    agreedAdvanceAmount: d.agreedAdvanceAmount || "",
    agreedDeliveryDate: d.agreedDeliveryDate || "",
    createdAt: ts(d.createdAt),
    updatedAt: ts(d.updatedAt),
  };
}

function commissionMatchesSearch(item, searchQuery) {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return true;
  const words = q.split(/\s+/).filter(Boolean);
  const haystack = [
    item.title,
    item.description,
    item.buyerName,
    item.type,
    item.budget,
    item.deadline,
    item.cityOrPincode,
    item.deliveryType,
    ...item.style,
    ...item.subject,
  ]
    .join(" ")
    .toLowerCase();
  return words.every((w) => haystack.includes(w));
}

exports.searchOpenCommissions = onCall(
  {
    invoker: "public",
    cors: true,
    memory: "512MiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to search commissions.");
    }
    const raw = (request.data && request.data.query) || "";
    const searchQuery = String(raw).trim();

    let docs;
    try {
      docs = await fetchAllCommissionDocs();
    } catch (e) {
      logger.error("searchOpenCommissions fetch failed", e);
      throw new HttpsError("internal", "Failed to load commissions.");
    }

    let serialized = docs.map(serializeCommissionDoc);
    if (searchQuery) {
      serialized = serialized.filter((row) => commissionMatchesSearch(row, searchQuery));
    }

    return {commissions: serialized};
  },
);

/**
 * Cloud Function (Gen 2) - Send Support Email
 * 
 * This callable function sends support/suggestion emails from users
 * to the Kalarang team. It uses Gmail SMTP with Nodemailer.
 * 
 * @param {Object} request.data - The request data
 * @param {string} request.data.message - The user's message (required)
 * @param {string} request.data.userName - The user's name
 * @param {string} request.data.userEmail - The user's email address (required)
 * @param {string} request.data.subject - Custom email subject (optional)
 * 
 * @returns {Promise<{success: boolean, message: string}>}
 * 
 * @throws {Error} If message or userEmail is missing
 * @throws {Error} If email sending fails
 * 
 * @example
 * const sendEmail = httpsCallable(functions, 'sendSupportEmail');
 * await sendEmail({
 *   message: "I need help with...",
 *   userName: "John Doe",
 *   userEmail: "john@example.com",
 *   subject: "Support Request"
 * });
 */
exports.sendSupportEmail = onCall(
  {
    secrets: [gmailPassword],
    maxInstances: 5, // Limit concurrent executions for this function
    memory: "256MiB",
    timeoutSeconds: 60,
    invoker: "public", // Allow authenticated users to call this function
  },
  async (request) => {
    try {
      // Extract and validate request data
      const {message, userName, userEmail, subject} = request.data;

      // Log incoming request (without sensitive data)
      logger.info("Processing support email request", {
        hasMessage: !!message,
        hasUserEmail: !!userEmail,
        userName: userName || "Anonymous",
      });

      // Validate required fields
      if (!message || !message.trim()) {
        logger.warn("Email request rejected: Missing message");
        throw new Error("Message is required");
      }

      if (!userEmail || !userEmail.trim()) {
        logger.warn("Email request rejected: Missing user email");
        throw new Error("User email is required");
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userEmail)) {
        logger.warn("Email request rejected: Invalid email format", {userEmail});
        throw new Error("Invalid email address format");
      }

      // Sanitize message length (prevent abuse)
      if (message.length > 5000) {
        logger.warn("Email request rejected: Message too long", {
          length: message.length,
        });
        throw new Error("Message is too long (max 5000 characters)");
      }

      // Get email configuration from environment
      const senderEmail = gmailEmail.value();
      const senderPassword = gmailPassword.value();

      // Verify email configuration is available
      if (!senderEmail || !senderPassword) {
        logger.error("Email configuration missing", {
          hasEmail: !!senderEmail,
          hasPassword: !!senderPassword,
        });
        throw new Error("Email service is not configured properly");
      }

      // Configure Gmail SMTP transporter with Nodemailer
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: senderEmail,
          pass: senderPassword,
        },
        // Additional security options
        secure: true,
        logger: false, // Set to true for debugging
        debug: false, // Set to true for debugging
      });

      // Verify transporter configuration
      try {
        await transporter.verify();
        logger.debug("Email transporter verified successfully");
      } catch (verifyError) {
        logger.error("Email transporter verification failed", {error: verifyError});
        throw new Error("Email service configuration error");
      }

      // Prepare email options with sanitized data
      const sanitizedUserName = (userName || "Kalarang User").replace(/[<>]/g, "");
      const emailSubject = subject || `Support/Suggestion from ${sanitizedUserName}`;
      
      const mailOptions = {
        from: `"${sanitizedUserName}" <${senderEmail}>`,
        to: "kalarang.team@gmail.com", // Primary recipient
        replyTo: userEmail, // Allow direct reply to user
        subject: emailSubject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #2FA4A9 0%, #26848A 100%); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Kalarang Support Message</h1>
            </div>
            <div style="padding: 20px; background: #f9f9f9;">
              <h2 style="color: #2FA4A9; margin-top: 0;">New Message from ${sanitizedUserName}</h2>
              <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p style="color: #666; margin: 5px 0;"><strong>From:</strong> ${sanitizedUserName}</p>
                <p style="color: #666; margin: 5px 0;"><strong>Email:</strong> <a href="mailto:${userEmail}">${userEmail}</a></p>
                <p style="color: #666; margin: 5px 0;"><strong>Received:</strong> ${new Date().toLocaleString()}</p>
              </div>
              <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #2FA4A9;">
                <h3 style="color: #333; margin-top: 0;">Message:</h3>
                <p style="color: #555; line-height: 1.6; white-space: pre-wrap;">${message}</p>
              </div>
              <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                <p style="margin: 0; color: #856404;"><strong>💡 Quick Reply:</strong> Simply reply to this email to respond directly to ${sanitizedUserName}.</p>
              </div>
            </div>
            <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
              <p>This message was sent via Kalarang Support System</p>
            </div>
          </div>
        `,
        text: `
New Support Message from Kalarang

From: ${sanitizedUserName}
Email: ${userEmail}
Date: ${new Date().toLocaleString()}

Message:
${message}

---
Reply to this email to respond directly to the user.
        `,
      };

      // Send email via Gmail SMTP
      logger.info("Attempting to send email", {
        to: "kalarang.team@gmail.com",
        from: userEmail,
      });

      const info = await transporter.sendMail(mailOptions);

      // Log successful send
      logger.info("Support email sent successfully", {
        messageId: info.messageId,
        from: userEmail,
        userName: sanitizedUserName,
        response: info.response,
      });

      // Return success response
      return {
        success: true,
        message: "Email sent successfully",
        messageId: info.messageId,
      };
    } catch (error) {
      // Enhanced error logging
      logger.error("Failed to send support email", {
        error: error.message,
        code: error.code,
        stack: error.stack,
      });

      // Return user-friendly error message
      throw new Error(
        error.message || "Failed to send email. Please try again later."
      );
    }
  }
);

/**
 * Cloud Function (Gen 2) - Send Artist Reach Out Email
 * 
 * This callable function sends reach-out emails from users to artists
 * when they express interest in an artwork.
 * 
 * @param {Object} request.data - The request data
 * @param {string} request.data.artistName - The artist's name (required)
 * @param {string} request.data.artistEmail - The artist's email (required)
 * @param {string} request.data.artworkTitle - The artwork title (required)
 * @param {string} request.data.userName - The user's name (required)
 * @param {string} request.data.userEmail - The user's email (required)
 * 
 * @returns {Promise<{success: boolean, message: string}>}
 */
exports.sendArtistReachOut = onCall(
  {
    secrets: [gmailPassword],
    maxInstances: 5,
    memory: "256MiB",
    timeoutSeconds: 60,
    invoker: "public", // Allow public access for this function
  },
  async (request) => {
    try {
      const {artistName, artistEmail, artworkTitle, userName, userEmail} = request.data;

      logger.info("Processing artist reach-out email", {
        hasArtistEmail: !!artistEmail,
        hasUserEmail: !!userEmail,
        artworkTitle: artworkTitle || "Unknown",
      });

      // Validate required fields
      if (!artistEmail || !artistEmail.trim()) {
        throw new Error("Artist email is required");
      }

      if (!userEmail || !userEmail.trim()) {
        throw new Error("User email is required");
      }

      if (!userName || !userName.trim()) {
        throw new Error("User name is required");
      }

      if (!artistName || !artistName.trim()) {
        throw new Error("Artist name is required");
      }

      if (!artworkTitle || !artworkTitle.trim()) {
        throw new Error("Artwork title is required");
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(artistEmail)) {
        throw new Error("Invalid artist email format");
      }
      if (!emailRegex.test(userEmail)) {
        throw new Error("Invalid user email format");
      }

      // Get email configuration
      const senderEmail = gmailEmail.value();
      const senderPassword = gmailPassword.value();

      if (!senderEmail || !senderPassword) {
        logger.error("Email configuration missing");
        throw new Error("Email service is not configured properly");
      }

      // Configure transporter
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: senderEmail,
          pass: senderPassword,
        },
        secure: true,
      });

      // Verify transporter
      await transporter.verify();

      // Sanitize data
      const sanitizedArtistName = artistName.replace(/[<>]/g, "");
      const sanitizedUserName = userName.replace(/[<>]/g, "");
      const sanitizedArtworkTitle = artworkTitle.replace(/[<>]/g, "");

      const mailOptions = {
        from: `"Kalarang" <${senderEmail}>`,
        to: artistEmail,
        replyTo: userEmail,
        subject: `Interest in Your Artwork: "${sanitizedArtworkTitle}" - Kalarang`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #2FA4A9 0%, #26848A 100%); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Kalarang</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">Someone's interested in your artwork!</p>
            </div>
            
            <div style="padding: 30px; background: #f9f9f9;">
              <h2 style="color: #2FA4A9; margin-top: 0;">Hello ${sanitizedArtistName}! 👋</h2>
              
              <div style="background: white; padding: 20px; border-radius: 12px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0;">
                  Great news! <strong>${sanitizedUserName}</strong> has reached out to you regarding your artwork:
                </p>
                <div style="background: #f0f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #2FA4A9;">
                  <p style="margin: 0; color: #555; font-size: 18px; font-weight: 600;">"${sanitizedArtworkTitle}"</p>
                </div>
              </div>

              <div style="background: white; padding: 20px; border-radius: 12px; margin: 20px 0;">
                <h3 style="color: #333; margin-top: 0;">Interested Buyer Details:</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-weight: 600;">Name:</td>
                    <td style="padding: 8px 0; color: #333;">${sanitizedUserName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-weight: 600;">Email:</td>
                    <td style="padding: 8px 0; color: #2FA4A9;"><a href="mailto:${userEmail}" style="color: #2FA4A9; text-decoration: none;">${userEmail}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-weight: 600;">Date:</td>
                    <td style="padding: 8px 0; color: #333;">${new Date().toLocaleString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</td>
                  </tr>
                </table>
              </div>

              <div style="background: #e8f5e9; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #4caf50;">
                <h3 style="color: #2e7d32; margin-top: 0;">✉️ How to Respond:</h3>
                <p style="color: #1b5e20; margin: 0; line-height: 1.6;">
                  Simply <strong>reply to this email</strong> to connect directly with ${sanitizedUserName}. 
                  They're eager to hear from you about your artwork!
                </p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="mailto:${userEmail}?subject=${encodeURIComponent(`Re: Interest in Your Artwork - "${sanitizedArtworkTitle}"`)}" style="display: inline-block; background: linear-gradient(135deg, #2FA4A9 0%, #26848A 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Reply to ${sanitizedUserName}
                </a>
              </div>

              <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.6;">
                  <strong>💡 Tip:</strong> Respond promptly to build trust and increase your chances of making a sale!
                </p>
              </div>
            </div>

            <div style="padding: 20px; text-align: center; color: #999; font-size: 12px; background: #f5f5f5;">
              <p style="margin: 5px 0;">This message was sent via Kalarang</p>
              <p style="margin: 5px 0;">Your platform for connecting artists and art enthusiasts</p>
            </div>
          </div>
        `,
        text: `
Hello ${sanitizedArtistName}!

Great news! ${sanitizedUserName} has reached out to you regarding your artwork:
"${sanitizedArtworkTitle}"

Interested Buyer Details:
- Name: ${sanitizedUserName}
- Email: ${userEmail}
- Date: ${new Date().toLocaleString()}

How to Respond:
Simply reply to this email to connect directly with ${sanitizedUserName}.

This message was sent via Kalarang.
        `,
      };

      logger.info("Attempting to send artist reach-out email", {
        to: artistEmail,
        from: userEmail,
      });

      const info = await transporter.sendMail(mailOptions);

      logger.info("Artist reach-out email sent successfully", {
        messageId: info.messageId,
        artistEmail,
        userEmail,
      });

      return {
        success: true,
        message: "Email sent successfully to artist",
        messageId: info.messageId,
      };
    } catch (error) {
      logger.error("Failed to send artist reach-out email", {
        error: error.message,
        code: error.code,
        stack: error.stack,
      });

      throw new Error(
        error.message || "Failed to send email. Please try again later."
      );
    }
  }
);

// ---------------------------------------------------------------------------
// Push Notification Functions (FCM)
// ---------------------------------------------------------------------------

/**
 * Look up all FCM tokens for a given user from the "userTokens" collection.
 */
async function getUserFcmTokens(userId) {
  const snapshot = await db
    .collection("userTokens")
    .where("userId", "==", userId)
    .get();

  return snapshot.docs.map((d) => ({id: d.id, token: d.data().token}));
}

/**
 * Send an FCM notification to all of a user's devices.
 * Automatically removes stale/expired tokens.
 */
async function sendPushToUser(userId, notification, data = {}, collapseKey = null) {
  const tokenEntries = await getUserFcmTokens(userId);
  if (tokenEntries.length === 0) {
    logger.info("No FCM tokens found for user", {userId});
    return;
  }

  const fcmData = {
    ...data,
    title: notification.title || "Kalarang",
    body: notification.body || "You have a new notification",
  };

  const msg = {data: fcmData};
  if (collapseKey) {
    msg.webpush = {headers: {Topic: collapseKey}};
  }

  const results = await Promise.allSettled(
    tokenEntries.map(({id, token}) =>
      messaging
        .send({...msg, token})
        .catch(async (err) => {
          if (
            err.code === "messaging/invalid-registration-token" ||
            err.code === "messaging/registration-token-not-registered"
          ) {
            logger.info("Removing stale FCM token", {tokenDocId: id});
            await db.collection("userTokens").doc(id).delete();
          }
          throw err;
        })
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  logger.info("Push notification results", {userId, sent, failed});
}

/**
 * Trigger: new document in "notifications" collection (follow, favourite, reachout).
 * Sends FCM push to the recipient.
 */
exports.onNotificationCreated = onDocumentCreated(
  {
    document: "notifications/{notificationId}",
    region: "us-central1",
    memory: "256MiB",
    maxInstances: 20,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const notif = snap.data();
    const {recipientId, actorName, type, artworkTitle} = notif;

    if (!recipientId) {
      logger.warn("Notification missing recipientId", {id: snap.id});
      return;
    }

    let title = "Kalarang";
    let body = "You have a new notification";

    const commissionTitle = notif.commissionTitle || "";
    const artworkId = notif.artworkId || "";
    const commentSnippet = typeof notif.commentSnippet === "string" ? notif.commentSnippet.trim() : "";

    switch (type) {
    case "follow":
      title = "New Follower";
      body = `${actorName || "Someone"} started following you`;
      break;
    case "favourite":
      title = "New Favourite";
      body = artworkTitle
        ? `${actorName || "Someone"} favourited "${artworkTitle}"`
        : `${actorName || "Someone"} favourited your artwork`;
      break;
    case "like":
      title = "New Like";
      body = artworkTitle
        ? `${actorName || "Someone"} liked "${artworkTitle}"`
        : `${actorName || "Someone"} liked your artwork`;
      break;
    case "comment":
      title = "New Comment";
      body = artworkTitle
        ? `${actorName || "Someone"} commented on "${artworkTitle}"`
        : `${actorName || "Someone"} commented on your artwork`;
      if (commentSnippet) {
        const short = commentSnippet.length > 100 ? commentSnippet.slice(0, 100) + "…" : commentSnippet;
        body = `${body}: ${short}`;
      }
      break;
    case "comment_reply":
      title = "Reply to your comment";
      body = artworkTitle
        ? `${actorName || "Someone"} replied on "${artworkTitle}"`
        : `${actorName || "Someone"} replied to your comment`;
      if (commentSnippet) {
        const short = commentSnippet.length > 100 ? commentSnippet.slice(0, 100) + "…" : commentSnippet;
        body = `${body}: ${short}`;
      }
      break;
    case "reachout":
      title = "New Reach Out";
      body = artworkTitle
        ? `${actorName || "Someone"} reached out about "${artworkTitle}"`
        : `${actorName || "Someone"} reached out to you`;
      break;
    case "commission_application":
      title = "New Application";
      body = commissionTitle
        ? `${actorName || "An artist"} applied to your commission "${commissionTitle}"`
        : `${actorName || "An artist"} applied to your commission`;
      break;
    case "commission_offer":
      title = "New Commission Offer";
      body = commissionTitle
        ? `${actorName || "An artist"} sent you an offer for "${commissionTitle}"`
        : `${actorName || "An artist"} sent you a commission offer`;
      break;
    case "commission_offer_accepted":
      title = "Offer Accepted!";
      body = commissionTitle
        ? `${actorName || "The buyer"} accepted your offer for "${commissionTitle}". Payment is done — you can start the work!`
        : `${actorName || "The buyer"} accepted your offer — you can start the work!`;
      break;
    case "commission_completed":
      title = "Commission Completed";
      body = commissionTitle
        ? `Your commission "${commissionTitle}" has been marked as completed`
        : "Your commission has been marked as completed";
      break;
    default:
      body = `${actorName || "Someone"} interacted with your profile`;
    }

    const isCommissionType = ["commission_application", "commission_offer", "commission_offer_accepted", "commission_completed"].includes(type);
    const artworkDeepLinkTypes = ["like", "comment", "comment_reply", "favourite", "reachout"];
    let pushUrl = "/home";
    if (isCommissionType) {
      pushUrl = "/commissions";
    } else if (artworkId && artworkDeepLinkTypes.includes(type)) {
      pushUrl = `/card/${artworkId}`;
    }
    await sendPushToUser(
      recipientId,
      {title, body},
      {type: type || "notification", url: pushUrl}
    );
  }
);

/**
 * Trigger: new message in "chats/{chatId}/messages/{messageId}".
 * Sends FCM push to the other participant.
 */
exports.onChatMessageCreated = onDocumentCreated(
  {
    document: "chats/{chatId}/messages/{messageId}",
    region: "us-central1",
    memory: "256MiB",
    maxInstances: 20,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const messageData = snap.data();
    const {senderId, text} = messageData;
    const chatId = event.params.chatId;
    const rawText = typeof text === "string" ? text.trim() : "";
    const hasImage = Boolean(messageData.imageUrl);

    if (!senderId || (!rawText && !hasImage)) {
      logger.warn("Message missing senderId and has no text or image", {chatId});
      return;
    }

    const chatDoc = await db.collection("chats").doc(chatId).get();
    if (!chatDoc.exists) {
      logger.warn("Chat document not found", {chatId});
      return;
    }

    const chatData = chatDoc.data();
    const participants = chatData.participants || [];
    const recipientId = participants.find((p) => p !== senderId);

    if (!recipientId) {
      logger.warn("Could not determine message recipient", {chatId, senderId});
      return;
    }

    let senderName = "Someone";
    try {
      const senderDoc = await db.collection("users").doc(senderId).get();
      if (senderDoc.exists) {
        senderName = senderDoc.data().name || "Someone";
      }
    } catch (err) {
      logger.warn("Could not fetch sender name", {senderId});
    }

    const bodyText = rawText || (hasImage ? "📷 Photo" : "New message");
    const truncatedText =
      bodyText.length > 100 ? bodyText.substring(0, 100) + "..." : bodyText;

    await sendPushToUser(
      recipientId,
      {title: senderName, body: truncatedText},
      {type: "chat", chatId, url: "/home"},
      `chat_${chatId}`
    );
  }
);

/**
 * Trigger: new message in "commissionChats/{chatId}/messages/{messageId}".
 * Same FCM behavior as pair chats (title = sender name, body = message preview).
 */
exports.onCommissionChatMessageCreated = onDocumentCreated(
  {
    document: "commissionChats/{chatId}/messages/{messageId}",
    region: "us-central1",
    memory: "256MiB",
    maxInstances: 20,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const messageData = snap.data();
    const {senderId, text} = messageData;
    const chatId = event.params.chatId;
    const rawText = typeof text === "string" ? text.trim() : "";
    const hasImage = Boolean(messageData.imageUrl);

    if (!senderId || (!rawText && !hasImage)) {
      logger.warn("Commission message missing senderId and has no text or image", {chatId});
      return;
    }

    const chatDoc = await db.collection("commissionChats").doc(chatId).get();
    if (!chatDoc.exists) {
      logger.warn("Commission chat document not found", {chatId});
      return;
    }

    const chatData = chatDoc.data();
    const participants = chatData.participants || [];
    const recipientId = participants.find((p) => p !== senderId);

    if (!recipientId) {
      logger.warn("Could not determine commission message recipient", {chatId, senderId});
      return;
    }

    let senderName = "Someone";
    try {
      const senderDoc = await db.collection("users").doc(senderId).get();
      if (senderDoc.exists) {
        senderName = senderDoc.data().name || "Someone";
      }
    } catch (err) {
      logger.warn("Could not fetch sender name", {senderId});
    }

    const bodyText = rawText || (hasImage ? "📷 Photo" : "New message");
    const truncatedText =
      bodyText.length > 100 ? bodyText.substring(0, 100) + "..." : bodyText;

    await sendPushToUser(
      recipientId,
      {title: senderName, body: truncatedText},
      {type: "chat", chatId, url: "/home"},
      `chat_${chatId}`
    );
  }
);

// ---------------------------------------------------------------------------
// Artwork Ranking Score
// ---------------------------------------------------------------------------

/**
 * Calculate ranking score for an artwork.
 * Mirrors the client-side logic in src/utils/score.ts.
 */
function calculateScore(artwork, artistTotalArtworks) {
  const createdAt = artwork.createdAt;
  let millis = Date.now();
  if (createdAt && typeof createdAt.toMillis === "function") {
    millis = createdAt.toMillis();
  } else if (createdAt && typeof createdAt.toDate === "function") {
    millis = createdAt.toDate().getTime();
  } else if (createdAt instanceof Date) {
    millis = createdAt.getTime();
  } else if (typeof createdAt === "number") {
    millis = createdAt;
  }

  const hours = (Date.now() - millis) / (1000 * 60 * 60);
  const recencyScore = Math.exp(-hours / 24);

  const rawEngagement =
    1 * (artwork.views || 0) +
    5 * (artwork.favorites || 0) +
    3 * (artwork.likes || 0) +
    6 * (artwork.comments || 0) +
    10 * (artwork.reachOutClicks || 0);
  const engagementScore = Math.min(Math.log(1 + rawEngagement), 3);

  const newArtistBoost =
    artistTotalArtworks != null && artistTotalArtworks < 5 ? 1 : 0;
  const randomBoost = Math.random();

  const score =
    0.4 * recencyScore +
    0.2 * engagementScore +
    0.1 * newArtistBoost +
    0.1 * randomBoost;

  return parseFloat(score.toFixed(6));
}

/**
 * Trigger: artwork document written (create or update).
 * Re-computes the ranking score whenever engagement or publish metadata changes.
 */
exports.onArtworkWritten = onDocumentWritten(
  {
    document: "artworks/{artworkId}",
    region: "us-central1",
    memory: "256MiB",
    maxInstances: 20,
  },
  async (event) => {
    const after = event.data?.after;
    if (!after || !after.exists) return; // deleted

    const data = after.data();
    const before = event.data?.before;
    const beforeData = before?.exists ? before.data() : null;

    // Skip if only the score field changed (avoid infinite loop)
    if (beforeData) {
      const fieldsToWatch = [
        "views", "favorites", "likes", "comments", "reachOutClicks", "published", "createdAt",
      ];
      const changed = fieldsToWatch.some(
        (f) => JSON.stringify(beforeData[f]) !== JSON.stringify(data[f])
      );
      // If it's an update and none of the watched fields changed, skip
      if (!changed && beforeData.score !== undefined) return;
    }

    try {
      const artistId = data.artistId;
      let artistTotalArtworks = 0;

      if (artistId) {
        const countSnap = await db
          .collection("artworks")
          .where("artistId", "==", artistId)
          .where("published", "==", true)
          .count()
          .get();
        artistTotalArtworks = countSnap.data().count || 0;
      }

      const score = calculateScore(data, artistTotalArtworks);
      await after.ref.update({score});

      logger.info("Artwork score updated", {
        artworkId: event.params.artworkId,
        score,
      });
    } catch (err) {
      logger.error("Failed to update artwork score", {
        artworkId: event.params.artworkId,
        error: err.message,
      });
    }
  }
);

/**
 * Scheduled function: recompute scores every 6 hours to account for
 * recency decay on artworks that haven't had engagement changes.
 */
exports.recomputeArtworkScores = onSchedule(
  {
    schedule: "every 6 hours",
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 300,
    maxInstances: 1,
  },
  async () => {
    const batchSize = 500;
    let lastDoc = null;
    let totalUpdated = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let q = db
        .collection("artworks")
        .where("published", "==", true)
        .orderBy("createdAt", "desc")
        .limit(batchSize);

      if (lastDoc) {
        q = q.startAfter(lastDoc);
      }

      const snapshot = await q.get();
      if (snapshot.empty) break;

      const artistCountCache = {};

      const writeBatch = db.batch();
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const artistId = data.artistId;

        if (!(artistId in artistCountCache)) {
          const countSnap = await db
            .collection("artworks")
            .where("artistId", "==", artistId)
            .where("published", "==", true)
            .count()
            .get();
          artistCountCache[artistId] = countSnap.data().count || 0;
        }

        const score = calculateScore(data, artistCountCache[artistId]);
        writeBatch.update(docSnap.ref, {score});
        totalUpdated++;
      }

      await writeBatch.commit();
      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      if (snapshot.docs.length < batchSize) break;
    }

    logger.info("Batch score recompute complete", {totalUpdated});
  }
);

/**
 * artworkOgRenderer — serves dynamic Open Graph meta tags for artwork share links.
 *
 * Share URL pattern: /og/:artworkId
 * - Social media crawlers (WhatsApp, Telegram, Twitter, etc.) get an HTML page with
 *   og:image set to the actual painting, so the painting shows as the link preview.
 * - Regular browsers receive a 301 redirect straight to /card/:artworkId (the SPA page).
 *
 * firebase.json must have a rewrite: { source: "/og/**", function: "artworkOgRenderer" }
 */
exports.artworkOgRenderer = onRequest(
  {
    invoker: "public",
    cors: false,
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (req, res) => {
    // Path is /og/:artworkId — extract the last segment
    const pathParts = req.path.split("/").filter(Boolean);
    const artworkId = pathParts[pathParts.length - 1];

    if (!artworkId) {
      res.redirect(302, "/");
      return;
    }

    const userAgent = req.headers["user-agent"] || "";
    // Detect link-preview scrapers. WhatsApp's bot UA contains "WhatsApp/2." (not
    // the in-app browser, which uses a plain Chrome/Safari UA). Telegram's bot is
    // "TelegramBot". Facebook/Instagram Messenger uses "facebookexternalhit".
    const isCrawler = /WhatsApp\/\d|facebookexternalhit|twitterbot|TelegramBot|linkedinbot|slackbot|discordbot|googlebot|bingbot|applebot|pinterestbot|vkshare/i.test(userAgent);

    if (!isCrawler) {
      // Regular browsers: send them straight to the SPA artwork page
      res.redirect(301, `/card/${artworkId}`);
      return;
    }

    try {
      const artworkDoc = await db.collection("artworks").doc(artworkId).get();

      if (!artworkDoc.exists) {
        res.redirect(302, "/");
        return;
      }

      const artwork = artworkDoc.data();
      const title = artwork.title || "Artwork on Kalarang";
      const rawDesc = artwork.description || "";
      const shortDesc = rawDesc.length > 160
        ? rawDesc.substring(0, 157) + "..."
        : rawDesc;
      const description = shortDesc
        ? `${shortDesc} — by ${artwork.artistName || "Artist"} on Kalarang`
        : `by ${artwork.artistName || "Artist"} on Kalarang`;
      const imageUrl = (artwork.images && artwork.images[0]) || "https://kalarang-eff3c.web.app/logo1.png";
      const canonicalUrl = `https://kalarang.art/card/${artworkId}`;

      // Basic HTML-escaping to prevent injection in meta attributes
      const esc = (s) => String(s)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)} | Kalarang</title>
  <meta name="description" content="${esc(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${esc(canonicalUrl)}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:image" content="${esc(imageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="Kalarang" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(imageUrl)}" />
  <!-- Fallback redirect for any browser that lands here -->
  <meta http-equiv="refresh" content="0; url=${esc(canonicalUrl)}" />
  <script>window.location.replace("${esc(canonicalUrl)}");</script>
</head>
<body>
  <p><a href="${esc(canonicalUrl)}">${esc(title)}</a> by ${esc(artwork.artistName || "Artist")} on Kalarang</p>
</body>
</html>`);
    } catch (error) {
      logger.error("artworkOgRenderer error", {error, artworkId});
      res.redirect(302, "/");
    }
  }
);
