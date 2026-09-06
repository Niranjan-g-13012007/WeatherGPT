const express = require('express');
const passport = require('passport');
const {
  signup,
  login,
  getMe,
  logout,
  googleCallback,
} = require('../controllers/authController');
const { protect, checkDb } = require('../middleware/authMiddleware');

const router = express.Router();

// Local auth routes
router.post('/signup', checkDb, signup);
router.post('/login', checkDb, login);
router.post('/logout', logout);
router.get('/me', protect, getMe);

// Google OAuth routes
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/login?error=google_not_configured`);
  }

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    prompt: 'select_account',
  })(req, res, next);
});

router.get(
  '/google/callback',
  (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/login?error=google_not_configured`);
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    passport.authenticate('google', {
      session: false,
      failureRedirect: `${frontendUrl}/login?error=google_failed`,
    })(req, res, next);
  },
  googleCallback
);

module.exports = router;
