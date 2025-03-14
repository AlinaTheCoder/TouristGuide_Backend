// config/db.js
const admin = require('firebase-admin');
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
require('dotenv').config();

// Parse the service account JSON from environment variable
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // read the URL from an env variable as well (optional):
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

// Firebase Client SDK Configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// Initialize Firebase Client SDK
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

// Export both Admin and Client SDK
const db = admin.database();
module.exports = { db, admin, auth, signInWithEmailAndPassword };
