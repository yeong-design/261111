import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCW_xtfERPorS7IG2M1M6K_7iloEJx1vQM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "test261111.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "test261111",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "test261111.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1029644781047",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1029644781047:web:4984957166f6f237cd9af2",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

