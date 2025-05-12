const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Path to service account key file
const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');

/**
 * Connect to Firebase database
 * @returns {FirebaseFirestore.Firestore} Firestore database instance
 */
async function connectDatabase() {
  try {
    // Check if service account file exists
    if (!fs.existsSync(serviceAccountPath)) {
      console.error('Firebase service account key file not found!');
      console.error('Please place your serviceAccountKey.json file in the root directory.');
      process.exit(1);
    }
    
    // Initialize Firebase if not already initialized
    if (!admin.apps.length) {
      const serviceAccount = require(serviceAccountPath);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
      });
      
      console.log('Connected to Firebase');
    }
    
    return admin.firestore();
  } catch (error) {
    console.error('Firebase connection error:', error);
    process.exit(1);
  }
}

/**
 * Generate a unique ID for documents
 * @param {string} prefix Prefix for the ID
 * @returns {string} Unique ID
 */
function generateDocumentId(prefix = '') {
  const timestamp = new Date().getTime();
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `${prefix}${timestamp}_${randomStr}`;
}

/**
 * Format Firestore timestamp to Date object
 * @param {FirebaseFirestore.Timestamp} timestamp Firestore timestamp
 * @returns {Date} JavaScript Date object
 */
function timestampToDate(timestamp) {
  if (!timestamp) return null;
  return timestamp.toDate();
}

/**
 * Convert Date object to Firestore timestamp
 * @param {Date} date JavaScript Date object
 * @returns {FirebaseFirestore.Timestamp} Firestore timestamp
 */
function dateToTimestamp(date) {
  if (!date) return null;
  return admin.firestore.Timestamp.fromDate(date);
}

module.exports = {
  connectDatabase,
  firestore: () => admin.firestore(),
  FieldValue: admin.firestore.FieldValue,
  Timestamp: admin.firestore.Timestamp,
  generateDocumentId,
  timestampToDate,
  dateToTimestamp
};