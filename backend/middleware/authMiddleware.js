const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

// Middleware to ensure MongoDB Atlas connection is active before queries
const checkDb = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message:
        'Database connection is not established. Please configure a valid MONGO_URI in backend/.env.',
    });
  }
  next();
};

const protect = async (req, res, next) => {
  try {
    let token = null;

    // 1. Read token from HttpOnly cookie
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // Fallback: Authorization header (Bearer <token>)
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized. Please log in.',
      });
    }

    // 2. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Find user by id (without password)
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User session is invalid or user no longer exists.',
      });
    }

    // 4. Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session has expired. Please log in again.',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Not authorized. Invalid token.',
    });
  }
};

/**
 * Optional authentication middleware for routes that work for both guests and authenticated users.
 * Reads the JWT cookie or Authorization header. If valid, populates req.user.
 * If missing or invalid, sets req.user = null and continues — does NOT reject the request.
 *
 * Use on routes where authentication enriches the response but is not required.
 */
const optionalProtect = async (req, res, next) => {
  try {
    let token = null;

    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    req.user = user || null;
    return next();
  } catch {
    // Invalid or expired token — treat as guest
    req.user = null;
    return next();
  }
};

module.exports = { protect, checkDb, optionalProtect };
