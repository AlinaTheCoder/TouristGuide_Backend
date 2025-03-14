// controllers/AdminAuthController.js
const { db, admin, auth, signInWithEmailAndPassword } = require('../config/db');
const logger = require('../middleware/logger'); 
// Map Firebase Admin SDK Errors to User-Friendly Messages
function mapFirebaseAdminError(code) {
  switch (code) {
    case 'auth/email-already-exists':
      return 'Email already exists. Please use a different email.';
    case 'auth/invalid-email':
      return 'The email address is invalid.';
    case 'auth/weak-password':
      return 'The password is too weak. Please use a stronger password.';
    default:
      return `Signup failed with error: ${code}`;
  }
}

// Map Firebase Authentication Errors to User-Friendly Messages
function mapFirebaseError(code, type) {
  switch (type) {
    case 'signup':
      switch (code) {
        case 'auth/invalid-email':
          return 'The email address is not valid.';
        case 'auth/user-disabled':
          return 'The user account has been disabled.';
        case 'auth/user-not-found':
          return 'No user found with this email.';
        case 'auth/wrong-password':
          return 'The password is incorrect.';
        case 'auth/network-request-failed':
          return 'Network error. Please check your internet connection.';
        default:
          return `Signup failed with error: ${code}`;
      }

    case 'login':
      switch (code) {
        case 'auth/invalid-email':
          return 'The email address is not valid.';
        case 'auth/user-disabled':
          return 'The user account has been disabled.';
        case 'auth/user-not-found':
          return 'No user found with this email.';
        case 'auth/wrong-password':
          return 'The password is incorrect.';
        case 'auth/network-request-failed':
          return 'Network error. Please check your internet connection.';
        default:
          return `Login failed with error: ${code}`;
      }

    case 'logout':
      switch (code) {
        case 'auth/network-request-failed':
          return 'Network error. Please check your internet connection.';
        default:
          return `Logout failed with error: ${code}`;
      }

    default:
      return `Error: ${code}`;
  }
}

// Signup Function
async function Signup(req, res) {
  const { email, password } = req.body;

  // Input Validation
  if (!email || !password) {
    return res.status(400).send({ error: 'Email and password are required.' });
  }

  try {
    // Create a new user in Firebase Authentication
    const userRecord = await admin.auth().createUser({ email, password });

    // Initialize an empty profile in the database
    const userRef = db.ref(`users/${userRecord.uid}`);
    await userRef.set({
      email: userRecord.email,
    });

    // Respond with user details
    res.status(200).send({
      message: 'User created successfully!',
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
      },
    });
  } catch (error) {
    // Replaced console.error with logger.error
    logger.error(`Error creating user: ${error}`);
    const errorCode = error.code || 'unknown';
    const errorMessage = mapFirebaseAdminError(errorCode);
    res.status(400).send({ error: errorMessage });
  }
}

// Login Function
async function Login(req, res) {
  const { email, password } = req.body;

  // Input Validation
  if (!email || !password) {
    return res.status(400).send({ error: 'Email and password are required.' });
  }

  try {
    // Sign in with Firebase Authentication
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    // Extract user details and token
    const token = await userCredential.user.getIdToken();
    const uid = userCredential.user.uid;
    const adminEmail = userCredential.user.email;

    // Return the token and user details
    res.status(200).send({
      message: 'Login successful!',
      token,
      uid,
      email: adminEmail,
    });
  } catch (error) {
    // Replaced console.error with logger.error
    logger.error(`Error during login: ${error}`);
    const errorCode = error.code || 'unknown';
    const errorMessage = mapFirebaseError(errorCode, 'login');
    res.status(400).send({ error: errorMessage });
  }
}

// Logout Function
async function Logout(req, res) {
  try {
    // Call Firebase's signOut method to log the user out
    await auth.signOut();

    // Respond with a success message
    res.status(200).send({
      message: 'Admin logged out successfully!',
    });
  } catch (error) {
    // Replaced console.error with logger.error
    logger.error(`Error during logout: ${error}`);
    const errorCode = error.code || 'unknown';
    const errorMessage = mapFirebaseError(errorCode, 'logout');
    res.status(400).send({ error: errorMessage });
  }
}

module.exports = { Signup, Login, Logout };
