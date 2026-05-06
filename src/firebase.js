import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBxgQGglLp2hES896xJ4x4sWqym65crsGU",
  authDomain: "registo-gastos.firebaseapp.com",
  projectId: "registo-gastos",
  storageBucket: "registo-gastos.firebasestorage.app",
  messagingSenderId: "320523084500",
  appId: "1:320523084500:web:a4fac5c303d9b298fd5141",
  measurementId: "G-LJ9P86TXP4"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const analytics = getAnalytics(app);

// ESTAS SON LAS FUNCIONES QUE FALTABAN:
export const loginConGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);