// WeatherGPT Chatbot Controller — Multilingual Edition
//
// Full pipeline:
//  1.  Request validation
//  2.  Language detection (franc-min) + resolution (preferred > detected > 'en')
//  3.  Greeting detection — multilingual, instant reply
//  4.  Greeting + weather combo — acknowledge + process weather
//  5.  Domain guardrail filtering — multilingual rejection
//  6.  Load MongoDB chat history for authenticated users
//  7.  Conceptual weather question handling (Gemini educational response)
//  8.  Out-of-range forecast hallucination prevention
//  9.  Location resolution + Open-Meteo geocoding
// 10.  Historical / climate query detection + data fetch
// 11.  Live forecast data fetch from Open-Meteo
// 12.  Authoritative calculation engines (risk, advisories, alerts, climate)
// 13.  Structured weather context construction
// 14.  Gemini multilingual response generation
// 15.  Suspicious response validation + one re-verification pass
// 16.  Deterministic fallback if Gemini unavailable
// 17.  Save turn to MongoDB with language tag
// 18.  Return response

const mongoose = require('mongoose')
const {
  getIrrelevantResponse,
  isWeatherRelated,
  isConceptualWeatherQuery,
  detectGreeting,
  hasGreetingPrefix,
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
const { detectLanguage, resolveResponseLanguage } = require('../utils/languageDetector')

// ─────────────────────────────────────────────────────────────────────────────
// MULTILINGUAL GREETING REPLIES
// Gemini generates these when configured; otherwise use these fallbacks.
// ─────────────────────────────────────────────────────────────────────────────
const GREETING_FALLBACKS = {
  en: [
    "Hello! 👋 I'm WeatherGPT — your intelligent weather assistant powered by Open-Meteo and Gemini AI. Ask me about current conditions, forecasts, climate trends, severe weather alerts, or anything meteorology!",
    "Hi there! 🌤️ I'm WeatherGPT. I can tell you about live weather, forecasts up to 7 days ahead, historical climate trends, storm alerts, travel advisories, and more. What would you like to know?",
  ],
  hi: [
    "नमस्ते! 👋 मैं WeatherGPT हूँ — Open-Meteo और Gemini AI द्वारा संचालित आपका मौसम सहायक। मुझसे मौसम, पूर्वानुमान, जलवायु प्रवृत्तियों या मौसम संबंधी किसी भी विषय के बारे में पूछें!",
    "सुप्रभात! ☀️ मैं WeatherGPT हूँ। आज मौसम के बारे में मैं आपकी कैसे मदद कर सकता हूँ?",
  ],
  ta: [
    "வணக்கம்! 👋 நான் WeatherGPT — Open-Meteo மற்றும் Gemini AI ஆல் இயக்கப்படும் உங்கள் வானிலை உதவியாளர். வானிலை, முன்னறிவிப்பு, காலநிலை போக்குகள் அல்லது வானியல் பற்றி எதையும் கேளுங்கள்!",
    "காலை வணக்கம்! ☀️ இன்று வானிலை பற்றி நான் எப்படி உதவலாம்?",
  ],
  te: [
    "నమస్కారం! 👋 నేను WeatherGPT — Open-Meteo మరియు Gemini AI ద్వారా నడిచే మీ వాతావరణ సహాయకుడు. వాతావరణం, అంచనాలు, వాతావరణ మార్పులు గురించి అడగండి!",
    "శుభోదయం! ☀️ ఈరోజు వాతావరణం గురించి మీకు ఎలా సహాయం చేయగలను?",
  ],
  kn: [
    "ನಮಸ್ಕಾರ! 👋 ನಾನು WeatherGPT — Open-Meteo ಮತ್ತು Gemini AI ನಿಂದ ನಡೆಸಲ್ಪಡುವ ನಿಮ್ಮ ಹವಾಮಾನ ಸಹಾಯಕ. ಹವಾಮಾನ, ಮುನ್ಸೂಚನೆ, ಹವಾಮಾನ ಬದಲಾವಣೆ ಬಗ್ಗೆ ಕೇಳಿ!",
    "ಶುಭೋದಯ! ☀️ ಇಂದು ಹವಾಮಾನದ ಬಗ್ಗೆ ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",
  ],
  ml: [
    "നമസ്കാരം! 👋 ഞാൻ WeatherGPT — Open-Meteo, Gemini AI ഉപയോഗിക്കുന്ന നിങ്ങളുടെ കാലാവസ്ഥ സഹായി. കാലാവസ്ഥ, പ്രവചനം, കാലാവസ്ഥാ വ്യതിയാനം എന്നിവയെ കുറിച്ച് ചോദിക്കൂ!",
    "സുപ്രഭാതം! ☀️ ഇന്ന് കാലാവസ്ഥ വിഷയത്തിൽ ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കാം?",
  ],
  mr: [
    "नमस्कार! 👋 मी WeatherGPT — Open-Meteo आणि Gemini AI द्वारे चालवलेला तुमचा हवामान सहाय्यक. हवामान, अंदाज, हवामानबदल याबद्दल विचारा!",
    "शुभ प्रभात! ☀️ आज हवामानाबद्दल मी तुम्हाला कसे मदत करू शकतो?",
  ],
  bn: [
    "নমস্কার! 👋 আমি WeatherGPT — Open-Meteo এবং Gemini AI দ্বারা চালিত আপনার আবহাওয়া সহকারী। আবহাওয়া, পূর্বাভাস, জলবায়ু পরিবর্তন বিষয়ে জিজ্ঞেস করুন!",
    "শুভ সকাল! ☀️ আজকের আবহাওয়া বিষয়ে আমি আপনাকে কীভাবে সাহায্য করতে পারি?",
  ],
  gu: [
    "નમસ્તે! 👋 હું WeatherGPT — Open-Meteo અને Gemini AI દ્વારા સંચાલિત તમારો હવામાન સહાયક. હવામાન, આગાહી, આબોહવા વિશે પૂછો!",
    "શુભ સવાર! ☀️ આજના હવામાન વિશે હું તમને કેવી રીતે મદદ કરી શકું?",
  ],
  pa: [
    "ਸਤ ਸ੍ਰੀ ਅਕਾਲ! 👋 ਮੈਂ WeatherGPT ਹਾਂ — Open-Meteo ਅਤੇ Gemini AI ਦੁਆਰਾ ਚਲਾਏ ਜਾਂਦੇ ਤੁਹਾਡੇ ਮੌਸਮ ਸਹਾਇਕ। ਮੌਸਮ, ਪੂਰਵ-ਅਨੁਮਾਨ, ਜਲਵਾਯੂ ਬਾਰੇ ਪੁੱਛੋ!",
    "ਸ਼ੁਭ ਸਵੇਰ! ☀️ ਅੱਜ ਦੇ ਮੌਸਮ ਬਾਰੇ ਮੈਂ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?",
  ],
  or: [
    "ନମସ୍କାର! 👋 ମୁଁ WeatherGPT — Open-Meteo ଏବଂ Gemini AI ଦ୍ୱାରା ପରିଚାଳିତ ଆପଣଙ୍କ ପାଣିପାଗ ସହାୟକ। ପାଣିପାଗ, ପୂର୍ବାନୁମାନ, ଜଳବାୟୁ ବିଷୟରେ ପଚାରନ୍ତୁ!",
    "ଶୁଭ ସକାଳ! ☀️ ଆଜି ପାଣିପାଗ ବିଷୟରେ ମୁଁ ଆପଣଙ୍କୁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି?",
  ],
}

function getFallbackGreeting(lang) {
  const replies = GREETING_FALLBACKS[lang] || GREETING_FALLBACKS.en
  return replies[Math.floor(Math.random() * replies.length)]
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCATION EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────
function extractLocationFromQuery(query, fallbackLocation, history = []) {
  if (!query || typeof query !== 'string') return fallbackLocation

  const q = query.toLowerCase()

  for (const loc of DEFAULT_LOCATIONS) {
    const regex = new RegExp(`\\b${loc.name}\\b`, 'i')
    if (regex.test(query)) return loc
  }

  const aliases = {
    bangalore: 'Bengaluru', trichy: 'Tiruchirappalli',
    bombay: 'Mumbai', madras: 'Chennai', calcutta: 'Kolkata',
  }
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (new RegExp(`\\b${alias}\\b`, 'i').test(q)) {
      const match = DEFAULT_LOCATIONS.find((l) => l.name.toLowerCase() === canonical.toLowerCase())
      if (match) return match
    }
  }

  const match = query.match(
    /\b(?:in|to|for|at)\s+([A-Za-z\s]+?)(?:\s+(?:today|tomorrow|tonight|this|and|should|what|is|how|next|\?|$))/i
  )
  if (match && match[1]) {
    const candidate = match[1].trim()
    if (candidate && candidate.length > 2 && !/^(the|a|my|our|current|this|here)$/i.test(candidate)) {
      const found = DEFAULT_LOCATIONS.find((l) => l.name.toLowerCase() === candidate.toLowerCase())
      if (found) return found
      return { name: candidate }
    }
  }

  if (Array.isArray(history) && history.length > 0) {
    const recent = history.slice(-4).reverse()
    for (const msg of recent) {
      const content = msg?.content || ''
      for (const loc of DEFAULT_LOCATIONS) {
        if (new RegExp(`\\b${loc.name}\\b`, 'i').test(content)) return loc
      }
    }
  }

  return fallbackLocation || DEFAULT_LOCATIONS[0]
}

// ─────────────────────────────────────────────────────────────────────────────
// SUSPICIOUS RESPONSE VALIDATION
// ─────────────────────────────────────────────────────────────────────────────
function isSuspiciousResponse(answer, weatherContext, locationName) {
  if (!answer || typeof answer !== 'string' || answer.trim().length < 20) {
    return { suspicious: true, reason: 'Answer is missing or too short' }
  }

  if (!weatherContext) {
    return { suspicious: false, reason: null }
  }

  const answerNumbers = [...answer.matchAll(/\b(\d+(?:\.\d+)?)\b/g)].map((m) => m[1])
  const contextNumbers = new Set(
    [...weatherContext.matchAll(/\b(\d+(?:\.\d+)?)\b/g)].map((m) => m[1])
  )

  const suspicious = answerNumbers.some((n) => {
    const num = parseFloat(n)
    if (num <= 10) return false
    return !contextNumbers.has(n)
  })

  if (suspicious) {
    return { suspicious: true, reason: 'Answer contains numbers not found in supplied weather context' }
  }

  return { suspicious: false, reason: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// MONGODB HISTORY HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const DB_HISTORY_LIMIT = 6

async function loadUserHistory(userId) {
  try {
    if (!userId || mongoose.connection.readyState !== 1) return []
    return await ChatHistory.getRecentMessages(userId, DB_HISTORY_LIMIT)
  } catch (err) {
    console.warn('Failed to load chat history from MongoDB:', err.message)
    return []
  }
}

async function saveConversationTurn(userId, userMessage, assistantMessage, language = 'en') {
  try {
    if (!userId || mongoose.connection.readyState !== 1) return
    await ChatHistory.appendMessages(userId, [
      { role: 'user', content: userMessage, language, timestamp: new Date() },
      { role: 'assistant', content: assistantMessage, language, timestamp: new Date() },
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
    const {
      message,
      location: clientLocation,
      conversationHistory: clientHistory = [],
      preferredLanguage: clientPreferredLang = null,
    } = req.body

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ success: false, message: 'Message is required.' })
    }

    const query = message.trim()
    const userId = req.user?._id || null

    // ── 1. LANGUAGE DETECTION & RESOLUTION ──────────────────────────────────
    const detectedLanguage = await detectLanguage(query)

    // Prefer: client-sent preference > user's DB preference > detected > 'en'
    const dbPreferredLang = req.user?.preferredLanguage || null
    const preferredLanguage = clientPreferredLang || dbPreferredLang || null
    const responseLanguage = resolveResponseLanguage(preferredLanguage, detectedLanguage)

    // ── 2. GREETING DETECTION ────────────────────────────────────────────────
    const isPureGreeting = detectGreeting(query)
    const isGreetingWithWeather = !isPureGreeting && hasGreetingPrefix(query)

    if (isPureGreeting) {
      let greetingReply = getFallbackGreeting(responseLanguage)

      // If Gemini is available, generate a natural multilingual greeting
      if (isGeminiConfigured()) {
        const geminiGreeting = await generateGeminiResponse({
          query,
          responseLanguage,
          detectedLanguage,
          isConceptual: true,
        }).catch(() => null)
        if (geminiGreeting && geminiGreeting.trim().length > 20) {
          greetingReply = geminiGreeting
        }
      }

      return res.status(200).json({
        success: true,
        answer: greetingReply,
        enhancedByGemini: false,
        isGreeting: true,
        language: responseLanguage,
      })
    }

    // ── 3. DOMAIN BOUNDARY CHECK ─────────────────────────────────────────────
    const weatherRelated = isWeatherRelated(query, clientHistory)
    if (!weatherRelated) {
      return res.status(200).json({
        success: true,
        answer: getIrrelevantResponse(responseLanguage),
        enhancedByGemini: false,
        isIrrelevant: true,
        language: responseLanguage,
      })
    }

    // ── 4. LOAD MONGODB HISTORY ───────────────────────────────────────────────
    let dbHistory = []
    if (userId) {
      dbHistory = await loadUserHistory(userId)
    }
    const conversationHistory = userId ? dbHistory : clientHistory.slice(-DB_HISTORY_LIMIT)

    // ── 5. CONCEPTUAL WEATHER QUESTION CHECK ─────────────────────────────────
    const isConceptual = isConceptualWeatherQuery(query)
    if (isConceptual) {
      if (isGeminiConfigured()) {
        const geminiAnswer = await generateGeminiResponse({
          query,
          conversationHistory,
          isConceptual: true,
          responseLanguage,
          detectedLanguage,
        })
        if (geminiAnswer) {
          const { suspicious } = isSuspiciousResponse(geminiAnswer, null, null)
          let finalAnswer = geminiAnswer
          if (suspicious && isGeminiConfigured()) {
            const retry = await generateGeminiResponse({
              query, conversationHistory, isConceptual: true,
              responseLanguage, detectedLanguage,
              retryHint: 'Please provide a detailed, accurate meteorological explanation.',
            })
            if (retry && retry.trim().length >= 20) finalAnswer = retry
          }
          if (userId) await saveConversationTurn(userId, query, finalAnswer, responseLanguage)
          return res.status(200).json({
            success: true, answer: finalAnswer,
            source: 'WeatherGPT Meteorological Intelligence',
            enhancedByGemini: true, language: responseLanguage,
          })
        }
      }

      // Deterministic conceptual fallback (English only for now)
      let fallbackText = 'Weather forecasting relies on Numerical Weather Prediction (NWP) models that simulate the atmosphere using mathematical physics.'
      const lower = query.toLowerCase()
      if (/humidity/i.test(lower)) {
        fallbackText = 'Humidity is the concentration of water vapor present in the air. Relative humidity is expressed as a percentage of the maximum moisture the air can hold at that specific temperature.'
      } else if (/pressure/i.test(lower)) {
        fallbackText = 'Atmospheric pressure is the force exerted by the weight of the air column above a given point on Earth. Standard sea-level pressure is approximately 1013.25 hPa.'
      } else if (/ecmwf|nwp|model/i.test(lower)) {
        fallbackText = `An NWP (Numerical Weather Prediction) model is a computer simulation of the Earth's atmosphere. ECMWF IFS is one of the world's leading global NWP models, renowned for its accuracy in medium-range forecasting.`
      } else if (/rain probability/i.test(lower)) {
        fallbackText = 'Rain probability represents the likelihood that measurable precipitation will occur at a specific location during a given time period.'
      } else if (/heatwave/i.test(lower)) {
        fallbackText = 'A heatwave is a prolonged period of excessively hot weather. In plains, it is typically declared when maximum temperatures surpass 40 degrees C with significant positive departure from normal seasonal averages.'
      } else if (/wind chill/i.test(lower)) {
        fallbackText = 'Wind chill is the perceived decrease in air temperature felt by the body on exposed skin due to the flow of air.'
      }

      if (userId) await saveConversationTurn(userId, query, fallbackText, responseLanguage)
      return res.status(200).json({
        success: true, answer: fallbackText,
        source: 'WeatherGPT Knowledge Base',
        enhancedByGemini: false, language: responseLanguage,
      })
    }

    // ── 6. OUT-OF-RANGE FORECAST CHECK ───────────────────────────────────────
    const dayFarMatch = query.match(/(\d+)\s+days?\s+(?:from now|later|ahead|forecast)/i)
    if (dayFarMatch && parseInt(dayFarMatch[1], 10) > 7) {
      const rangeAnswer = `Numerical weather prediction models via Open-Meteo provide reliable daily forecasts up to 7 days ahead. A forecast for ${dayFarMatch[1]} days from now is beyond the available forecast range and cannot be calculated accurately.`
      if (userId) await saveConversationTurn(userId, query, rangeAnswer, responseLanguage)
      return res.status(200).json({ success: true, answer: rangeAnswer, enhancedByGemini: false, language: responseLanguage })
    }

    // ── 7. RESOLVE LOCATION & COORDINATES ────────────────────────────────────
    let targetLoc = extractLocationFromQuery(query, clientLocation, conversationHistory)
    if (!targetLoc?.latitude || !targetLoc?.longitude) {
      const geocoded = await geocodeLocation(targetLoc?.name || 'Chennai')
      if (geocoded) {
        targetLoc = { ...targetLoc, ...geocoded }
      } else {
        const noLocAnswer = `Weather data for "${targetLoc?.name || 'that location'}" is currently unavailable because the location could not be resolved. Please verify the city name or choose one from the location list.`
        if (userId) await saveConversationTurn(userId, query, noLocAnswer, responseLanguage)
        return res.status(200).json({ success: true, answer: noLocAnswer, enhancedByGemini: false, language: responseLanguage })
      }
    }

    // ── 8. HISTORICAL / CLIMATE TREND CHECK ──────────────────────────────────
    const isClimateQuery =
      /\b(climate|historical|history|trend|trends|past\s+\d+|last\s+\d+\s+years?|over\s+the\s+last|\b20\d\d\b|become\s+hotter|getting\s+hotter|weather\s+changed|changed\s+in|has.*changed)\b/i.test(query) &&
      !/today|tomorrow|tonight|current/i.test(query)

    let historicalAnalysis = null
    if (isClimateQuery) {
      try {
        const currentYear = new Date().getFullYear()
        const startYear = currentYear - 10
        const histData = await fetchHistoricalData(
          targetLoc.latitude, targetLoc.longitude,
          `${startYear}-01-01`, `${currentYear - 1}-12-31`
        )
        historicalAnalysis = analyzeHistoricalTrends(histData)
      } catch (err) {
        console.warn('Historical data fetch failed:', err.message)
      }
    }

    // ── 9. FETCH LIVE WEATHER DATA FROM OPEN-METEO ───────────────────────────
    let weatherData = null
    let snapshot = null
    try {
      weatherData = await fetchForecastWeather(targetLoc.latitude, targetLoc.longitude)
      snapshot = buildCurrentSnapshot(weatherData)
    } catch (err) {
      console.error('Open-Meteo fetch error:', err.message)
      const fetchErrAnswer = `I could not retrieve live weather data for ${targetLoc.name} from Open-Meteo right now. Please check your connection and try again.`
      if (userId) await saveConversationTurn(userId, query, fetchErrAnswer, responseLanguage)
      return res.status(200).json({ success: true, answer: fetchErrAnswer, enhancedByGemini: false, language: responseLanguage })
    }

    // ── 10. AUTHORITATIVE ENGINES (Risk, Advisory, Alerts) ───────────────────
    const requestedPeriod = /tomorrow|next day/i.test(query) ? 'tomorrow' : 'today'
    const metrics = extractPeriodMetrics(weatherData, snapshot, requestedPeriod)
    const risk = evaluateRisk(snapshot)
    const advisories = generateAdvisories(metrics, risk)
    const alerts = evaluateAlerts(weatherData)

    // ── 11. BUILD STRUCTURED WEATHER CONTEXT ─────────────────────────────────
    const weatherContext = buildStructuredWeatherContext({
      location: targetLoc, weatherData, snapshot,
      metrics, risk, advisories, alerts, historicalAnalysis,
    })

    // ── 12. GEMINI MULTILINGUAL RESPONSE GENERATION ───────────────────────────
    let answer = null
    let enhancedByGemini = false

    if (isGeminiConfigured()) {
      answer = await generateGeminiResponse({
        query,
        weatherContext,
        conversationHistory,
        isConceptual: false,
        responseLanguage,
        detectedLanguage,
      })
      if (answer) enhancedByGemini = true
    }

    // ── 13. SUSPICIOUS RESPONSE VALIDATION (one re-verification pass) ─────────
    if (answer && enhancedByGemini) {
      const { suspicious, reason } = isSuspiciousResponse(answer, weatherContext, targetLoc.name)
      if (suspicious) {
        console.warn(`[WeatherGPT] Suspicious response detected (${reason}). Retrying in ${responseLanguage}...`)
        const verifiedAnswer = await generateGeminiResponse({
          query, weatherContext, conversationHistory,
          isConceptual: false, responseLanguage, detectedLanguage,
          retryHint: `IMPORTANT: The previous response may have contained inaccurate data. Re-read the weather context carefully. Answer ONLY using the exact numbers and facts provided. Respond in ${responseLanguage}.`,
        })
        if (verifiedAnswer && verifiedAnswer.trim().length >= 20) {
          answer = verifiedAnswer
        } else {
          answer = null
          enhancedByGemini = false
        }
      }
    }

    // ── 14. DETERMINISTIC FALLBACK ────────────────────────────────────────────
    if (!answer) {
      answer = generateDeterministicFallback({
        query, locationName: targetLoc.name, metrics, snapshot,
        risk, advisories, weatherData, alerts, historicalAnalysis,
      })
      enhancedByGemini = false
    }

    // ── 15. SAVE TO MONGODB ───────────────────────────────────────────────────
    if (userId && answer) {
      await saveConversationTurn(userId, query, answer, responseLanguage)
    }

    return res.status(200).json({
      success: true,
      answer,
      source: 'Open-Meteo',
      nwpModel: weatherData?.model || 'ECMWF IFS',
      location: targetLoc.name,
      enhancedByGemini,
      language: responseLanguage,
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

async function getChatHistory(req, res) {
  try {
    const userId = req.user._id
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Database connection is unavailable.' })
    }
    const limit = parseInt(req.query.limit, 10) || 20
    const messages = await ChatHistory.getRecentMessages(userId, Math.min(limit, 100))
    return res.status(200).json({ success: true, messages, count: messages.length })
  } catch (err) {
    console.error('getChatHistory error:', err.message)
    return res.status(500).json({ success: false, message: 'Failed to retrieve chat history.' })
  }
}

async function clearChatHistory(req, res) {
  try {
    const userId = req.user._id
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Database connection is unavailable.' })
    }
    await ChatHistory.clearHistory(userId)
    return res.status(200).json({ success: true, message: 'Chat history cleared successfully.' })
  } catch (err) {
    console.error('clearChatHistory error:', err.message)
    return res.status(500).json({ success: false, message: 'Failed to clear chat history.' })
  }
}

module.exports = { handleChat, getChatHistory, clearChatHistory }
