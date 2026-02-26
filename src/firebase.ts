import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyAv7RrDWmGLuefKpduSC3-GutFXxlUFlUQ",
  authDomain: "kalarang-eff3c.firebaseapp.com",
  projectId: "kalarang-eff3c",
  storageBucket: "kalarang-eff3c.firebasestorage.app",
  messagingSenderId: "88807694030",
  appId: "1:88807694030:web:c028be9e00bcf4687e3a9f",
  measurementId: "G-DMZMEH5EGY"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');
