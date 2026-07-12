const {MAX_MESSAGES_PER_SESSION, MAX_SESSIONS_PER_IP_PER_DAY, MAX_STORED_MESSAGES} = require("./constants");

async function getOrCreateSession(db, sessionId) {
  const ref = db.collection("advisorSessions").doc(sessionId);
  const snap = await ref.get();
  if (snap.exists) return {ref, session: snap.data(), isNew: false};

  const session = {
    messages: [],
    commissionDraft: null,
    discoveryProfile: {},
    discoverContext: {},
    intent: "unknown",
    messageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await ref.set(session);
  return {ref, session, isNew: true};
}

async function getSessionIfExists(db, sessionId) {
  const snap = await db.collection("advisorSessions").doc(sessionId).get();
  return snap.exists ? snap.data() : null;
}

async function checkRateLimits(db, session, clientIp, isNew) {
  if ((session.messageCount || 0) >= MAX_MESSAGES_PER_SESSION) {
    return "You've reached the message limit for this session. Please start a new conversation.";
  }

  // Only NEW conversations count against the per-IP daily limit; an ongoing
  // session can keep going (bounded by the per-session message cap above), so
  // real users are never cut off mid-conversation.
  if (isNew && clientIp) {
    const today = new Date().toISOString().slice(0, 10);
    const ipRef = db.collection("advisorRateLimits").doc(`${clientIp}_${today}`);
    const ipSnap = await ipRef.get();
    const ipData = ipSnap.exists ? ipSnap.data() : {count: 0};
    if (ipData.count >= MAX_SESSIONS_PER_IP_PER_DAY) {
      return "Daily limit reached. Please try again tomorrow.";
    }
  }
  return null;
}

// Increment the per-IP daily SESSION counter. Call once, when a new session
// starts and has passed the rate-limit check.
async function recordNewSession(db, clientIp) {
  if (!clientIp) return;
  const {FieldValue} = require("firebase-admin/firestore");
  const today = new Date().toISOString().slice(0, 10);
  const ipRef = db.collection("advisorRateLimits").doc(`${clientIp}_${today}`);
  await ipRef.set({count: FieldValue.increment(1), date: today}, {merge: true});
}

async function incrementMessageCount(db, sessionRef) {
  const {FieldValue} = require("firebase-admin/firestore");
  await sessionRef.update({messageCount: FieldValue.increment(1)});
}

async function saveSession(sessionRef, updates) {
  let messages = updates.messages || [];
  if (messages.length > MAX_STORED_MESSAGES) {
    messages = messages.slice(-MAX_STORED_MESSAGES);
  }
  await sessionRef.update({
    ...updates,
    messages,
    updatedAt: new Date().toISOString(),
  });
}

module.exports = {
  getOrCreateSession,
  getSessionIfExists,
  checkRateLimits,
  recordNewSession,
  incrementMessageCount,
  saveSession,
};
