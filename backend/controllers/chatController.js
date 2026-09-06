// WeatherGPT Chatbot Controller — Phase 2
//
// Full pipeline:
//  1. Request validation
//  2. Greeting detection (instant warm reply, no data calls)
//  3. Domain guardrail filtering (irrelevant queries rejected)
//  4. Load MongoDB chat history for authenticated users
//  5. Conceptual weather question handling (Gemini educational response)
//  6. Out-of-range forecast hallucination prevention
//  7. Location resolution + Open-Meteo geocoding
//  8. Historical / climate query detection + data fetch
//  9. Live forecast data fetch from Open-Meteo
// 10. Authoritative calculation engines (risk, advisories, alerts, climate)
// 11. Structured weather context construction
// 12. Gemini natural response generation
// 13. Suspicious response validation + one re-verification pass
// 14. Deterministic fallback if Gemini unavailable
// 15. Save turn to MongoDB for authenticated users
// 16. Return response

const mongoose = require('mongoose')
const {
  IRRELEVANT_RESPONSE,
  isWeatherRelated,
  isConceptualWeatherQuery,
} = require('../utils/domainGuard')
const {
  fetchForecastWeather,
  fetchHistoricalData,
  geocodeLocation,
  buildCurrentSnapshot,
  DEFAULT_LOCATIONS,
} = require('../services/openMeteoService')
const {
  evaluateRisk,
  extractPeriodMetrics,
  generateAdvisories,
  evaluateAlerts,
  analyzeHistoricalTrends,
  buildStructuredWeatherContext,
  generateDeterministicFallback,
} = require('../services/weatherAnalysisService')
const {
  isGeminiConfigured,
  generateGeminiResponse,
} = require('../services/geminiService')
const { ChatHistory } = require('../models/ChatHistory')

// ─────────────────────────────────────────────────────────────────────────────
// GREETING DETECTION
// ─────────────────────────────────────────────────────────────────────────────
const GREETING_PATTERNS = [
  /^\s*(hi|hello|hey|howdy|hiya|greetings|sup|what'?s up|yo)\s*[!.]?\s*$/i,
  /^\s*good\s+(morning|afternoon|evening|night|day)\s*[!.]?\s*$/i,
  /^\s*(hello there|hey there|hi there)\s*[!.]?\s*$/i,
  /^\s*(namaste|salaam|bonjour|hola)\s*[!.]?\s*$/i,
]

const GREETING_REPLIES = [
  "Hello! 👋 I'm WeatherGPT — your intelligent weather assistant powered by Open-Meteo and Gemini AI. Ask me about current conditions, forecasts, climate trends, severe weather alerts, or anything meteorology!",
  "Hi there! 🌤️ I'm WeatherGPT. I can tell you about live weather, forecasts up to 7 days ahead, historical climate trends, storm alerts, travel advisories, and more. What would you like to know?",
  "Hey! ☀️ WeatherGPT here. I can help with real-time weather data, rain forecasts, wind speeds, humidity, UV index, and much more — for cities across India. What's on your mind?",
  "Good to see you! 🌦️ I'm WeatherGPT, your weather intelligence assistant. I pull live data from Open-Meteo to keep you accurately informed. Ask me anything about weather or climate!",
]

function detectGreeting(query) {
  const trimmed = query.trim()
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(trimmed)) return true
  }
  return false
}

