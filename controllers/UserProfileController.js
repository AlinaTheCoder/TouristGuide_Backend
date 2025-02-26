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
            loginWithGoogle: additionalData.loginWithGoogle
        });
    } catch (error) {
        console.error('Error fetching user data:', error.message);
        res.status(500).send({ error: 'An error occurred while fetching user data.' });
    }
};

const GetHostPersonalInfo = async (req, res) => {
    const { uid } = req.params;

    try {
        // 1) Get user from Firebase Auth
        const userRecord = await admin.auth().getUser(uid);

        // 2) Get additional user data from Realtime DB
        const userSnapshot = await db.ref(`users/${uid}`).once('value');
        const userData = userSnapshot.val() || {};

        // 3) Fetch the host's LAST LISTED activity
        //    (Assumes you store host's UID in each activity under a field like "hostUid". 
        //     If you use a different field name for the host's UID, adjust accordingly!)

        const activitiesRef = db.ref('activities');
        const activitiesSnapshot = await activitiesRef
            .orderByChild('hostId')
            .equalTo(uid)
            .once('value');

        let phoneNumber = null;
        let cnic = null;

        if (activitiesSnapshot.exists()) {
            // Convert the returned object to an array
            const activitiesObj = activitiesSnapshot.val();
            const activitiesArray = Object.values(activitiesObj);

            // Sort by createdAt (descending), so index 0 is the most recent
            activitiesArray.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            // The "last listed" (most recently created) activity
            const lastActivity = activitiesArray[0];

            if (lastActivity) {
                phoneNumber = lastActivity.phoneNumber || null;
                cnic = lastActivity.cnic || null;
            }
        }

        // 4) Return the combined data
        res.status(200).send({
            uid: userRecord.uid,
            email: userRecord.email,
            name: userData.name || 'N/A',
            loginWithGoogle: userData.loginWithGoogle,
            phoneNumber,
            cnic,
        });
    } catch (error) {
        console.error('Error fetching host personal info:', error.message);
        res.status(500).send({ error: 'An error occurred while fetching host personal info.' });
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
        // 1) Update the user's name in "users/<uid>"
        const userRef = db.ref(`users/${uid}`);
        const snapshot = await userRef.once('value');
        if (!snapshot.exists()) {
            return res.status(404).send({ error: 'User not found.' });
        }
        await userRef.update({ name });

        // 2) Update all activities in "activities" where hostId == uid, but ONLY if they exist
        const activitiesRef = db.ref('activities');
        const activitiesSnapshot = await activitiesRef
            .orderByChild('hostId')
            .equalTo(uid)
            .once('value');

        if (activitiesSnapshot.exists()) {
            const activitiesData = activitiesSnapshot.val();

            // Build a multi-path update for all matching activities
            const updates = {};
            Object.keys(activitiesData).forEach((activityKey) => {
                // Since you want to update the "hostName" field:
                updates[`${activityKey}/hostName`] = name;
            });

            // Apply all updates in one go
            await activitiesRef.update(updates);
        }

        return res.status(200).send({ message: 'Name updated successfully!', uid, name });
    } catch (error) {
        console.error('Error updating name:', error.message);
        return res.status(500).send({ error: 'An error occurred while updating the name.' });
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

module.exports = { GetUserByID, GetHostPersonalInfo, EditName, ChangePassword };