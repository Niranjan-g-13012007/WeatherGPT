const express = require('express')
const router = express.Router()
const { getPreferences, updateLanguage } = require('../controllers/userController')
const { protect } = require('../middleware/authMiddleware')

// GET /api/user/preferences — Get current user's preferences
router.get('/preferences', protect, getPreferences)

// PATCH /api/user/preferences/language — Update preferred language
router.patch('/preferences/language', protect, updateLanguage)

module.exports = router
