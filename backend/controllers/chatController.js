// WeatherGPT Chatbot Controller
//
// Coordinates:
// 1. Request validation
// 2. Domain guardrail filtering (irrelevant queries rejected immediately without calling Gemini)
// 3. Conceptual weather question handling
// 4. Authoritative location resolution & Open-Meteo data retrieval
// 5. Authoritative calculation engines (risk, advisories, alerts, climate)
// 6. Compact structured context construction
// 7. Gemini conversational intelligence generation
// 8. Robust deterministic fallback if Gemini is unconfigured or unavailable

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

/**
 * Extract target location name from user query or recent context.
 */
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

/**
 * Handle POST /api/chat
 */
async function handleChat(req, res) {
  try {
    const { message, location: clientLocation, conversationHistory = [] } = req.body

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Message is required.',
      })
    }

    const query = message.trim()

    // ------------------------------------------------------------------
    // 1. DOMAIN BOUNDARY CHECK (Irrelevant questions filtered out)
    // ------------------------------------------------------------------
    const weatherRelated = isWeatherRelated(query, conversationHistory)
    if (!weatherRelated) {
      return res.status(200).json({
        success: true,
        answer: IRRELEVANT_RESPONSE,
        enhancedByGemini: false,
        isIrrelevant: true,
      })
    }

    // ------------------------------------------------------------------
    // 2. CONCEPTUAL WEATHER QUESTION CHECK
    // (Definitions, educational concepts, NWP/ECMWF explanations)
    // ------------------------------------------------------------------
    const isConceptual = isConceptualWeatherQuery(query)
    if (isConceptual) {
      // If Gemini is available, generate an educational response
      if (isGeminiConfigured()) {
        const geminiAnswer = await generateGeminiResponse({
          query,
          conversationHistory,
          isConceptual: true,
        })
        if (geminiAnswer) {
          return res.status(200).json({
            success: true,
            answer: geminiAnswer,
            source: 'WeatherGPT Meteorological Intelligence',
            enhancedByGemini: true,
          })
        }
      }

      // Deterministic conceptual answers if Gemini is unavailable
      let fallbackText =
        'Weather forecasting relies on Numerical Weather Prediction (NWP) models that simulate the atmosphere using mathematical physics. Variables like temperature, humidity, atmospheric pressure, and wind are monitored to predict future atmospheric states.'
      const lower = query.toLowerCase()
      if (/humidity/i.test(lower)) {
        fallbackText =
          'Humidity is the concentration of water vapor present in the air. Relative humidity is expressed as a percentage of the maximum moisture the air can hold at that specific temperature. Higher humidity inhibits sweat evaporation, making warm temperatures feel significantly hotter.'
      } else if (/pressure/i.test(lower)) {
        fallbackText =
          'Atmospheric pressure is the force exerted by the weight of the air column above a given point on Earth. Standard sea-level pressure is approximately 1013.25 hPa. Rapidly falling pressure often signals approaching clouds, wind, and precipitation, while rising pressure typically indicates settling, clear conditions.'
      } else if (/ecmwf|nwp|model/i.test(lower)) {
        fallbackText =
          'An NWP (Numerical Weather Prediction) model is a computer simulation of the Earth’s atmosphere based on the laws of physics, fluid dynamics, and thermodynamics. ECMWF IFS (Integrated Forecasting System) is one of the world’s leading global NWP models, renowned for its accuracy in medium-range forecasting.'
      } else if (/rain probability/i.test(lower)) {
        fallbackText =
          'Rain probability (Probability of Precipitation) represents the likelihood that measurable precipitation (at least 0.1 mm) will occur at a specific location during a given time period, calculated as the product of forecast confidence and expected areal coverage.'
      } else if (/heatwave/i.test(lower)) {
        fallbackText =
          'A heatwave is a prolonged period of excessively hot weather, often accompanied by high humidity. In plains, it is typically declared when maximum temperatures surpass 40°C with significant positive departure from normal seasonal averages.'
      } else if (/wind chill/i.test(lower)) {
        fallbackText =
          'Wind chill is the perceived decrease in air temperature felt by the body on exposed skin due to the flow of air. Faster wind speeds strip away the thin layer of warmth around the skin, making cold weather feel substantially colder.'
      }

      return res.status(200).json({
        success: true,
        answer: fallbackText,
        source: 'WeatherGPT Knowledge Base',
        enhancedByGemini: false,
      })
    }

    // ------------------------------------------------------------------
    // 3. OUT-OF-RANGE FORECAST CHECK (Hallucination Prevention)
    // ------------------------------------------------------------------
    const dayFarMatch = query.match(/(\d+)\s+days?\s+(?:from now|later|ahead|forecast)/i)
    if (dayFarMatch && parseInt(dayFarMatch[1], 10) > 7) {
      return res.status(200).json({
        success: true,
        answer: `Numerical weather prediction models via Open-Meteo provide reliable daily forecasts up to 7 days ahead. A forecast for ${dayFarMatch[1]} days from now is beyond the available forecast range and cannot be calculated accurately.`,
        enhancedByGemini: false,
      })
    }

    // ------------------------------------------------------------------
    // 4. RESOLVE LOCATION & COORDINATES
    // ------------------------------------------------------------------
    let targetLoc = extractLocationFromQuery(
      query,
      clientLocation,
      conversationHistory
    )

    // Ensure coordinates exist
    if (!targetLoc?.latitude || !targetLoc?.longitude) {
      const geocoded = await geocodeLocation(targetLoc?.name || 'Chennai')
      if (geocoded) {
        targetLoc = { ...targetLoc, ...geocoded }
      } else {
        // Location could not be resolved or found
        return res.status(200).json({
          success: true,
          answer: `Weather data for "${targetLoc?.name || 'that location'}" is currently unavailable because the location could not be resolved. Please verify the city name or choose one from the location list.`,
          enhancedByGemini: false,
        })
      }
    }

    // ------------------------------------------------------------------
    // 5. HISTORICAL / CLIMATE TREND QUERY CHECK
    // ------------------------------------------------------------------
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

    // ------------------------------------------------------------------
    // 6. FETCH REAL LIVE WEATHER DATA FROM OPEN-METEO
    // ------------------------------------------------------------------
    let weatherData = null
    let snapshot = null
    try {
      weatherData = await fetchForecastWeather(
        targetLoc.latitude,
        targetLoc.longitude
      )
      snapshot = buildCurrentSnapshot(weatherData)
    } catch (err) {
      console.error('Open-Meteo fetch error:', err.message)
      return res.status(200).json({
        success: true,
        answer: `I could not retrieve live weather data for ${targetLoc.name} from Open-Meteo right now. Please check your connection and try again.`,
        enhancedByGemini: false,
      })
    }

    // ------------------------------------------------------------------
    // 7. RUN AUTHORITATIVE ENGINES (Risk, Advisory, Alerts)
    // ------------------------------------------------------------------
    const requestedPeriod = /tomorrow|next day/i.test(query) ? 'tomorrow' : 'today'
    const metrics = extractPeriodMetrics(weatherData, snapshot, requestedPeriod)
    const risk = evaluateRisk(snapshot)
    const advisories = generateAdvisories(metrics, risk)
    const alerts = evaluateAlerts(weatherData)

    // ------------------------------------------------------------------
    // 8. BUILD STRUCTURED WEATHER CONTEXT FOR GEMINI
    // ------------------------------------------------------------------
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

    // ------------------------------------------------------------------
    // 9. CALL GEMINI FOR NATURAL RESPONSE GENERATION
    // ------------------------------------------------------------------
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

    // ------------------------------------------------------------------
    // 10. FALLBACK TO DETERMINISTIC ENGINE IF GEMINI IS NOT AVAILABLE
    // ------------------------------------------------------------------
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

module.exports = {
  handleChat,
}
