const { 
  firestore, 
  FieldValue, 
  Timestamp, 
  generateDocumentId,
  timestampToDate,
  dateToTimestamp 
} = require('../utils/database');

/**
 * Question model for Firebase
 */
class Question {
  /**
   * Get Firestore questions collection
   * @returns {FirebaseFirestore.CollectionReference} Questions collection
   */
  static collection() {
    return firestore().collection('questions');
  }
  
  /**
   * Create a new question
   * @param {Object} data Question data
   * @returns {Object} Created question
   */
  static async create(data) {
    try {
      // Generate a document ID with 'q_' prefix for questions
      const docId = generateDocumentId('q_');
      
      // Prepare question data with Firestore timestamps
      const questionData = {
        id: docId,
        text: data.text,
        createdBy: data.createdBy,
        createdAt: Timestamp.now(),
        endTime: dateToTimestamp(data.endTime),
        messageId: data.messageId || 'placeholder',
        yesVotes: [],
        noVotes: [],
        resolved: false,
        outcome: null,
        resolvedBy: null,
        resolvedAt: null,
        platform: 'discord' // Identify platform for cross-platform integration
      };
      
      // Store the document with the generated ID
      await this.collection().doc(docId).set(questionData);
      
      // Convert Firestore timestamps back to Date objects before returning
      return {
        ...questionData,
        createdAt: timestampToDate(questionData.createdAt),
        endTime: timestampToDate(questionData.endTime)
      };
    } catch (error) {
      console.error('Error creating question:', error);
      throw error;
    }
  }
  
  /**
   * Find a question by ID
   * @param {string} id Question ID
   * @returns {Object} Question or null if not found
   */
  static async findById(id) {
    try {
      const docRef = await this.collection().doc(id).get();
      
      if (!docRef.exists) {
        return null;
      }
      
      const data = docRef.data();
      
      // Convert Firestore timestamps to Date objects
      return {
        ...data,
        createdAt: timestampToDate(data.createdAt),
        endTime: timestampToDate(data.endTime),
        resolvedAt: timestampToDate(data.resolvedAt)
      };
    } catch (error) {
      console.error(`Error finding question ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Update a question's message ID
   * @param {string} id Question ID
   * @param {string} messageId Discord message ID
   * @returns {Object} Updated question
   */
  static async updateMessageId(id, messageId) {
    try {
      await this.collection().doc(id).update({ messageId });
      return this.findById(id);
    } catch (error) {
      console.error(`Error updating message ID for question ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Add a yes vote to a question
   * @param {string} id Question ID
   * @param {string} userId User ID
   * @returns {Object} Updated question
   */
  static async addYesVote(id, userId) {
    try {
      const questionRef = this.collection().doc(id);
      const question = await this.findById(id);
      
      if (!question) {
        throw new Error('Question not found');
      }
      
      // Remove from no votes if present
      if (question.noVotes.includes(userId)) {
        await questionRef.update({
          noVotes: FieldValue.arrayRemove(userId)
        });
      }
      
      // Add to yes votes if not already present
      if (!question.yesVotes.includes(userId)) {
        await questionRef.update({
          yesVotes: FieldValue.arrayUnion(userId)
        });
      }
      
      return this.findById(id);
    } catch (error) {
      console.error(`Error adding yes vote to question ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Add a no vote to a question
   * @param {string} id Question ID
   * @param {string} userId User ID
   * @returns {Object} Updated question
   */
  static async addNoVote(id, userId) {
    try {
      const questionRef = this.collection().doc(id);
      const question = await this.findById(id);
      
      if (!question) {
        throw new Error('Question not found');
      }
      
      // Remove from yes votes if present
      if (question.yesVotes.includes(userId)) {
        await questionRef.update({
          yesVotes: FieldValue.arrayRemove(userId)
        });
      }
      
      // Add to no votes if not already present
      if (!question.noVotes.includes(userId)) {
        await questionRef.update({
          noVotes: FieldValue.arrayUnion(userId)
        });
      }
      
      return this.findById(id);
    } catch (error) {
      console.error(`Error adding no vote to question ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Resolve a question
   * @param {string} id Question ID
   * @param {boolean} outcome Question outcome (true=yes, false=no)
   * @param {string} resolverId User ID of resolver
   * @returns {Object} Resolved question
   */
  static async resolve(id, outcome, resolverId) {
    try {
      await this.collection().doc(id).update({
        resolved: true,
        outcome: outcome,
        resolvedBy: resolverId,
        resolvedAt: Timestamp.now()
      });
      
      return this.findById(id);
    } catch (error) {
      console.error(`Error resolving question ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Get active questions (not resolved and not expired)
   * @returns {Array} List of active questions
   */
  static async getActive() {
    try {
      const now = Timestamp.now();
      const snapshot = await this.collection()
        .where('resolved', '==', false)
        .where('endTime', '>', now)
        .get();
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          createdAt: timestampToDate(data.createdAt),
          endTime: timestampToDate(data.endTime),
          resolvedAt: timestampToDate(data.resolvedAt)
        };
      });
    } catch (error) {
      console.error('Error getting active questions:', error);
      throw error;
    }
  }
  
  /**
   * Get expired but unresolved questions
   * @returns {Array} List of expired unresolved questions
   */
  static async getExpiredUnresolved() {
    try {
      const now = Timestamp.now();
      const snapshot = await this.collection()
        .where('resolved', '==', false)
        .where('endTime', '<=', now)
        .get();
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          createdAt: timestampToDate(data.createdAt),
          endTime: timestampToDate(data.endTime),
          resolvedAt: timestampToDate(data.resolvedAt)
        };
      });
    } catch (error) {
      console.error('Error getting expired unresolved questions:', error);
      throw error;
    }
  }
  
  /**
   * Check if a question is expired
   * @param {string} id Question ID
   * @returns {boolean} True if question is expired
   */
  static async isExpired(id) {
    try {
      const question = await this.findById(id);
      
      if (!question) {
        throw new Error('Question not found');
      }
      
      return Date.now() >= question.endTime;
    } catch (error) {
      console.error(`Error checking if question ${id} is expired:`, error);
      throw error;
    }
  }
}

module.exports = Question;