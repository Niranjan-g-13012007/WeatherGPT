// WeatherGPT Domain Guard — Multilingual Edition
//
// Strictly enforces WeatherGPT domain boundaries:
// 1. Rejects out-of-domain queries with a multilingual refusal message.
// 2. Classifies conceptual meteorological queries (answered by Gemini directly).
// 3. Classifies live/forecast weather queries (requires Open-Meteo data first).
// 4. Supports conversational follow-ups in weather context.
// 5. Recognizes greetings in 11 Indian languages.

// ─── Multilingual Irrelevant Responses ──────────────────────────────────────
const IRRELEVANT_RESPONSES = {
  en: 'I can answer only on weather-related things. Please ask me something about weather, forecasts, climate, alerts, or related topics.',
  hi: 'मैं केवल मौसम से संबंधित सवालों का जवाब दे सकता हूँ। कृपया मौसम, पूर्वानुमान, जलवायु, अलर्ट या संबंधित विषयों के बारे में पूछें।',
  ta: 'நான் வானிலை தொடர்பான கேள்விகளுக்கு மட்டுமே பதிலளிக்க முடியும். வானிலை, முன்னறிவிப்பு, காலநிலை, எச்சரிக்கைகள் அல்லது தொடர்புடைய விஷயங்களைப் பற்றி கேளுங்கள்.',
  te: 'నేను వాతావరణానికి సంబంధించిన ప్రశ్నలకు మాత్రమే సమాధానం ఇవ్వగలను. వాతావరణం, అంచనాలు, వాతావరణ మార్పులు, హెచ్చరికలు లేదా సంబంధిత అంశాల గురించి అడగండి.',
  kn: 'ನಾನು ಹವಾಮಾನ ಸಂಬಂಧಿತ ಪ್ರಶ್ನೆಗಳಿಗೆ ಮಾತ್ರ ಉತ್ತರಿಸಬಲ್ಲೆ. ದಯವಿಟ್ಟು ಹವಾಮಾನ, ಮುನ್ಸೂಚನೆ, ಹವಾಮಾನ ಬದಲಾವಣೆ, ಎಚ್ಚರಿಕೆಗಳು ಅಥವಾ ಸಂಬಂಧಿತ ವಿಷಯಗಳ ಬಗ್ಗೆ ಕೇಳಿ.',
  ml: 'എനിക്ക് കാലാവസ്ഥ സംബന്ധമായ ചോദ്യങ്ങൾക്ക് മാത്രമേ ഉത്തരം നൽകാൻ കഴിയൂ. കാലാവസ്ഥ, പ്രവചനം, കാലാവസ്ഥാ വ്യതിയാനം, മുന്നറിയിപ്പുകൾ അല്ലെങ്കിൽ അനുബന്ധ വിഷയങ്ങളെ കുറിച്ച് ചോദിക്കൂ.',
  mr: 'मी फक्त हवामानाशी संबंधित प्रश्नांची उत्तरे देऊ शकतो. कृपया हवामान, अंदाज, हवामानबदल, सतर्कता किंवा संबंधित विषयांबद्दल विचारा.',
  bn: 'আমি কেবলমাত্র আবহাওয়া সম্পর্কিত প্রশ্নের উত্তর দিতে পারি। আবহাওয়া, পূর্বাভাস, জলবায়ু, সতর্কতা বা সম্পর্কিত বিষয়ে জিজ্ঞেস করুন।',
  gu: 'હું ફક્ત હવામાન સંબંધિત પ્રશ્નોના જ જવાબ આપી શકું છું. કૃપા કરી હવામાન, આગાહી, આબોહવા, ચેતવણી અથવા સંબંધિત વિષયો વિશે પૂછો.',
  pa: 'ਮੈਂ ਸਿਰਫ਼ ਮੌਸਮ ਨਾਲ ਜੁੜੇ ਸਵਾਲਾਂ ਦਾ ਜਵਾਬ ਦੇ ਸਕਦਾ ਹਾਂ। ਕਿਰਪਾ ਕਰਕੇ ਮੌਸਮ, ਪੂਰਵ-ਅਨੁਮਾਨ, ਜਲਵਾਯੂ, ਚੇਤਾਵਨੀਆਂ ਜਾਂ ਸੰਬੰਧਿਤ ਵਿਸ਼ਿਆਂ ਬਾਰੇ ਪੁੱਛੋ।',
  or: 'ମୁଁ କେବଳ ପାଣିପାଗ ସମ୍ବନ୍ଧୀୟ ପ୍ରଶ୍ନର ଉତ୍ତର ଦେଇପାରିବି। ଦୟାକରି ପାଣିପାଗ, ପୂର୍ବାନୁମାନ, ଜଳବାୟୁ, ସତର୍କତା ବା ସମ୍ବନ୍ଧିତ ବିଷୟ ବିଷୟରେ ପଚାରନ୍ତୁ।',
}

