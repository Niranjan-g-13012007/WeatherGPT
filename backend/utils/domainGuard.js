// WeatherGPT Domain Guard
//
// Strictly enforces WeatherGPT domain boundaries:
// 1. Rejects out-of-domain queries with standard refusal message.
// 2. Classifies conceptual meteorological queries (answered by Gemini directly).
// 3. Classifies live/forecast weather queries (requires Open-Meteo data first).
// 4. Supports conversational follow-ups in weather context.

const IRRELEVANT_RESPONSE =
  'I can answer only on weather-related things. Please ask me something about weather, forecasts, climate, alerts, or related topics.'

// Core meteorological and weather keywords
const WEATHER_KEYWORDS = [
  'weather',
  'forecast',
  'forecasting',
  'temperature',
  'temp',
  'hot',
  'cold',
  'heat',
  'heatwave',
  'chilly',
  'warm',
  'cool',
  'freeze',
  'freezing',
  'frost',
  'rain',
  'raining',
  'rainfall',
  'precip',
  'precipitation',
  'shower',
  'showers',
  'drizzle',
  'monsoon',
  'downpour',
  'flood',
  'puddle',
  'humid',
  'humidity',
  'moisture',
  'dew',
  'dew point',
  'wind',
  'windy',
  'breeze',
  'gust',
  'gusts',
  'gale',
  'wind chill',
  'pressure',
  'atmospheric',
  'barometric',
  'isobar',
  'cloud',
  'clouds',
  'cloudy',
  'overcast',
  'sunny',
  'sunshine',
  'clear sky',
  'uv',
  'uv index',
  'solar radiation',
  'fog',
  'foggy',
  'mist',
  'haze',
  'smog',
  'storm',
  'storms',
  'thunderstorm',
  'thunder',
  'lightning',
  'cyclone',
  'hurricane',
  'typhoon',
  'tornado',
  'squall',
  'hail',
  'snow',
  'snowfall',
  'blizzard',
  'sleet',
  'umbrella',
  'raincoat',
  'sunscreen',
  'advisory',
  'advisories',
  'alert',
  'alerts',
  'warning',
  'warnings',
  'climate',
  'climatic',
  'meteorology',
  'meteorological',
  'nwp',
  'ecmwf',
  'ifs',
  'gfs',
  'reanalysis',
  'era5',
  'open-meteo',
  'model',
  'atmosphere',
  'travel',
  'trip',
  'commute',
  'journey',
  'drive',
  'driving',
  'outdoor',
  'outdoors',
  'outside',
  'go out',
  'step out',
  'irrigate',
  'irrigation',
  'crop',
  'crops',
  'farming',
  'farm',
  'harvest',
  'sow',
  'sowing',
]

