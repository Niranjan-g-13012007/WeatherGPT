// WeatherGPT Gemini Conversational Intelligence Service (Backend)
//
// Uses the official Google Gemini SDK (@google/genai).
// IMPORTANT:
// - Gemini is the natural language reasoning and response layer.
// - Open-Meteo is the source of truth for weather data.
// - Gemini must NEVER invent weather facts or alter calculations.
// - GEMINI_API_KEY is read strictly from process.env and never logged or exposed.

const { GoogleGenAI } = require('@google/genai')
const { getLanguageName } = require('../utils/languageDetector')

const BASE_SYSTEM_INSTRUCTION = `You are the conversational intelligence layer of WeatherGPT — an intelligent weather assistant for India.

Weather data supplied in the context comes from trusted application services such as Open-Meteo and must be treated as authoritative for weather facts.

Core Rules:
1. Never invent or modify supplied weather values.
2. Never fabricate forecasts, rainfall amounts, temperatures, alerts, historical values, or NWP models.
3. Use the supplied data to explain weather information clearly, naturally, and intelligently.
4. If the user asks for a value or location that is not present in the supplied context, do not guess or extrapolate. State clearly that the required data is unavailable.
5. If the user asks for a forecast beyond available forecast days (e.g. 20 days ahead), state that reliable numerical forecast data from Open-Meteo does not extend that far.
6. You are allowed to answer general educational questions about weather, meteorology, atmosphere, climate, and forecasting models.
7. Keep responses concise, useful, conversational, and easy to understand.
8. Never claim that WeatherGPT itself runs ECMWF or another NWP model unless explicitly stated by the supplied context. The forecast data is retrieved via Open-Meteo.
9. Distinguish forecast-derived WeatherGPT analysis from official government (e.g. IMD) warnings.
10. If the user asks a multi-intent question, answer ALL requested parts coherently in a single response.
11. Stay strictly within the weather, climate, meteorology, forecasting, alerts, and related domains.

Multilingual Rules:
12. ALWAYS respond in the language specified in the RESPONSE LANGUAGE instruction below. Do not switch languages mid-response.
13. You may understand queries in any language including mixed-language (e.g. "Chennai la rain varuma?", "Chennai mein baarish hogi?").
14. When responding in a non-English language, use natural, conversational expressions — not literal word-for-word translations.
15. Weather values (numbers, units) remain in standard notation (e.g. 32°C, 78%, 60mm) regardless of response language.
16. Greetings in regional languages should be acknowledged warmly and naturally in the same language.`

/**
 * Build a system instruction with the language requirement injected.
 */
function buildSystemInstruction(responseLanguage = 'en') {
  const langName = getLanguageName(responseLanguage)
  return `${BASE_SYSTEM_INSTRUCTION}

RESPONSE LANGUAGE: Respond ONLY in ${langName}. This is mandatory. All your output must be in ${langName}.`
}

let clientInstance = null

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null
  }
  if (!clientInstance) {
    clientInstance = new GoogleGenAI({ apiKey })
  }
  return clientInstance
}

/**
 * Checks if Gemini enhancement is actively available.
 */
function isGeminiConfigured() {
  const apiKey = process.env.GEMINI_API_KEY
  return Boolean(apiKey && apiKey !== 'YOUR_GEMINI_API_KEY' && apiKey.trim().length > 10)
}

/**
 * Generate natural, intelligent response from Gemini given the user question,
 * structured weather context, conversation history, and language parameters.
 *
 * @param {object} params
 * @param {string} params.query - User question
 * @param {string} [params.weatherContext] - Compact structured Open-Meteo context
 * @param {Array} [params.conversationHistory] - Recent turns [{ role, content }]
 * @param {boolean} [params.isConceptual] - True if educational / meteorological definition
 * @param {string} [params.responseLanguage] - Language code for the response (e.g. 'ta', 'hi')
 * @param {string} [params.detectedLanguage] - Language detected from the user's message
 * @param {string|null} [params.retryHint] - Extra instruction for verification re-pass
 * @returns {Promise<string|null>} - Generated text or null if failed / unavailable
 */
async function generateGeminiResponse({
  query,
  weatherContext = null,
  conversationHistory = [],
  isConceptual = false,
  responseLanguage = 'en',
  detectedLanguage = 'en',
  retryHint = null,
}) {
  const ai = getGeminiClient()
  if (!ai) {
    return null
  }

  // Build the message contents
  const contents = []

  // Add recent conversation history (up to last 4 turns) for conversational continuity
  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    const recent = conversationHistory.slice(-4)
    for (const msg of recent) {
      if (msg && msg.content && typeof msg.content === 'string') {
        const role = msg.role === 'user' ? 'user' : 'model'
        contents.push({
          role,
          parts: [{ text: msg.content }],
        })
      }
    }
  }

  // Build the current turn prompt
  let currentTurnPrompt = ''

  // Prepend retry hint if this is a verification pass
  if (retryHint) {
    currentTurnPrompt += `${retryHint}\n\n`
  }

  // Language directive injected into the user prompt as well (reinforces system instruction)
  const langName = getLanguageName(responseLanguage)
  if (responseLanguage !== 'en') {
    currentTurnPrompt += `[LANGUAGE INSTRUCTION: Respond in ${langName} only]\n\n`
  }

  if (weatherContext) {
    currentTurnPrompt += `${weatherContext}\n\n`
  }

  currentTurnPrompt += `USER QUESTION: ${query}`

  contents.push({
    role: 'user',
    parts: [{ text: currentTurnPrompt }],
  })

  const primaryModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
  const modelCandidates = [
    primaryModel,
    'gemini-3.6-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
  ].filter((m, idx, arr) => arr.indexOf(m) === idx)

  // Build system instruction with language requirement
  const systemInstruction = buildSystemInstruction(responseLanguage)

  for (const model of modelCandidates) {
    try {
      const apiCallPromise = ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          temperature: 0.2, // Low temperature for high factual adherence to supplied context
        },
      })

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Gemini API call for ${model} timed out after 12000ms`)), 12000)
      )

      const response = await Promise.race([apiCallPromise, timeoutPromise])

      const text = response?.text
      if (text && typeof text === 'string' && text.trim().length > 0) {
        return text.trim()
      }
    } catch (err) {
      console.warn(`Gemini model ${model} attempt failed:`, err.message || err)
    }
  }

  // All candidates failed or timed out — log and return null for deterministic fallback
  console.error('All Gemini model candidates exhausted (falling back to deterministic engine).')
  return null
}

module.exports = {
  isGeminiConfigured,
  generateGeminiResponse,
  BASE_SYSTEM_INSTRUCTION,
}