// Default English response for backwards compatibility
const IRRELEVANT_RESPONSE = IRRELEVANT_RESPONSES.en

/**
 * Get the irrelevant response in the appropriate language.
 * Falls back to English if the language is not supported.
 */
function getIrrelevantResponse(language = 'en') {
  return IRRELEVANT_RESPONSES[language] || IRRELEVANT_RESPONSES.en
}

// ─── Weather Keywords ────────────────────────────────────────────────────────
const WEATHER_KEYWORDS = [
  'weather', 'forecast', 'forecasting', 'temperature', 'temp', 'hot', 'cold',
  'heat', 'heatwave', 'chilly', 'warm', 'cool', 'freeze', 'freezing', 'frost',
  'rain', 'raining', 'rainfall', 'precip', 'precipitation', 'shower', 'showers',
  'drizzle', 'monsoon', 'downpour', 'flood', 'puddle', 'humid', 'humidity',
  'moisture', 'dew', 'dew point', 'wind', 'windy', 'breeze', 'gust', 'gusts',
  'gale', 'wind chill', 'pressure', 'atmospheric', 'barometric', 'isobar',
  'cloud', 'clouds', 'cloudy', 'overcast', 'sunny', 'sunshine', 'clear sky',
  'uv', 'uv index', 'solar radiation', 'fog', 'foggy', 'mist', 'haze', 'smog',
  'storm', 'storms', 'thunderstorm', 'thunder', 'lightning', 'cyclone',
  'hurricane', 'typhoon', 'tornado', 'squall', 'hail', 'snow', 'snowfall',
  'blizzard', 'sleet', 'umbrella', 'raincoat', 'sunscreen', 'advisory',
  'advisories', 'alert', 'alerts', 'warning', 'warnings', 'climate', 'climatic',
  'meteorology', 'meteorological', 'nwp', 'ecmwf', 'ifs', 'gfs', 'reanalysis',
  'era5', 'open-meteo', 'model', 'atmosphere', 'travel', 'trip', 'commute',
  'journey', 'drive', 'driving', 'outdoor', 'outdoors', 'outside', 'go out',
  'step out', 'irrigate', 'irrigation', 'crop', 'crops', 'farming', 'farm',
  'harvest', 'sow', 'sowing',
  // Common transliterated Indian language weather terms
  'mausam', 'baarish', 'barish', 'varsha', 'mazai', 'mazha', 'mala', 'pani',
  'garmi', 'sardi', 'thand', 'dhup', 'hawa', 'andhi', 'toofan', 'varish',
  'vaayu', 'vayu', 'megha', 'badal', 'baarish', 'nalaiku', 'iniku', 'kal',
]

// ─── Irrelevant Patterns ─────────────────────────────────────────────────────
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