// Common irrelevant patterns (code generation, math, trivia, cooking, sports, politics)
const IRRELEVANT_PATTERNS = [
  /\b(write|generate|code|program|script|function|class)\s+(?:me\s+)?(?:a\s+)?(?:python|java|c\+\+|c#|javascript|typescript|html|css|sql|rust|php|ruby|react)\b/i,
  /\b(who is|who was)\s+(?:the\s+)?(?:president|prime minister|governor|king|queen|actor|actress|singer|ceo|politician)\b/i,
  /\b(tell me|give me|crack)\s+(?:a\s+)?joke\b/i,
  /\b(recipe|how to cook|how to make|ingredients)\s+(?:for\s+)?(?:biryani|pizza|cake|pasta|curry|dosa|tea|coffee|food)\b/i,
  /\b(cricket|football|soccer|ipl|score|match|who won|world cup|champions trophy)\b/i,
  /^\s*(?:what is|solve|calculate)?\s*\d+\s*[\+\-\*\/x\^]\s*\d+\s*\??\s*$/i,
  /\b(capital of|population of|currency of|president of|prime minister of)\b/i,
  /\b(write|compose)\s+(?:me\s+)?(?:a\s+)?(?:poem|essay|song|rap|story|novel)\b/i,
  /\b(help with (?:my\s+)?homework|solve this math|essay on)\b/i,
]

// Common conceptual meteorological patterns (educational / definitions)
const CONCEPTUAL_PATTERNS = [
  /\bwhat\s+is\s+(?:an?\s+)?(?:humidity|atmospheric pressure|nwp|nwp model|ecmwf|heatwave|precipitation|wind chill|dew point|cold front|warm front|greenhouse effect|climate change|inversion|monsoon|cyclone|el nino|la nina|air mass|coriolis effect|weather forecast|weather model|relative humidity)\b/i,
  /\bwhat\s+does\s+(?:humidity|atmospheric pressure|rain probability|precipitation|wind chill|ecmwf|nwp)\s+mean\b/i,
  /\b(?:difference between|distinguish between)\s+(?:weather and climate|climate and weather|nwp and ml|gfs and ecmwf)\b/i,
  /\bhow\s+(?:is|are)\s+(?:weather\s+)?forecasts?\s+(?:generated|made|created|calculated)\b/i,
  /\bhow\s+do\s+(?:weather\s+)?models?\s+work\b/i,
  /\bwhy\s+(?:does it rain|is the sky blue|do clouds form|is humidity important)\b/i,
  /\bexplain\s+(?:the\s+)?(?:concept of\s+)?(?:humidity|atmospheric pressure|nwp|ecmwf|precipitation|heatwave|weather forecasting)\b/i,
]

// Conversational follow-up phrases that relate to weather when in context
const CONVERSATIONAL_FOLLOWUP_PATTERNS = [
  /\b(?:should i|do i need|carry|take|bring|wear)\s+(?:an?\s+)?(?:umbrella|raincoat|jacket|sweater|sunglasses|sunscreen|boots)\b/i,
  /\b(?:what about|how about|and)\s+(?:tomorrow|tonight|today|yesterday|the weekend|afternoon|morning|later)\b/i,
  /\b(?:is that|is it)\s+(?:safe|dangerous|too hot|too cold|too windy|okay|fine|recommended|advisable)\b/i,
  /\b(?:what should i do|what do you recommend|any precautions|what to do)\b/i,
  /\b(?:will it get|is it going to get)\s+(?:worse|better|hotter|colder|rainier)\b/i,
  /\b(?:then should i|can i still|should i postpone|should i delay)\b/i,
  /\b(?:why|why is that|tell me more|could you explain|what else)\b/i,
]

/**
 * Determine whether a query is weather-related.
 *
 * @param {string} query - The incoming user query
 * @param {Array} conversationHistory - Recent conversation messages [{ role, content }]
 * @returns {boolean}
 */
function isWeatherRelated(query, conversationHistory = []) {
  if (!query || typeof query !== 'string') return false
  const trimmed = query.trim()
  if (!trimmed) return false

  // 1. Check explicit irrelevant patterns first
  for (const pattern of IRRELEVANT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return false
    }
  }

  const lower = trimmed.toLowerCase()

  // 2. Check direct weather keywords
  for (const kw of WEATHER_KEYWORDS) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i')
    if (regex.test(lower)) {
      return true
    }
  }

  // 3. Check conceptual weather patterns
  for (const pattern of CONCEPTUAL_PATTERNS) {
    if (pattern.test(lower)) {
      return true
    }
  }

  // 4. Check conversational follow-ups
  for (const pattern of CONVERSATIONAL_FOLLOWUP_PATTERNS) {
    if (pattern.test(lower)) {
      return true
    }
  }

  // 5. Check if recent conversation context was about weather
  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    const recentMessages = conversationHistory.slice(-4)
    const contextHasWeather = recentMessages.some((msg) => {
      const content = (msg?.content || '').toLowerCase()
      return WEATHER_KEYWORDS.some((kw) => content.includes(kw))
    })

    if (contextHasWeather) {
      // If previous context is weather, allow short clarifying follow-ups
      if (
        /^(why|how so|what about it|and then|what else|is it safe|should i go|should i travel|can i go outside|really|tell me more|is that good|is that bad)\??$/i.test(
          lower
        ) ||
        /\b(travel|outside|outdoor|drive|trip|commute|go out|step out)\b/i.test(lower)
      ) {
        return true
      }
    }
  }

  return false
}

/**
 * Check if the query is a general/conceptual educational meteorological question
 * that does not require querying live Open-Meteo data.
 *
 * E.g., "What is humidity?" vs "What is the humidity in Chennai right now?"
 *
 * @param {string} query
 * @returns {boolean}
 */
function isConceptualWeatherQuery(query) {
  if (!query || typeof query !== 'string') return false
  const lower = query.toLowerCase().trim()

  // If query specifies a location or explicit time like "in Chennai", "today", "tomorrow", "right now",
  // it is NOT purely conceptual — it needs live data!
  const hasLiveIndicator =
    /\b(in\s+[a-z]+|at\s+[a-z]+|today|tomorrow|tonight|yesterday|now|right now|currently|this week|next week|weekend|forecast for|here)\b/i.test(
      lower
    )

  if (hasLiveIndicator) {
    return false
  }

  // Check matching conceptual patterns
  for (const pattern of CONCEPTUAL_PATTERNS) {
    if (pattern.test(lower)) {
      return true
    }
  }

  // Generic definitions
  if (
    /^(?:what is|what are|define|explain|meaning of)\s+(?:an?\s+)?(?:humidity|pressure|nwp|ecmwf|precipitation|temperature|wind chill|monsoon|cyclone|heatwave|dew point)\??$/i.test(
      lower
    )
  ) {
    return true
  }

  if (
    /^(?:what does|what do)\s+(?:humidity|rain probability|precipitation|wind chill|ecmwf|nwp)\s+mean\??$/i.test(
      lower
    )
  ) {
    return true
  }

  return false
}

module.exports = {
  IRRELEVANT_RESPONSE,
  isWeatherRelated,
  isConceptualWeatherQuery,
}
