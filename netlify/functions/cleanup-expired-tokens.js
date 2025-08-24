const admin = require('firebase-admin');

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

exports.handler = async (event, context) => {
  try {
    console.log('Starting cleanup of expired tokens...');
    
    const now = new Date();
    let deletedCount = 0;
    
    // Query for expired tokens
    const expiredTokensQuery = await db.collection('auth_tokens')
      .where('expiresAt', '<', now)
      .get();
    
    // Delete expired tokens in batches
    const batch = db.batch();
    
    expiredTokensQuery.forEach((doc) => {
      batch.delete(doc.ref);
      deletedCount++;
    });
    
    if (deletedCount > 0) {
      await batch.commit();
      console.log(`Deleted ${deletedCount} expired tokens`);
    } else {
      console.log('No expired tokens found');
    }
    
    // Also clean up used tokens older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const usedTokensQuery = await db.collection('auth_tokens')
      .where('used', '==', true)
      .where('usedAt', '<', sevenDaysAgo)
      .get();
    
    const usedBatch = db.batch();
    let usedDeletedCount = 0;
    
    usedTokensQuery.forEach((doc) => {
      usedBatch.delete(doc.ref);
      usedDeletedCount++;
    });
    
    if (usedDeletedCount > 0) {
      await usedBatch.commit();
      console.log(`Deleted ${usedDeletedCount} old used tokens`);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        expired: deletedCount,
        oldUsed: usedDeletedCount,
        total: deletedCount + usedDeletedCount
      })
    };
    
  } catch (error) {
    console.error('Cleanup error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Cleanup failed' })
    };
  }
};