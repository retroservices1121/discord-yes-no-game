const { 
  firestore, 
  FieldValue, 
  Timestamp, 
  generateDocumentId,
  timestampToDate 
} = require('../utils/database');

/**
 * User model for Firebase
 */
class User {
  /**
   * Get Firestore users collection
   * @returns {FirebaseFirestore.CollectionReference} Users collection
   */
  static collection() {
    return firestore().collection('users');
  }
  
  /**
   * Find a user by Discord ID
   * @param {string} userId Discord user ID
   * @returns {Object} User or null if not found
   */
  static async findByDiscordId(userId) {
    try {
      // Query users with matching discord ID
      const snapshot = await this.collection()
        .where('platforms.discord.id', '==', userId)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return null;
      }
      
      const doc = snapshot.docs[0];
      const data = doc.data();
      
      return {
        ...data,
        createdAt: timestampToDate(data.createdAt),
        updatedAt: timestampToDate(data.updatedAt)
      };
    } catch (error) {
      console.error(`Error finding user with Discord ID ${userId}:`, error);
      throw error;
    }
  }
  
  /**
   * Find or create a user by Discord ID
   * @param {string} userId Discord user ID
   * @param {string} username Discord username
   * @returns {Object} User
   */
  static async findOrCreate(userId, username) {
    try {
      // Try to find existing user
      let user = await this.findByDiscordId(userId);
      
      if (user) {
        // Update username if changed
        if (user.platforms?.discord?.username !== username) {
          const docRef = this.collection().doc(user.id);
          await docRef.update({
            'platforms.discord.username': username,
            updatedAt: Timestamp.now()
          });
          
          user = await this.findByDocId(user.id);
        }
        
        return user;
      }
      
      // Create new user
      const docId = generateDocumentId('u_');
      const now = Timestamp.now();
      
      const userData = {
        id: docId,
        xp: 0,
        totalPredictions: 0,
        correctPredictions: 0,
        platforms: {
          discord: {
            id: userId,
            username: username
          }
        },
        createdAt: now,
        updatedAt: now
      };
      
      await this.collection().doc(docId).set(userData);
      
      return {
        ...userData,
        createdAt: timestampToDate(userData.createdAt),
        updatedAt: timestampToDate(userData.updatedAt)
      };
    } catch (error) {
      console.error(`Error finding or creating user with Discord ID ${userId}:`, error);
      throw error;
    }
  }
  
  /**
   * Find a user by document ID
   * @param {string} docId Document ID
   * @returns {Object} User or null if not found
   */
  static async findByDocId(docId) {
    try {
      const docRef = await this.collection().doc(docId).get();
      
      if (!docRef.exists) {
        return null;
      }
      
      const data = docRef.data();
      
      return {
        ...data,
        createdAt: timestampToDate(data.createdAt),
        updatedAt: timestampToDate(data.updatedAt)
      };
    } catch (error) {
      console.error(`Error finding user with document ID ${docId}:`, error);
      throw error;
    }
  }
  
  /**
   * Award XP to a user
   * @param {string} userId Discord user ID
   * @param {number} amount Amount of XP to award
   * @returns {Object} Updated user
   */
  static async awardXP(userId, amount) {
    try {
      const user = await this.findByDiscordId(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const docRef = this.collection().doc(user.id);
      
      await docRef.update({
        xp: FieldValue.increment(amount),
        correctPredictions: FieldValue.increment(1),
        totalPredictions: FieldValue.increment(1),
        updatedAt: Timestamp.now()
      });
      
      return this.findByDocId(user.id);
    } catch (error) {
      console.error(`Error awarding XP to user with Discord ID ${userId}:`, error);
      throw error;
    }
  }
  
  /**
   * Record an incorrect prediction for a user
   * @param {string} userId Discord user ID
   * @returns {Object} Updated user
   */
  static async recordIncorrectPrediction(userId) {
    try {
      const user = await this.findByDiscordId(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const docRef = this.collection().doc(user.id);
      
      await docRef.update({
        totalPredictions: FieldValue.increment(1),
        updatedAt: Timestamp.now()
      });
      
      return this.findByDocId(user.id);
    } catch (error) {
      console.error(`Error recording incorrect prediction for user with Discord ID ${userId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get top users by XP
   * @param {number} limit Maximum number of users to return
   * @returns {Array} List of top users
   */
  static async getTopByXP(limit = 10) {
    try {
      const snapshot = await this.collection()
        .orderBy('xp', 'desc')
        .limit(limit)
        .get();
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          createdAt: timestampToDate(data.createdAt),
          updatedAt: timestampToDate(data.updatedAt)
        };
      });
    } catch (error) {
      console.error(`Error getting top ${limit} users by XP:`, error);
      throw error;
    }
  }
}

module.exports = User;