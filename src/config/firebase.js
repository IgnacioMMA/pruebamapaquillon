// src/config/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';

// Tu configuración de Firebase (la obtienes de Firebase Console)
// Import the functions you need from the SDKs you need

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDIr4IjP6ci5Ho82RasKogCgxAFImegQSc",
  authDomain: "mapa-quillon.firebaseapp.com",
  projectId: "mapa-quillon",
  storageBucket: "mapa-quillon.firebasestorage.app",
  messagingSenderId: "840837543550",
  appId: "1:840837543550:web:8bd2434ad78f8d62b0ca2f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Exportar servicios
export const auth = getAuth(app);
export const database = getDatabase(app);
export const firestore = getFirestore(app);

export default app;