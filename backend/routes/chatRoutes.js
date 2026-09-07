const express = require('express')
const router = express.Router()
const { handleChat, getChatHistory, clearChatHistory } = require('../controllers/chatController')
const { handleTts } = require('../controllers/ttsController')
const { optionalProtect, protect } = require('../middleware/authMiddleware')

// POST /api/chat — Process user message via WeatherGPT + Gemini enhancement
// optionalProtect: authenticated users get history persistence, guests still get answers
router.post('/', optionalProtect, handleChat)

// GET /api/chat/history — Return recent chat history for authenticated user
router.get('/history', protect, getChatHistory)

// DELETE /api/chat/history — Clear chat history for authenticated user
router.delete('/history', protect, clearChatHistory)

// GET & POST /api/chat/tts — Stream synthesized speech audio for any language
router.get('/tts', handleTts)
router.post('/tts', handleTts)

module.exports = router

