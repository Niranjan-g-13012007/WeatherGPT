// WeatherGPT Chat History Model
//
// Stores per-user conversation history in MongoDB.
// One document per user (upsert strategy).
// Messages are capped at MAX_MESSAGES to prevent unbounded growth.

const mongoose = require('mongoose');

const MAX_MESSAGES = 100;

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 8000,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const chatHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Append new messages for a user and trim to the last MAX_MESSAGES.
 * Creates the document if it doesn't exist yet (upsert).
 *
 * @param {string|ObjectId} userId
 * @param {Array<{role: string, content: string}>} newMessages
 * @returns {Promise<void>}
 */
chatHistorySchema.statics.appendMessages = async function (userId, newMessages) {
  if (!userId || !Array.isArray(newMessages) || newMessages.length === 0) return;

  const timestampedMessages = newMessages.map((m) => ({
    role: m.role,
    content: m.content,
    timestamp: m.timestamp || new Date(),
  }));

  // Push new messages and trim to last MAX_MESSAGES
  await this.findOneAndUpdate(
    { userId },
    {
      $push: {
        messages: {
          $each: timestampedMessages,
          $slice: -MAX_MESSAGES,
        },
      },
    },
    { upsert: true, new: true }
  );
};

/**
 * Get the last N messages for a user.
 *
 * @param {string|ObjectId} userId
 * @param {number} limit - Number of most recent messages to return
 * @returns {Promise<Array<{role, content, timestamp}>>}
 */
chatHistorySchema.statics.getRecentMessages = async function (userId, limit = 6) {
  const doc = await this.findOne({ userId }).lean();
  if (!doc || !doc.messages || doc.messages.length === 0) return [];
  return doc.messages.slice(-limit);
};

/**
 * Delete all chat history for a user.
 *
 * @param {string|ObjectId} userId
 * @returns {Promise<void>}
 */
chatHistorySchema.statics.clearHistory = async function (userId) {
  await this.deleteOne({ userId });
};

const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);

module.exports = { ChatHistory, MAX_MESSAGES };
