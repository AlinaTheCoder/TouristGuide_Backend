const { db } = require('../config/db');

exports.getAllListedActivitiesByHostId = async (req, res) => {
    try {
        const { hostId } = req.params; // Getting hostId from request parameters

        if (!hostId) {
            console.error('[ERROR] Missing hostId in request');
            return res.status(400).json({
                success: false,
                message: 'Host ID is required.',
            });
        }

        console.log(`[DEBUG] Fetching activities for hostId: ${hostId}`);

        const activitiesRef = db.ref('activities');

        // Query activities based on the provided hostId
        const snapshot = await activitiesRef
            .orderByChild('hostId')
            .equalTo(hostId)
            .once('value');

        // Check if activities exist for this host
        const hasListedActivities = snapshot.exists();
        const listedActivities = [];

        if (hasListedActivities) {
            snapshot.forEach((childSnapshot) => {
                const activityData = childSnapshot.val();

                // **Filter out activities where listingStatus is "Deactivate"**
                if (activityData.listingStatus === "Deactivate") {
                    console.log(`[DEBUG] Skipping Deactivated Activity: ${childSnapshot.key}`);
                    return; // Skip this iteration
                }

                console.log('[DEBUG] Activity Details:', {
                    id: childSnapshot.key,
                    images: activityData.activityImages || [],
                    status: activityData.status,
                    createdAt: activityData.createdAt,
                    address: activityData.address || 'No address provided',
                    city: activityData.city,
                    listingStatus: activityData.listingStatus, // Debugging
                });

                listedActivities.push({
                    id: childSnapshot.key,
                    images: activityData.activityImages || [],
                    status: activityData.status,
                    createdAt: activityData.createdAt,
                    address: activityData.address || 'No address provided',
                    city: activityData.city,
                });
            });
        }

        console.log('[DEBUG] Listed Activities Summary:', {
            hasListedActivities,
            totalListedActivities: listedActivities.length,
        });

        return res.status(200).json({
            success: true,
            hasListedActivities,
            activitiesCount: listedActivities.length,
            data: listedActivities,
        });
    } catch (error) {
        console.error('[AdminController] Error fetching listed activities:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error.',
            error: error.message,
        });
    }
};