// ─── Conceptual Weather Patterns ─────────────────────────────────────────────
const CONCEPTUAL_PATTERNS = [
  /\bwhat\s+is\s+(?:an?\s+)?(?:humidity|atmospheric pressure|nwp|nwp model|ecmwf|heatwave|precipitation|wind chill|dew point|cold front|warm front|greenhouse effect|climate change|inversion|monsoon|cyclone|el nino|la nina|air mass|coriolis effect|weather forecast|weather model|relative humidity)\b/i,
  /\bwhat\s+does\s+(?:humidity|atmospheric pressure|rain probability|precipitation|wind chill|ecmwf|nwp)\s+mean\b/i,
  /\b(?:difference between|distinguish between)\s+(?:weather and climate|climate and weather|nwp and ml|gfs and ecmwf)\b/i,
  /\bhow\s+(?:is|are)\s+(?:weather\s+)?forecasts?\s+(?:generated|made|created|calculated)\b/i,
  /\bhow\s+do\s+(?:weather\s+)?models?\s+work\b/i,
  /\bwhy\s+(?:does it rain|is the sky blue|do clouds form|is humidity important)\b/i,
  /\bexplain\s+(?:the\s+)?(?:concept of\s+)?(?:humidity|atmospheric pressure|nwp|ecmwf|precipitation|heatwave|weather forecasting)\b/i,
]

// ─── Conversational Follow-up Patterns ───────────────────────────────────────
const CONVERSATIONAL_FOLLOWUP_PATTERNS = [
  /\b(?:should i|do i need|carry|take|bring|wear)\s+(?:an?\s+)?(?:umbrella|raincoat|jacket|sweater|sunglasses|sunscreen|boots)\b/i,
  /\b(?:what about|how about|and|tell me about)\s+(?:the\s+)?(?:day after tomorrow|tomorrow|tonight|today|yesterday|the weekend|this weekend|next week|afternoon|morning|evening|later|coming days)\b/i,
  /\b(?:day after tomorrow|the day after tomorrow|day after)\b/i,
  /\b(?:is that|is it)\s+(?:safe|dangerous|too hot|too cold|too windy|okay|fine|recommended|advisable)\b/i,
  /\b(?:what should i do|what do you recommend|any precautions|what to do)\b/i,
  /\b(?:will it get|is it going to get)\s+(?:worse|better|hotter|colder|rainier)\b/i,
  /\b(?:then should i|can i still|should i postpone|should i delay)\b/i,
  /\b(?:why|why is that|tell me more|could you explain|what else)\b/i,
  /\b(?:which is better|which place is better|which one is better|which is hotter|which is cooler|which is colder|which is warmer)\b/i,
  /\b(?:compare|comparison|versus| vs | vs\. )\b/i,
  /\b(?:how has.*changed|changed.*years|over the years|past.*years|over the last)\b/i,
  // Regional language temporal & comparative follow-ups
  /\b(?:நாளை|நாளைக்கு|நாளை மறுநாள்|இன்று|இன்னைக்கு|நேற்று|ஒப்பீடு|ஒப்பிடுக|எது சிறந்தது)\b/,
  /\b(?:कल|परसों|आज|तुलना|मौसम|बारिश)\b/,
]

