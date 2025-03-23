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

// Robust email provider checking function
async function CheckEmailProvider(req, res) {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).send({ error: 'Email is required.' });
  }
  
  try {
    logger.info(`Checking email provider for: ${email}`);
    
    // Try multiple methods to identify a Google account
    let isGoogleAccount = false;
    let uid = null;
    
    // Method 1: Check Firebase Auth directly
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      uid = userRecord.uid;
      
      // Check provider data first
      const providerData = userRecord.providerData || [];
      logger.info(`Provider data for ${email}: ${JSON.stringify(providerData)}`);
      
      isGoogleAccount = providerData.some(
        provider => provider.providerId === 'google.com'
      );
      
      logger.info(`Provider check result for ${email}: ${isGoogleAccount}`);
    } catch (authError) {
      logger.warn(`Firebase Auth check failed: ${authError.message}`);
      // Continue to next method if user not found
    }
    
    // Method 2: Check Realtime Database if uid was found
    if (uid && !isGoogleAccount) {
      try {
        const userSnapshot = await db.ref(`users/${uid}`).once('value');
        const userData = userSnapshot.val();
        
        logger.info(`Database data for ${email}: ${JSON.stringify(userData)}`);
        
        if (userData) {
          isGoogleAccount = userData.loginWithGoogle === '1' || 
                           userData.loginWithGoogle === 1;
          
          logger.info(`Database check result for ${email}: ${isGoogleAccount}`);
        }
      } catch (dbError) {
        logger.warn(`Database check failed: ${dbError.message}`);
      }
    }
    
    // Method 3: Check all users in the database as fallback
    if (!isGoogleAccount) {
      try {
        // Get a reference to all users
        const usersRef = db.ref('users');
        const snapshot = await usersRef.once('value');
        const allUsers = snapshot.val() || {};
        
        // Find user with matching email
        for (const userId in allUsers) {
          const user = allUsers[userId];
          if (user.email === email) {
            isGoogleAccount = user.loginWithGoogle === '1' || 
                             user.loginWithGoogle === 1;
            
            logger.info(`Full database scan result for ${email}: ${isGoogleAccount}`);
            break;
          }
        }
      } catch (fullScanError) {
        logger.warn(`Full database scan failed: ${fullScanError.message}`);
      }
    }
    
    logger.info(`Final determination for ${email}: isGoogleAccount = ${isGoogleAccount}`);
    return res.status(200).send({ isGoogleAccount });
    
  } catch (error) {
    logger.error(`CheckEmailProvider error: ${error.message}`);
    // Don't fail the request - return false but log the error
    return res.status(200).send({ isGoogleAccount: false, error: error.message });
  }
}

module.exports = { Signup, Login, LoginWithGoogle, CheckEmailProvider };
