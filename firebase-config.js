import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

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
export const db = getFirestore(app);
