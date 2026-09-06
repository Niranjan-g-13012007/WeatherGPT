// WeatherGPT User Preferences Controller
//
// Handles reading and updating user preferences (language, etc.).
// All routes are protected — userId comes from req.user, never from the request body.

const User = require('../models/User')

const SUPPORTED_LANGS = ['en', 'hi', 'ta', 'te', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'or']

/**
 * GET /api/user/preferences
 * Returns the authenticated user's preferences.
 */
async function getPreferences(req, res) {
  try {
    const user = await User.findById(req.user._id).select('preferredLanguage')
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' })
    }
    return res.status(200).json({
      success: true,
      preferences: {
        preferredLanguage: user.preferredLanguage || 'en',
      },
    })
  } catch (err) {
    console.error('getPreferences error:', err.message)
    return res.status(500).json({ success: false, message: 'Failed to retrieve preferences.' })
  }
}

/**
 * PATCH /api/user/preferences/language
 * Updates the authenticated user's preferred language.
 *
 * Body: { language: "ta" }
 */
async function updateLanguage(req, res) {
  try {
    const { language } = req.body
    if (!language || !SUPPORTED_LANGS.includes(language)) {
      return res.status(400).json({
        success: false,
        message: `Invalid language code. Supported: ${SUPPORTED_LANGS.join(', ')}`,
      })
    }

    await User.findByIdAndUpdate(req.user._id, { preferredLanguage: language })

    return res.status(200).json({
      success: true,
      message: 'Language preference updated.',
      preferredLanguage: language,
    })
  } catch (err) {
    console.error('updateLanguage error:', err.message)
    return res.status(500).json({ success: false, message: 'Failed to update language preference.' })
  }
}

module.exports = { getPreferences, updateLanguage }
