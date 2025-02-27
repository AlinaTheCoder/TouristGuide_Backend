const { db, admin, auth } = require('../config/db');

const GetUserByID = async (req, res) => {
    const { uid } = req.params; // uid from the URL
    try {
        // Fetch data from Firebase Authentication
        const userRecord = await admin.auth().getUser(uid);

        // Fetch additional data from Firebase Realtime Database
        const snapshot = await db.ref(`users/${uid}`).once('value');
        const additionalData = snapshot.val() || {};

        // Merge and respond with the data
        res.status(200).send({
            uid: userRecord.uid,
            email: userRecord.email,
            name: additionalData.name || 'N/A', // Corrected to fetch from Realtime DB
            phoneNumber: additionalData.phoneNumber || 'N/A',
            cnic: additionalData.cnic || 'N/A',
            loginWithGoogle:additionalData.loginWithGoogle
        });
    } catch (error) {
        console.error('Error fetching user data:', error.message);
        res.status(500).send({ error: 'An error occurred while fetching user data.' });
    }
};

const EditName = async (req, res) => {
    const { uid } = req.params;
    const { name } = req.body;

    // Validate input
    if (!uid || !name) {
        return res.status(400).send({ error: 'UID and name are required.' });
    }

    try {
        // Reference the user's record in the database
        const userRef = db.ref(`users/${uid}`);

        // Check if the user exists
        const snapshot = await userRef.once('value');
        if (!snapshot.exists()) {
            return res.status(404).send({ error: 'User not found.' });
        }

        // Update the user's name
        await userRef.update({ name });
        res.status(200).send({ message: 'Name updated successfully!', uid, name });
    } catch (error) {
        console.error('Error updating name:', error.message);
        res.status(500).send({ error: 'An error occurred while updating the name.' });
    }
};

const ChangePassword = async (req, res) => {
    const { uid, newPassword } = req.body;

    // Validate input
    if (!uid || !newPassword) {
        return res.status(400).send({ error: 'UID and new password are required.' });
    }

    try {
        // Update the user's password
        await admin.auth().updateUser(uid, { password: newPassword });

        res.status(200).send({
            message: 'Password changed successfully!',
        });
    } catch (error) {
        console.error('Error changing password:', error.message);

        // Handle specific errors if needed
        if (error.code === 'auth/user-not-found') {
            res.status(404).send({ error: 'User not found.' });
        } else {
            res.status(500).send({ error: 'Failed to change password. Please try again.' });
        }
    }
};

module.exports = { GetUserByID, EditName, ChangePassword };