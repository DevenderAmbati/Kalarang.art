const {MAX_MESSAGES_PER_SESSION, MAX_SESSIONS_PER_IP_PER_DAY, MAX_SESSION_HISTORY} = require("./constants");
const logger = require("firebase-functions/logger");

async function getOrCreateSession(db, sessionId) {
  const ref = db.collection("advisorSessions").doc(sessionId);
  const snap = await ref.get();
  if (snap.exists) return {ref, session: snap.data()};

  const session = {
    messages: [],
    commissionDraft: null,
    discoverContext: {},
    intent: "unknown",
    messageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await ref.set(session);
  return {ref, session};
}

async function checkRateLimits(db, session, clientIp) {
  if ((session.messageCount || 0) >= MAX_MESSAGES_PER_SESSION) {
    return "You've reached the message limit for this session. Please start a new conversation.";
  }

  if (clientIp) {
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

async function incrementMessageCount(db, sessionRef, clientIp) {
  const {FieldValue} = require("firebase-admin/firestore");
  await sessionRef.update({messageCount: FieldValue.increment(1)});

  if (clientIp) {
    const today = new Date().toISOString().slice(0, 10);
    const ipRef = db.collection("advisorRateLimits").doc(`${clientIp}_${today}`);
    await ipRef.set({count: FieldValue.increment(1), date: today}, {merge: true});
  }
}

async function saveSession(sessionRef, updates) {
  let messages = updates.messages || [];
  if (messages.length > MAX_SESSION_HISTORY) {
    messages = messages.slice(-MAX_SESSION_HISTORY);
  }
  await sessionRef.update({
    ...updates,
    messages,
    updatedAt: new Date().toISOString(),
  });
}

module.exports = {getOrCreateSession, checkRateLimits, incrementMessageCount, saveSession};