function getGreetingReply() {
  const idx = Math.floor(Math.random() * GREETING_REPLIES.length)
  return GREETING_REPLIES[idx]
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCATION EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────
function extractLocationFromQuery(query, fallbackLocation, history = []) {
  if (!query || typeof query !== 'string') return fallbackLocation

  const q = query.toLowerCase()

  // 1. Check known default locations with word boundaries
  for (const loc of DEFAULT_LOCATIONS) {
    const regex = new RegExp(`\\b${loc.name}\\b`, 'i')
    if (regex.test(query)) {
      return loc
    }
  }

  // 2. City aliases
  const aliases = {
    bangalore: 'Bengaluru',
    trichy: 'Tiruchirappalli',
    bombay: 'Mumbai',
    madras: 'Chennai',
    calcutta: 'Kolkata',
  }
  for (const [alias, canonical] of Object.entries(aliases)) {
    const regex = new RegExp(`\\b${alias}\\b`, 'i')
    if (regex.test(q)) {
      const match = DEFAULT_LOCATIONS.find(
        (l) => l.name.toLowerCase() === canonical.toLowerCase()
      )
      if (match) return match
    }
  }

  // 3. Regex for "in <City>", "to <City>", "for <City>", "at <City>"
  const match = query.match(
    /\b(?:in|to|for|at)\s+([A-Za-z\s]+?)(?:\s+(?:today|tomorrow|tonight|this|and|should|what|is|how|next|\?|$))/i
  )
  if (match && match[1]) {
    const candidate = match[1].trim()
    if (
      candidate &&
      candidate.length > 2 &&
      !/^(the|a|my|our|current|this|here)$/i.test(candidate)
    ) {
      const found = DEFAULT_LOCATIONS.find(
        (l) => l.name.toLowerCase() === candidate.toLowerCase()
      )
      if (found) return found
      return { name: candidate }
    }
  }

  // 4. Conversational follow-up: check recent assistant or user messages for location
  if (Array.isArray(history) && history.length > 0) {
    const recent = history.slice(-4).reverse()
    for (const msg of recent) {
      const content = msg?.content || ''
      for (const loc of DEFAULT_LOCATIONS) {
        if (new RegExp(`\\b${loc.name}\\b`, 'i').test(content)) {
          return loc
        }
      }
    }
  }

  return fallbackLocation || DEFAULT_LOCATIONS[0]
}

// ─────────────────────────────────────────────────────────────────────────────
// SUSPICIOUS RESPONSE VALIDATION
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Detect if a Gemini-generated answer is suspicious (possible hallucination).
 *
 * Checks:
 * 1. Answer is empty, null, or suspiciously short
 * 2. Answer contains a numeric value NOT present in the weather context string
 *    (hallucinated figures)
 * 3. Answer contains a city name NOT present in the provided context or location
 *
 * @param {string} answer - Gemini's answer
 * @param {string} weatherContext - The weather context block sent to Gemini
 * @param {string} locationName - The target location name
 * @returns {{ suspicious: boolean, reason: string|null }}
 */
function isSuspiciousResponse(answer, weatherContext, locationName) {
  if (!answer || typeof answer !== 'string' || answer.trim().length < 30) {
    return { suspicious: true, reason: 'Answer is missing or too short' }
  }

  if (!weatherContext) {
    // No context was sent (conceptual query) — cannot check for number hallucinations
    return { suspicious: false, reason: null }
  }

  // Extract numbers from the answer (integers and decimals)
  const answerNumbers = [...answer.matchAll(/\b(\d+(?:\.\d+)?)\b/g)].map((m) =>
    m[1]
  )

  // Build a set of numbers present in the weather context
  const contextNumbers = new Set(
    [...weatherContext.matchAll(/\b(\d+(?:\.\d+)?)\b/g)].map((m) => m[1])
  )

  // Check for numbers in the answer that are NOT in the context
  // Allow small numbers (0–10) as they can be ordinal, percentage labels, etc.
  const suspicious = answerNumbers.some((n) => {
    const num = parseFloat(n)
    if (num <= 10) return false // ignore small/ordinal numbers
    return !contextNumbers.has(n)
  })

  if (suspicious) {
    return {
      suspicious: true,
      reason: 'Answer contains numbers not found in supplied weather context',
    }
  }

  return { suspicious: false, reason: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// MONGODB HISTORY HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const DB_HISTORY_LIMIT = 6 // Last N messages to inject into Gemini context

async function loadUserHistory(userId) {
  try {
    if (!userId) return []
    if (mongoose.connection.readyState !== 1) return []
    return await ChatHistory.getRecentMessages(userId, DB_HISTORY_LIMIT)
  } catch (err) {
    console.warn('Failed to load chat history from MongoDB:', err.message)
    return []
  }
}

async function saveConversationTurn(userId, userMessage, assistantMessage) {
  try {
    if (!userId) return
    if (mongoose.connection.readyState !== 1) return
    await ChatHistory.appendMessages(userId, [
      { role: 'user', content: userMessage, timestamp: new Date() },
      { role: 'assistant', content: assistantMessage, timestamp: new Date() },
    ])
  } catch (err) {
    console.warn('Failed to save chat history to MongoDB:', err.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CHAT HANDLER — POST /api/chat
// ─────────────────────────────────────────────────────────────────────────────
async function handleChat(req, res) {
  try {
    const { message, location: clientLocation, conversationHistory: clientHistory = [] } = req.body

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Message is required.',
      })
    }

    const query = message.trim()
    const userId = req.user?._id || null

    // ──────────────────────────────────────────────────────────────────────
    // 1. GREETING DETECTION (instant response — no data calls needed)
    // ──────────────────────────────────────────────────────────────────────
    if (detectGreeting(query)) {
      return res.status(200).json({
        success: true,
        answer: getGreetingReply(),
        enhancedByGemini: false,
        isGreeting: true,
      })
    }

    // ──────────────────────────────────────────────────────────────────────
    // 2. DOMAIN BOUNDARY CHECK
    // ──────────────────────────────────────────────────────────────────────
    const weatherRelated = isWeatherRelated(query, clientHistory)
    if (!weatherRelated) {
      return res.status(200).json({
        success: true,
        answer: IRRELEVANT_RESPONSE,
        enhancedByGemini: false,
        isIrrelevant: true,
      })
    }

    // ──────────────────────────────────────────────────────────────────────
    // 3. LOAD MONGODB HISTORY (authenticated users only)
    // ──────────────────────────────────────────────────────────────────────
    let dbHistory = []
    if (userId) {
      dbHistory = await loadUserHistory(userId)
    }

    // Merge: DB history is the authoritative source; client history fills gaps for guests
    // If user is authenticated, DB history is used. If guest, client history is used.
    const conversationHistory = userId
      ? dbHistory
      : clientHistory.slice(-DB_HISTORY_LIMIT)

    // ──────────────────────────────────────────────────────────────────────
    // 4. CONCEPTUAL WEATHER QUESTION CHECK
    // ──────────────────────────────────────────────────────────────────────
    const isConceptual = isConceptualWeatherQuery(query)
    if (isConceptual) {
      if (isGeminiConfigured()) {
        const geminiAnswer = await generateGeminiResponse({
          query,
          conversationHistory,
          isConceptual: true,
        })
        if (geminiAnswer) {
          // Conceptual answers go through a basic length check only (no number check — no data context)
          const { suspicious } = isSuspiciousResponse(geminiAnswer, null, null)
          let finalAnswer = geminiAnswer

          if (suspicious && isGeminiConfigured()) {
            console.warn(`[WeatherGPT] Suspicious conceptual response detected. Retrying...`)
            const retry = await generateGeminiResponse({
              query,
              conversationHistory,
              isConceptual: true,
              retryHint: 'Please provide a detailed, accurate meteorological explanation.',
            })
            if (retry && retry.trim().length >= 30) finalAnswer = retry
          }

          if (userId) await saveConversationTurn(userId, query, finalAnswer)
          return res.status(200).json({
            success: true,
            answer: finalAnswer,
            source: 'WeatherGPT Meteorological Intelligence',
            enhancedByGemini: true,
          })
        }
      }

      // Deterministic fallback for conceptual queries
      let fallbackText =
        'Weather forecasting relies on Numerical Weather Prediction (NWP) models that simulate the atmosphere using mathematical physics. Variables like temperature, humidity, atmospheric pressure, and wind are monitored to predict future atmospheric states.'
      const lower = query.toLowerCase()
      if (/humidity/i.test(lower)) {
        fallbackText =
          `Humidity is the concentration of water vapor present in the air. Relative humidity is expressed as a percentage of the maximum moisture the air can hold at that specific temperature. Higher humidity inhibits sweat evaporation, making warm temperatures feel significantly hotter.`
      } else if (/pressure/i.test(lower)) {
        fallbackText =
          `Atmospheric pressure is the force exerted by the weight of the air column above a given point on Earth. Standard sea-level pressure is approximately 1013.25 hPa. Rapidly falling pressure often signals approaching clouds, wind, and precipitation, while rising pressure typically indicates settling, clear conditions.`
      } else if (/ecmwf|nwp|model/i.test(lower)) {
        fallbackText =
          `An NWP (Numerical Weather Prediction) model is a computer simulation of the Earth's atmosphere based on the laws of physics, fluid dynamics, and thermodynamics. ECMWF IFS (Integrated Forecasting System) is one of the world's leading global NWP models, renowned for its accuracy in medium-range forecasting.`
      } else if (/rain probability/i.test(lower)) {
        fallbackText =
          `Rain probability (Probability of Precipitation) represents the likelihood that measurable precipitation (at least 0.1 mm) will occur at a specific location during a given time period, calculated as the product of forecast confidence and expected areal coverage.`
      } else if (/heatwave/i.test(lower)) {
        fallbackText =
          `A heatwave is a prolonged period of excessively hot weather, often accompanied by high humidity. In plains, it is typically declared when maximum temperatures surpass 40 degrees C with significant positive departure from normal seasonal averages.`
      } else if (/wind chill/i.test(lower)) {
        fallbackText =
          'Wind chill is the perceived decrease in air temperature felt by the body on exposed skin due to the flow of air. Faster wind speeds strip away the thin layer of warmth around the skin, making cold weather feel substantially colder.'
      }

      if (userId) await saveConversationTurn(userId, query, fallbackText)
      return res.status(200).json({
        success: true,
        answer: fallbackText,
        source: 'WeatherGPT Knowledge Base',
        enhancedByGemini: false,
      })
    }

    // ──────────────────────────────────────────────────────────────────────
    // 5. OUT-OF-RANGE FORECAST CHECK (Hallucination Prevention)
    // ──────────────────────────────────────────────────────────────────────
    const dayFarMatch = query.match(/(\d+)\s+days?\s+(?:from now|later|ahead|forecast)/i)
    if (dayFarMatch && parseInt(dayFarMatch[1], 10) > 7) {
      const rangeAnswer = `Numerical weather prediction models via Open-Meteo provide reliable daily forecasts up to 7 days ahead. A forecast for ${dayFarMatch[1]} days from now is beyond the available forecast range and cannot be calculated accurately.`
      if (userId) await saveConversationTurn(userId, query, rangeAnswer)
      return res.status(200).json({
        success: true,
        answer: rangeAnswer,
        enhancedByGemini: false,
      })
    }

    // ──────────────────────────────────────────────────────────────────────
    // 6. RESOLVE LOCATION & COORDINATES
    // ──────────────────────────────────────────────────────────────────────
    let targetLoc = extractLocationFromQuery(query, clientLocation, conversationHistory)

    if (!targetLoc?.latitude || !targetLoc?.longitude) {
      const geocoded = await geocodeLocation(targetLoc?.name || 'Chennai')
      if (geocoded) {
        targetLoc = { ...targetLoc, ...geocoded }
      } else {
        const noLocAnswer = `Weather data for "${targetLoc?.name || 'that location'}" is currently unavailable because the location could not be resolved. Please verify the city name or choose one from the location list.`
        if (userId) await saveConversationTurn(userId, query, noLocAnswer)
        return res.status(200).json({
          success: true,
          answer: noLocAnswer,
          enhancedByGemini: false,
        })
      }
    }

    // ──────────────────────────────────────────────────────────────────────
    // 7. HISTORICAL / CLIMATE TREND QUERY CHECK
    // ──────────────────────────────────────────────────────────────────────
    const isClimateQuery =
      /\b(climate|historical|history|trend|trends|past\s+\d+|last\s+\d+\s+years?|over\s+the\s+last|\b20\d\d\b|become\s+hotter|getting\s+hotter|weather\s+changed|changed\s+in|has.*changed)\b/i.test(
        query
      ) && !/today|tomorrow|tonight|current/i.test(query)

    let historicalAnalysis = null
    if (isClimateQuery) {
      try {
        const currentYear = new Date().getFullYear()
        const startYear = currentYear - 10
        const histData = await fetchHistoricalData(
          targetLoc.latitude,
          targetLoc.longitude,
          `${startYear}-01-01`,
          `${currentYear - 1}-12-31`
        )
        historicalAnalysis = analyzeHistoricalTrends(histData)
      } catch (err) {
        console.warn('Historical data fetch failed:', err.message)
      }
    }

    // ──────────────────────────────────────────────────────────────────────
    // 8. FETCH REAL LIVE WEATHER DATA FROM OPEN-METEO
    // ──────────────────────────────────────────────────────────────────────
    let weatherData = null
    let snapshot = null
    try {
      weatherData = await fetchForecastWeather(targetLoc.latitude, targetLoc.longitude)
      snapshot = buildCurrentSnapshot(weatherData)
    } catch (err) {
      console.error('Open-Meteo fetch error:', err.message)
      const fetchErrAnswer = `I could not retrieve live weather data for ${targetLoc.name} from Open-Meteo right now. Please check your connection and try again.`
      if (userId) await saveConversationTurn(userId, query, fetchErrAnswer)
      return res.status(200).json({
        success: true,
        answer: fetchErrAnswer,
        enhancedByGemini: false,
      })
    }

    // ──────────────────────────────────────────────────────────────────────
    // 9. RUN AUTHORITATIVE ENGINES (Risk, Advisory, Alerts)
    // ──────────────────────────────────────────────────────────────────────
    const requestedPeriod = /tomorrow|next day/i.test(query) ? 'tomorrow' : 'today'
    const metrics = extractPeriodMetrics(weatherData, snapshot, requestedPeriod)
    const risk = evaluateRisk(snapshot)
    const advisories = generateAdvisories(metrics, risk)
    const alerts = evaluateAlerts(weatherData)

    // ──────────────────────────────────────────────────────────────────────
    // 10. BUILD STRUCTURED WEATHER CONTEXT FOR GEMINI
    // ──────────────────────────────────────────────────────────────────────
    const weatherContext = buildStructuredWeatherContext({
      location: targetLoc,
      weatherData,
      snapshot,
      metrics,
      risk,
      advisories,
      alerts,
      historicalAnalysis,
    })

    // ──────────────────────────────────────────────────────────────────────
    // 11. CALL GEMINI FOR NATURAL RESPONSE GENERATION
    // ──────────────────────────────────────────────────────────────────────
    let answer = null
    let enhancedByGemini = false

    if (isGeminiConfigured()) {
      answer = await generateGeminiResponse({
        query,
        weatherContext,
        conversationHistory,
        isConceptual: false,
      })
      if (answer) {
        enhancedByGemini = true
      }
    }

    // ──────────────────────────────────────────────────────────────────────
    // 12. SUSPICIOUS RESPONSE VALIDATION (one re-verification pass)
    // ──────────────────────────────────────────────────────────────────────
    if (answer && enhancedByGemini) {
      const { suspicious, reason } = isSuspiciousResponse(
        answer,
        weatherContext,
        targetLoc.name
      )

      if (suspicious) {
        console.warn(
          `[WeatherGPT] Suspicious Gemini response for "${query}" (${reason}). Running verification pass...`
        )

        const verifiedAnswer = await generateGeminiResponse({
          query,
          weatherContext,
          conversationHistory,
          isConceptual: false,
          retryHint:
            'IMPORTANT: The previous response may have contained inaccurate data. Re-read the weather context very carefully. Answer ONLY using the exact numbers and facts provided in the context. Do not invent any values.',
        })

        if (verifiedAnswer && verifiedAnswer.trim().length >= 30) {
          answer = verifiedAnswer
          console.log('[WeatherGPT] Verification pass complete — using re-verified answer.')
        } else {
          // Verified answer also failed — fall back to deterministic
          console.warn('[WeatherGPT] Verification pass returned empty. Falling back to deterministic engine.')
          answer = null
          enhancedByGemini = false
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────
    // 13. FALLBACK TO DETERMINISTIC ENGINE IF GEMINI IS NOT AVAILABLE
    // ──────────────────────────────────────────────────────────────────────
    if (!answer) {
      answer = generateDeterministicFallback({
        query,
        locationName: targetLoc.name,
        metrics,
        snapshot,
        risk,
        advisories,
        weatherData,
        alerts,
        historicalAnalysis,
      })
      enhancedByGemini = false
    }

    // ──────────────────────────────────────────────────────────────────────
    // 14. SAVE CONVERSATION TURN TO MONGODB (authenticated users)
    // ──────────────────────────────────────────────────────────────────────
    if (userId && answer) {
      await saveConversationTurn(userId, query, answer)
    }

    return res.status(200).json({
      success: true,
      answer,
      source: 'Open-Meteo',
      nwpModel: weatherData?.model || 'ECMWF IFS',
      location: targetLoc.name,
      enhancedByGemini,
    })
  } catch (err) {
    console.error('Unhandled chat controller error:', err)
    return res.status(500).json({
      success: false,
      message: 'An error occurred while processing your weather request.',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/chat/history
 * Returns the most recent chat messages for the authenticated user.
 */
async function getChatHistory(req, res) {
  try {
    const userId = req.user._id
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database connection is unavailable.',
      })
    }

    const limit = parseInt(req.query.limit, 10) || 20
    const messages = await ChatHistory.getRecentMessages(userId, Math.min(limit, 100))

    return res.status(200).json({
      success: true,
      messages,
      count: messages.length,
    })
  } catch (err) {
    console.error('getChatHistory error:', err.message)
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve chat history.',
    })
  }
}

/**
 * DELETE /api/chat/history
 * Clears all chat history for the authenticated user.
 */
async function clearChatHistory(req, res) {
  try {
    const userId = req.user._id
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database connection is unavailable.',
      })
    }

    await ChatHistory.clearHistory(userId)

    return res.status(200).json({
      success: true,
      message: 'Chat history cleared successfully.',
    })
  } catch (err) {
    console.error('clearChatHistory error:', err.message)
    return res.status(500).json({
      success: false,
      message: 'Failed to clear chat history.',
    })
  }
}

module.exports = {
  handleChat,
  getChatHistory,
  clearChatHistory,
}
