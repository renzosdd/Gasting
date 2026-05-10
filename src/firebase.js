import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBxgQGglLp2hES896xJ4x4sWqym65crsGU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "registo-gastos.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "registo-gastos",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "registo-gastos.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "320523084500",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:320523084500:web:a4fac5c303d9b298fd5141",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-LJ9P86TXP4"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);

export const loginConGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);
