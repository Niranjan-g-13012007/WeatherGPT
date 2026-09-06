const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri || uri.includes('<username>') || uri.includes('<NEW_PASSWORD>')) {
    console.warn(
      '⚠️  [MongoDB] MONGO_URI is missing or contains placeholder values. Please update backend/.env with your valid MongoDB Atlas connection string.'
    );
    return false;
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log('MongoDB connected successfully');
    return true;
  } catch (error) {
    // Sanitize error message to avoid printing credentials
    const safeMsg = error.message ? error.message.replace(/:\/\/.*@/, '://***:***@') : 'Connection failed';
    console.error(`MongoDB connection error: ${safeMsg}`);
    return false;
  }
};

module.exports = connectDB;
