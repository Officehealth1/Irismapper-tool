const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
    });
}

const db = admin.firestore();

exports.handler = async (event) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { action, userId, adminUid, days, accessType, reason } = JSON.parse(event.body);

        // Validate required fields
        if (!action || !userId || !adminUid) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }

        // Verify admin permissions
        const adminDoc = await db.collection('users').doc(adminUid).get();
        if (!adminDoc.exists) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'Admin user not found' })
            };
        }

        const adminData = adminDoc.data();
        if (adminData.role !== 'admin' && adminData.isAdmin !== true) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'Insufficient permissions' })
            };
        }

        // Get user document
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'User not found' })
            };
        }

        const userData = userDoc.data();
        const currentTime = admin.firestore.FieldValue.serverTimestamp();

        // Log admin action
        const adminAction = {
            action: action,
            adminUid: adminUid,
            adminEmail: adminData.email || 'team@irislab.com',
            timestamp: currentTime,
            userEmail: userData.email,
            previousStatus: userData.subscriptionStatus,
            previousPlan: userData.subscriptionTier
        };

        let updateData = {};
        let actionMessage = '';

        switch (action) {
            case 'extend_trial':
                if (!days || days < 1 || days > 365) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: 'Invalid trial days (1-365)' })
                    };
                }

                // Calculate new trial end date
                const currentTrialEnd = userData.trialEndDate || new Date();
                const newTrialEnd = new Date(currentTrialEnd);
                newTrialEnd.setDate(newTrialEnd.getDate() + parseInt(days));

                updateData = {
                    subscriptionStatus: 'trialing',
                    trialEndDate: admin.firestore.Timestamp.fromDate(newTrialEnd),
                    lastModified: currentTime,
                    lastModifiedBy: adminUid
                };

                adminAction.days = parseInt(days);
                adminAction.newTrialEnd = newTrialEnd.toISOString();
                actionMessage = `Trial extended by ${days} days until ${newTrialEnd.toLocaleDateString()}`;
                break;

            case 'grant_free_access':
                if (!accessType) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: 'Access type required' })
                    };
                }

                let freeAccessEnd = null;
                if (accessType === '90days') {
                    freeAccessEnd = new Date();
                    freeAccessEnd.setDate(freeAccessEnd.getDate() + 90);
                } else if (accessType === '30days') {
                    freeAccessEnd = new Date();
                    freeAccessEnd.setDate(freeAccessEnd.getDate() + 30);
                }

                updateData = {
                    subscriptionStatus: 'active',
                    subscriptionTier: 'free',
                    freeAccessGranted: true,
                    freeAccessType: accessType,
                    lastModified: currentTime,
                    lastModifiedBy: adminUid
                };

                if (freeAccessEnd) {
                    updateData.freeAccessEndDate = admin.firestore.Timestamp.fromDate(freeAccessEnd);
                }

                adminAction.accessType = accessType;
                adminAction.freeAccessEnd = freeAccessEnd ? freeAccessEnd.toISOString() : 'permanent';
                actionMessage = `Free access granted: ${accessType}`;
                break;

            case 'cancel_subscription':
                if (!reason || reason.trim().length < 3) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: 'Cancellation reason required (min 3 characters)' })
                    };
                }

                updateData = {
                    subscriptionStatus: 'canceled',
                    subscriptionTier: 'none',
                    cancellationReason: reason.trim(),
                    cancellationDate: currentTime,
                    lastModified: currentTime,
                    lastModifiedBy: adminUid
                };

                adminAction.reason = reason.trim();
                actionMessage = `Subscription cancelled: ${reason.trim()}`;
                break;

            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid action' })
                };
        }

        // Update user document
        await db.collection('users').doc(userId).update(updateData);

        // Log admin action
        adminAction.newStatus = updateData.subscriptionStatus;
        adminAction.newPlan = updateData.subscriptionTier;
        adminAction.message = actionMessage;

        await db.collection('admin_actions').add(adminAction);

        // Add to user's activity log
        const userActivityLog = {
            type: 'admin_action',
            action: action,
            adminEmail: adminData.email || 'team@irislab.com',
            message: actionMessage,
            timestamp: currentTime
        };

        await db.collection('users').doc(userId).collection('activity_log').add(userActivityLog);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: actionMessage,
                action: action,
                userEmail: userData.email
            })
        };

    } catch (error) {
        console.error('Error in admin-manage-subscription:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                details: error.message
            })
        };
    }
};
