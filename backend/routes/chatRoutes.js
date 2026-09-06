const express = require('express')
const router = express.Router()
const { handleChat } = require('../controllers/chatController')

// POST /api/chat - Process user message via WeatherGPT + Gemini enhancement
router.post('/', handleChat)

module.exports = router
