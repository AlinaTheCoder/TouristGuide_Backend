// controllers/AuthenticatorController.js
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
    default:
      return `Error: ${code}`;
  }
}

// Signup Function
async function Signup(req, res) {
  const { email, password, FullName } = req.body;

  // Input Validation
  if (!email || !password || !FullName) {
    return res.status(400).send({ error: 'Email, password, and full name are required.' });
  }

  try {
    // Create a new user in Firebase Authentication
    const userRecord = await admin.auth().createUser({ email, password });

    // Initialize an empty profile in the database
    const userRef = db.ref(`users/${userRecord.uid}`);
    await userRef.set({
      email: userRecord.email,
      name: FullName,
      type: 0, // default user type
      loginWithGoogle: '0', // simple email login
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
    // Changed from console.error to logger.error
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
    const userEmail = userCredential.user.email;
    const loginWithGoogle = 0;

    // Return the token and user details
    res.status(200).send({
      message: 'Login successful!',
      token,
      uid,
      email: userEmail,
      loginWithGoogle,
    });
  } catch (error) {
    // Changed from console.error to logger.error
    logger.error(`Error during login: ${error}`);
    const errorCode = error.code || 'unknown';
    const errorMessage = mapFirebaseError(errorCode, 'login');
    res.status(400).send({ error: errorMessage });
  }
}

// Controller function to handle Login with Google
const LoginWithGoogle = async (req, res) => {
  const { uid, email, name, type, loginWithGoogle } = req.body;

  // Validate required fields
  if (!uid || !email || !name) {
    return res.status(400).send({ error: 'UID, email, and name are required.' });
  }

  try {
    // Reference to the user in the database
    const userRef = admin.database().ref(`/users/${uid}`);
    const snapshot = await userRef.once('value');

    // Check if user already exists
    if (snapshot.exists()) {
      // Changed from console.log to logger.debug
      logger.debug('User already exists in the database.');
      return res.status(200).send({ message: 'User already exists.' });
    }

    // Save user data
    await userRef.set({
      email,
      name,
      type: type || 0,
      loginWithGoogle: loginWithGoogle || 1,
    });

    // Changed from console.log to logger.info (success)
    logger.info('User saved successfully!');
    return res.status(200).send({ message: 'User saved successfully!' });
  } catch (error) {
    // Changed from console.error to logger.error
    logger.error(`Error saving user data: ${error.message}`);
    return res.status(500).send({ error: 'Failed to save user data.' });
  }
};

module.exports = { Signup, Login, LoginWithGoogle };
