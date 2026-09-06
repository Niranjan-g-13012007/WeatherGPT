const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

const configurePassport = () => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL =
    process.env.GOOGLE_CALLBACK_URL ||
    'http://localhost:8000/api/auth/google/callback';

  if (!clientID || !clientSecret) {
    console.warn(
      '⚠️  [Google OAuth] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured in .env. Google login will be disabled until credentials are added.'
    );
    return false;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email =
            profile.emails && profile.emails[0]
              ? profile.emails[0].value.toLowerCase()
              : null;

          if (!email) {
            return done(new Error('No email found in Google profile'), null);
          }

          const avatar =
            profile.photos && profile.photos[0]
              ? profile.photos[0].value
              : '';

          // 1. Check if user with this googleId already exists
          let user = await User.findOne({ googleId: profile.id });
          if (user) {
            // Update avatar if not present
            if (!user.avatar && avatar) {
              user.avatar = avatar;
              await user.save();
            }
            return done(null, user);
          }

          // 2. Check if user with this email already exists (linking local account)
          user = await User.findOne({ email });
          if (user) {
            user.googleId = profile.id;
            if (!user.avatar && avatar) {
              user.avatar = avatar;
            }
            await user.save();
            return done(null, user);
          }

          // 3. Create new Google user
          user = await User.create({
            name: profile.displayName || 'Google User',
            email,
            googleId: profile.id,
            avatar,
            provider: 'google',
          });

          return done(null, user);
        } catch (error) {
          console.error('Google Strategy verify error:', error);
          return done(error, null);
        }
      }
    )
  );

  return true;
};

module.exports = configurePassport;
