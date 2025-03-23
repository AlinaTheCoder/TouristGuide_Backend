const admin = require('firebase-admin');
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const serviceAccount = require('./touristguide-f0491-firebase-adminsdk-rmphz-2cd6112ea5.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://touristguide-f0491-default-rtdb.firebaseio.com/",
});

// Firebase Client SDK Configuration
const firebaseConfig = {
    apiKey: "AIzaSyD1oiqObn_yLK9wYbtNfyR_rHkb6OlsQPw",
    authDomain: "touristguide-f0491.firebaseapp.com", // Firebase Auth Domain
    projectId: "touristguide-f0491",
    storageBucket: "touristguide-f0491.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID",
};

// Initialize Firebase Client SDK
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

// Export both Admin and Client SDK
const db = admin.database();
module.exports = { db, admin, auth, signInWithEmailAndPassword };