const admin = require('firebase-admin');
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

// Use environment variables instead of JSON file
const serviceAccount = {
  type: process.env.FIREBASE_TYPE || "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
  token_uri: process.env.FIREBASE_TOKEN_URI || "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN || "googleapis.com"
};

// Add validation to ensure critical credentials exist
const validateCredentials = () => {
  const requiredVars = [
    'FIREBASE_PROJECT_ID', 
    'FIREBASE_PRIVATE_KEY', 
    'FIREBASE_CLIENT_EMAIL'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error(`Missing required Firebase environment variables: ${missing.join(', ')}`);
    return false;
  }
  return true;
};

// Initialize Firebase Admin SDK
let db, auth;
try {
  if (validateCredentials()) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL || "https://touristguide-f0491-default-rtdb.firebaseio.com/",
    });
    console.log('Firebase Admin SDK initialized successfully');
    
    // Export Admin SDK database
    db = admin.database();
  } else {
    throw new Error('Failed to initialize Firebase Admin SDK due to missing credentials');
  }
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
}

// Firebase Client SDK Configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyD1oiqObn_yLK9wYbtNfyR_rHkb6OlsQPw",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "touristguide-f0491.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "touristguide-f0491",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "touristguide-f0491.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: process.env.FIREBASE_APP_ID || "YOUR_APP_ID",
};

// Initialize Firebase Client SDK
try {
  const firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  console.log('Firebase Client SDK initialized successfully');
} catch (error) {
  console.error('Firebase Client initialization error:', error);
}

module.exports = { db, admin, auth, signInWithEmailAndPassword };