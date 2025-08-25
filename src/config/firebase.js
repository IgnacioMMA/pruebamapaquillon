// src/config/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCLhgnpT7bf6uoVn3PZK4_bp0ybPvk0Iso",
  authDomain: "mapaquillon-bcee3.firebaseapp.com",
  projectId: "mapaquillon-bcee3",
  storageBucket: "mapaquillon-bcee3.firebasestorage.app",
  messagingSenderId: "1032084563199",
  appId: "1:1032084563199:web:676d76135490c109d318ca"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const database = getDatabase(app);
export const storage = getStorage(app);
export { firebaseConfig };
export default app;