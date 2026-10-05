import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getMessaging } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyAqfCDGF1dk8ydP_KnJUI2h6locu3LCUDk",
  authDomain: "tesbatagor-rin.firebaseapp.com",
  projectId: "tesbatagor-rin",
  storageBucket: "tesbatagor-rin.firebasestorage.app",
  messagingSenderId: "988973820460",
  appId: "1:988973820460:web:92b62f0697525dd9e8bf89",
  measurementId: "G-DMFV1ZFE5B"
};

const app = initializeApp(firebaseConfig);
export { app };
export const db = getFirestore(app);
export const auth = getAuth(app);
export const messaging = getMessaging(app);

// Replace this with the Web Push certificate key from Firebase Console.
export const FCM_VAPID_KEY = 'REPLACE_WITH_FIREBASE_VAPID_PUBLIC_KEY';