// ─── Multilingual Greeting Patterns ─────────────────────────────────────────
// These detect greetings in all 11 supported languages
const MULTILINGUAL_GREETING_PATTERNS = [
  // English
  /^\s*(hi|hello|hey|howdy|hiya|greetings|sup|what'?s up|yo)\s*[!.]?\s*$/i,
  /^\s*good\s+(morning|afternoon|evening|night|day)\s*[!.]?\s*$/i,
  /^\s*(hello there|hey there|hi there)\s*[!.]?\s*$/i,
  // Hindi / Marathi (Devanagari)
  /^\s*(नमस्ते|नमस्कार|सुप्रभात|शुभ\s*प्रभात|शुभ\s*संध्या|शुभ\s*रात्रि|प्रणाम|राम\s*राम)\s*[!।]?\s*$/,
  // Tamil
  /^\s*(வணக்கம்|காலை\s*வணக்கம்|மாலை\s*வணக்கம்|இரவு\s*வணக்கம்|நலம்)\s*[!.]?\s*$/,
  // Telugu
  /^\s*(నమస్కారం|నమస్కారములు|శుభోదయం|శుభ\s*సాయంత్రం|మంచి\s*రాత్రి)\s*[!.]?\s*$/,
  // Kannada
  /^\s*(ನಮಸ್ಕಾರ|ನಮಸ್ತೆ|ಶುಭೋದಯ|ಶುಭ\s*ಸಂಜೆ|ಶುಭ\s*ರಾತ್ರಿ)\s*[!.]?\s*$/,
  // Malayalam
  /^\s*(നമസ്കാരം|ഹലോ|സുപ്രഭാതം|ശുഭ\s*സന്ധ്യ|ശുഭ\s*രാത്രി)\s*[!.]?\s*$/,
  // Bengali
  /^\s*(নমস্কার|হ্যালো|শুভ\s*সকাল|শুভ\s*বিকেল|শুভ\s*রাত্রি|আদাব)\s*[!.]?\s*$/,
  // Gujarati
  /^\s*(નમસ્તે|નમસ્કાર|શુભ\s*સવાર|શુભ\s*સાંજ|શુભ\s*રાત્રિ)\s*[!.]?\s*$/,
  // Punjabi (Gurmukhi)
  /^\s*(ਸਤ\s*ਸ੍ਰੀ\s*ਅਕਾਲ|ਸਤਿ\s*ਸ੍ਰੀ\s*ਅਕਾਲ|ਨਮਸਕਾਰ|ਸ਼ੁਭ\s*ਸਵੇਰ|ਸ਼ੁਭ\s*ਸ਼ਾਮ)\s*[!.]?\s*$/,
  // Odia
  /^\s*(ନମସ୍କାର|ଶୁଭ\s*ସକାଳ|ଶୁଭ\s*ସନ୍ଧ୍ୟା|ଶୁଭ\s*ରାତ୍ରି|ଜୟ\s*ଜଗନ୍ନାଥ)\s*[!.]?\s*$/,
]

// ─── Greeting Detection ───────────────────────────────────────────────────────
/**
 * Detect if a query is a pure greeting (not combined with a weather question).
 * A greeting combined with a weather question (e.g. "Good morning, will it rain?")
 * should NOT be treated as a pure greeting.
 */
function detectGreeting(query) {
  if (!query || typeof query !== 'string') return false
  const trimmed = query.trim()
  for (const pattern of MULTILINGUAL_GREETING_PATTERNS) {
    if (pattern.test(trimmed)) return true
  }
  return false
}

/**
 * Detect if a query starts with a greeting but also contains a weather question.
 * Returns true for "Good morning, will it rain tomorrow?" — should process weather part.
 */
function hasGreetingPrefix(query) {
  if (!query || typeof query !== 'string') return false
  const trimmed = query.trim()
  // Check if query contains a greeting pattern but is not a pure greeting
  const greetingPrefixes = [
    /^(hi|hello|hey|howdy|good\s+(?:morning|afternoon|evening|day))[,!\s]+/i,
    /^(வணக்கம்|காலை\s*வணக்கம்)[,!\s]+/,
    /^(नमस्ते|नमस्कार|सुप्रभात)[,!।\s]+/,
    /^(నమస్కారం|శుభోదయం)[,!\s]+/,
    /^(ನಮಸ್ಕಾರ|ಶುಭೋದಯ)[,!\s]+/,
    /^(നമസ്കാരം|സുപ്രഭാതം)[,!\s]+/,
    /^(নমস্কার|শুভ\s*সকাল)[,!\s]+/,
    /^(ਸਤ\s*ਸ੍ਰੀ\s*ਅਕਾਲ|ਨਮਸਕਾਰ)[,!\s]+/,
    /^( નમસ્તે| નમસ્કાર)[,!\s]+/,
    /^(ନମସ୍କାର)[,!\s]+/,
  ]
  return greetingPrefixes.some((p) => p.test(trimmed))
}

// ─── Domain Classification ────────────────────────────────────────────────────

/**
 * Determine whether a query is weather-related.
 * For multilingual queries, we are more permissive — let Gemini handle
 * understanding since non-English text may not match English keywords.
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

  // 2. Check direct weather keywords (English + transliterated Indian terms)
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

  // 5. Non-ASCII / Indian script text — pass through to Gemini for domain checking
  // This handles Tamil, Telugu, Kannada, Malayalam, Devanagari, Bengali, etc.
  // We check if the text has significant non-ASCII content (likely an Indian language)
  const nonAsciiRatio = (trimmed.match(/[^\x00-\x7F]/g) || []).length / trimmed.length
  if (nonAsciiRatio > 0.3) {
    // Significant non-ASCII content — likely Indian language query
    // Pass through to domain check below; greeting detection handles pure greetings
    // We allow this through and let Gemini/backend determine domain
    return true
  }

  // 6. Transliterated mixed-language queries (e.g. "Chennai la nalaiku rain varuma?")
  // If the query contains a location and some weather-adjacent words, allow it
  const hasMixedLanguageIndicator = /\b(la|mein|ka|ki|ke|naa|varuma|hogi|rahega|aayega|irukka|irruku)\b/i.test(lower)
  if (hasMixedLanguageIndicator) {
    return true
  }

  // 7. Check if recent conversation context was about weather
  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    const recentMessages = conversationHistory.slice(-4)
    const contextHasWeather = recentMessages.some((msg) => {
      const content = (msg?.content || '').toLowerCase()
      return WEATHER_KEYWORDS.some((kw) => content.includes(kw))
    })

    if (contextHasWeather) {
      // If previous context is weather, allow short clarifying, temporal, or comparative follow-ups
      if (
        /^(why|how so|what about it|and then|what else|is it safe|should i go|should i travel|can i go outside|really|tell me more|is that good|is that bad)\??$/i.test(lower) ||
        /\b(travel|outside|outdoor|drive|trip|commute|go out|step out|safe|unsafe)\b/i.test(lower) ||
        /\b(?:day after|tomorrow|tonight|today|yesterday|weekend|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|evening|afternoon|later)\b/i.test(lower) ||
        /\b(?:which|better|worse|hotter|cooler|colder|warmer|compare|versus|vs)\b/i.test(lower) ||
        /\b(?:what about|how about|and then|what if)\b/i.test(lower)
      ) {
        return true
      }
      // Also allow short non-ASCII follow-ups if in weather context
      if (trimmed.length < 50 && nonAsciiRatio > 0.15) {
        return true
      }
    }
  }

  return false
}

/**
 * Check if the query is a general/conceptual educational meteorological question
 * that does not require querying live Open-Meteo data.
 */
function isConceptualWeatherQuery(query) {
  if (!query || typeof query !== 'string') return false
  const lower = query.toLowerCase().trim()

  const hasLiveIndicator =
    /\b(in\s+[a-z]+|at\s+[a-z]+|today|tomorrow|tonight|yesterday|now|right now|currently|this week|next week|weekend|forecast for|here)\b/i.test(lower)

  if (hasLiveIndicator) {
    return false
  }

  // If non-ASCII (Indian language), never classify as conceptual without live indicator
  // Let Gemini handle these naturally
  const nonAsciiRatio = (lower.match(/[^\x00-\x7F]/g) || []).length / lower.length
  if (nonAsciiRatio > 0.3) {
    return false
  }

  for (const pattern of CONCEPTUAL_PATTERNS) {
    if (pattern.test(lower)) {
      return true
    }
  }

  if (
    /^(?:what is|what are|define|explain|meaning of)\s+(?:an?\s+)?(?:humidity|pressure|nwp|ecmwf|precipitation|temperature|wind chill|monsoon|cyclone|heatwave|dew point)\??$/i.test(lower)
  ) {
    return true
  }

  if (
    /^(?:what does|what do)\s+(?:humidity|rain probability|precipitation|wind chill|ecmwf|nwp)\s+mean\??$/i.test(lower)
  ) {
    return true
  }

  return false
}

module.exports = {
  IRRELEVANT_RESPONSE,
  IRRELEVANT_RESPONSES,
  getIrrelevantResponse,
  isWeatherRelated,
  isConceptualWeatherQuery,
  detectGreeting,
  hasGreetingPrefix,
  MULTILINGUAL_GREETING_PATTERNS,
}
