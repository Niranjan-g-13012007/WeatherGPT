// WeatherGPT Gemini Conversational Intelligence Service (Backend)
//
// Uses the official Google Gemini SDK (@google/genai).
// IMPORTANT:
// - Gemini is the natural language reasoning and response layer.
// - Open-Meteo is the source of truth for weather data.
// - Gemini must NEVER invent weather facts or alter calculations.
// - GEMINI_API_KEY is read strictly from process.env and never logged or exposed.

const { GoogleGenAI } = require('@google/genai')

const SYSTEM_INSTRUCTION = `You are the conversational intelligence layer of WeatherGPT.

Weather data supplied in the context comes from trusted application services such as Open-Meteo and must be treated as authoritative for weather facts.

Rules:
1. Never invent or modify supplied weather values.
2. Never fabricate forecasts, rainfall amounts, temperatures, alerts, historical values, or NWP models.
3. Use the supplied data to explain weather information clearly, naturally, and intelligently.
4. If the user asks for a value or location that is not present in the supplied context, do not guess or extrapolate. State clearly that the required data is unavailable.
5. If the user asks for a forecast beyond available forecast days (e.g. 20 days ahead), state that reliable numerical forecast data from Open-Meteo does not extend that far.
6. You are allowed to answer general educational questions about weather, meteorology, atmosphere, climate, and forecasting models.
7. Keep responses concise, useful, conversational, and easy to understand.
8. Never claim that WeatherGPT itself runs ECMWF or another NWP model unless explicitly stated by the supplied context. The forecast data is retrieved via Open-Meteo.
9. Distinguish forecast-derived WeatherGPT analysis from official government (e.g. IMD) warnings. If source is "WeatherGPT Forecast Alert", frame it as "WeatherGPT forecast analysis indicates...". Only say an official warning has been issued if the context explicitly designates it as official.
10. If the user asks a multi-intent question (e.g., "Will it rain tomorrow in Chennai, should I travel, and which weather model is being used?"), answer ALL requested parts coherently in a single response without omitting any aspect.
11. Stay strictly within the weather, climate, meteorology, forecasting, alerts, and related domains.`

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
 * structured weather context, and recent conversation history.
 *
 * @param {object} params
 * @param {string} params.query - User question
 * @param {string} [params.weatherContext] - Compact structured Open-Meteo context
 * @param {Array} [params.conversationHistory] - Recent turns [{ role, content }]
 * @param {boolean} [params.isConceptual] - True if educational / meteorological definition
 * @returns {Promise<string|null>} - Generated text or null if failed / unavailable
 */
async function generateGeminiResponse({
  query,
  weatherContext = null,
  conversationHistory = [],
  isConceptual = false,
  retryHint = null,
}) {
  const ai = getGeminiClient()
  if (!ai) {
    return null
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash'

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
  if (weatherContext) {
    currentTurnPrompt += `${weatherContext}\n\n`
  }
  currentTurnPrompt += `USER QUESTION: ${query}`

  contents.push({
    role: 'user',
    parts: [{ text: currentTurnPrompt }],
  })

  const primaryModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash'
  const modelCandidates = [
    primaryModel,
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
  ].filter((m, idx, arr) => arr.indexOf(m) === idx)

  for (const model of modelCandidates) {
    try {
      const apiCallPromise = ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
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
  SYSTEM_INSTRUCTION,
}
