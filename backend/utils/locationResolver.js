// WeatherGPT Multilingual Location Resolver
//
// Features:
// 1. Multilingual dictionary for Indian cities & regions (Tamil, Hindi, Telugu, Kannada, Malayalam, Bengali, etc.).
// 2. Suffix stripping for inflected city names (e.g. Tamil: சென்னையில் -> சென்னை, கோவையில் -> கோவை, ஊட்டிக்கு -> ஊட்டி).
// 3. Comparison query detection (e.g. "Compare Chennai and Ooty", "பெருந்துறை மற்றும் ஊட்டி ஒப்பீடு").
// 4. Fallback to Open-Meteo geocoding for unmapped cities.

const { DEFAULT_LOCATIONS, geocodeLocation } = require('../services/openMeteoService')

// ─────────────────────────────────────────────────────────────────────────────
// MULTILINGUAL CITY MAPPINGS & ALIASES
// Maps local script / transliterated city names to canonical English names
// ─────────────────────────────────────────────────────────────────────────────
const CITY_ALIASES = {
  // Tamil Nadu
  'chennai': 'Chennai',
  'madras': 'Chennai',
  'சென்னை': 'Chennai',
  'சென்னையில்': 'Chennai',
  'சென்னைக்கு': 'Chennai',
  'சென்னையின்': 'Chennai',
  'சென்னைல': 'Chennai',
  'chennaila': 'Chennai',
  'chennaiyil': 'Chennai',
  'chennaikku': 'Chennai',

  'perundurai': 'Perundurai',
  'பெருந்துறை': 'Perundurai',
  'பெருந்துறையில்': 'Perundurai',
  'பெருந்துறைக்கு': 'Perundurai',
  'பெருந்துறைல': 'Perundurai',
  'perunduraiyil': 'Perundurai',
  'perunduraiyla': 'Perundurai',

  'coimbatore': 'Coimbatore',
  'kovai': 'Coimbatore',
  'கோவை': 'Coimbatore',
  'கோவையில்': 'Coimbatore',
  'கோவைக்கு': 'Coimbatore',
  'கோவைல': 'Coimbatore',
  'கோயம்புத்தூர்': 'Coimbatore',
  'கோயம்புத்தூரில்': 'Coimbatore',
  'kovaila': 'Coimbatore',
  'kovaiyil': 'Coimbatore',

  'ooty': 'Ooty',
  'udhagamandalam': 'Ooty',
  'ஊட்டி': 'Ooty',
  'ஊட்டியில்': 'Ooty',
  'ஊட்டிக்கு': 'Ooty',
  'ஊட்டில': 'Ooty',
  'உதகமண்டலம்': 'Ooty',
  'ootyla': 'Ooty',
  'ootyil': 'Ooty',

  'madurai': 'Madurai',
  'மதுரை': 'Madurai',
  'மதுரையில்': 'Madurai',
  'மதுரைக்கு': 'Madurai',
  'மதுரைல': 'Madurai',
  'maduraila': 'Madurai',

  'salem': 'Salem',
  'சேலம்': 'Salem',
  'சேலத்தில்': 'Salem',
  'சேலத்துக்கு': 'Salem',
  'சேலம்ல': 'Salem',

  'erode': 'Erode',
  'ஈரோடு': 'Erode',
  'ஈரோட்டில்': 'Erode',
  'ஈரோட்டுக்கு': 'Erode',
  'ஈரோடுல': 'Erode',

  'tiruchirappalli': 'Tiruchirappalli',
  'trichy': 'Tiruchirappalli',
  'திருச்சி': 'Tiruchirappalli',
  'திருச்சியில்': 'Tiruchirappalli',
  'திருச்சிக்கு': 'Tiruchirappalli',
  'திருச்சிராப்பள்ளி': 'Tiruchirappalli',

  'tirunelveli': 'Tirunelveli',
  'nellai': 'Tirunelveli',
  'திருநெல்வேலி': 'Tirunelveli',
  'நெல்லை': 'Tirunelveli',

  'thanjavur': 'Thanjavur',
  'tanjore': 'Thanjavur',
  'தஞ்சாவூர்': 'Thanjavur',
  'தஞ்சாவூரில்': 'Thanjavur',

  'vellore': 'Vellore',
  'வேலூர்': 'Vellore',
  'வேலூரில்': 'Vellore',

  'tiruppur': 'Tiruppur',
  'திருப்பூர்': 'Tiruppur',
  'திருப்பூரில்': 'Tiruppur',

  'kodaikanal': 'Kodaikanal',
  'கொடைக்கானல்': 'Kodaikanal',
  'கொடைக்கானலில்': 'Kodaikanal',

  'dindigul': 'Dindigul',
  'திண்டுக்கல்': 'Dindigul',

  'kanchipuram': 'Kanchipuram',
  'காஞ்சிபுரம்': 'Kanchipuram',

  'kanyakumari': 'Kanyakumari',
  'கன்னியாகுமரி': 'Kanyakumari',

  'pondicherry': 'Puducherry',
  'puducherry': 'Puducherry',
  'பாண்டிச்சேரி': 'Puducherry',
  'புதுச்சேரி': 'Puducherry',

  // Other Major Indian Cities (Hindi / English / regional)
  'bengaluru': 'Bengaluru',
  'bangalore': 'Bengaluru',
  'பெங்களூரு': 'Bengaluru',
  'பெங்களூர்': 'Bengaluru',
  'பெங்களூரில்': 'Bengaluru',
  'बेंगलुरु': 'Bengaluru',
  'बैंगलोर': 'Bengaluru',
  'ಬೆಂಗಳೂರು': 'Bengaluru',
  'బెంగళూరు': 'Bengaluru',

  'mumbai': 'Mumbai',
  'bombay': 'Mumbai',
  'மும்பை': 'Mumbai',
  'மும்பையில்': 'Mumbai',
  'मुंबई': 'Mumbai',
  'ముంబై': 'Mumbai',

  'delhi': 'Delhi',
  'new delhi': 'Delhi',
  'டெல்லி': 'Delhi',
  'புது தில்லி': 'Delhi',
  'டெல்லியில்': 'Delhi',
  'दिल्ली': 'Delhi',
  'नई दिल्ली': 'Delhi',
  'ఢిల్లీ': 'Delhi',

  'hyderabad': 'Hyderabad',
  'ஹைதராபாத்': 'Hyderabad',
  'हैदराबाद': 'Hyderabad',
  'హైదరాబాద్': 'Hyderabad',

  'pune': 'Pune',
  'பூனே': 'Pune',
  'पुणे': 'Pune',

  'kolkata': 'Kolkata',
  'calcutta': 'Kolkata',
  'கொல்கத்தா': 'Kolkata',
  'कोलकाता': 'Kolkata',
  'কলকাতা': 'Kolkata',

  // Hindi aliases for cities
  'चेन्नई': 'Chennai',
  'पेरुंदुरई': 'Perundurai',
  'कोयंबटूर': 'Coimbatore',
  'ऊटी': 'Ooty',
  'मदुरै': 'Madurai',
  'सलेम': 'Salem',
  'इरोड': 'Erode',
  'तिरुचिरापल्ली': 'Tiruchirappalli',
}

// Suffixes in Tamil: -இல், -ல், -க்கு, -உக்கு, -ல, -யின், -இன்
const TAMIL_SUFFIX_REGEX = /(?:யில்|இல்|ல்|க்கு|உக்கு|ல|யின்|இன்)$/
// Suffixes in Telugu: -లో, -కి, -కు
const TELUGU_SUFFIX_REGEX = /(?:లో|కి|కు)$/
// Suffixes in Kannada: -ನಲ್ಲಿ, -ಗೆ
const KANNADA_SUFFIX_REGEX = /(?:ನಲ್ಲಿ|ಗೆ|ಕ್ಕೆ)$/
// Suffixes in Malayalam: -ൽ, -യിൽ, -ക്ക്
const MALAYALAM_SUFFIX_REGEX = /(?:ൽ|യിൽ|ക്ക്)$/

/**
 * Normalize and strip regional suffixes from a single token
 */
function cleanLocationToken(token) {
  if (!token || typeof token !== 'string') return ''
  let cleaned = token.trim().toLowerCase()

  // Strip punctuation
  cleaned = cleaned.replace(/[?,.!;:'"()[\]{}]/g, '')

  // Check direct alias first
  if (CITY_ALIASES[cleaned]) {
    return CITY_ALIASES[cleaned]
  }

  // Strip Tamil suffixes
  const strippedTamil = cleaned.replace(TAMIL_SUFFIX_REGEX, '')
  if (strippedTamil && CITY_ALIASES[strippedTamil]) {
    return CITY_ALIASES[strippedTamil]
  }

  // Strip Telugu suffixes
  const strippedTelugu = cleaned.replace(TELUGU_SUFFIX_REGEX, '')
  if (strippedTelugu && CITY_ALIASES[strippedTelugu]) {
    return CITY_ALIASES[strippedTelugu]
  }

  // Strip Kannada suffixes
  const strippedKannada = cleaned.replace(KANNADA_SUFFIX_REGEX, '')
  if (strippedKannada && CITY_ALIASES[strippedKannada]) {
    return CITY_ALIASES[strippedKannada]
  }

  // Strip Malayalam suffixes
  const strippedMalayalam = cleaned.replace(MALAYALAM_SUFFIX_REGEX, '')
  if (strippedMalayalam && CITY_ALIASES[strippedMalayalam]) {
    return CITY_ALIASES[strippedMalayalam]
  }

  // Transliterated English suffix stripping (e.g. chennaila -> chennai)
  const strippedTranslit = cleaned.replace(/(?:la|yil|yla|kku|il)$/i, '')
  if (strippedTranslit && CITY_ALIASES[strippedTranslit]) {
    return CITY_ALIASES[strippedTranslit]
  }

  return cleaned
}

/**
 * Match a canonical city name to a DEFAULT_LOCATIONS object or return { name: candidate }
 */
function matchCityToLocationObject(canonicalName) {
  if (!canonicalName) return null
  const found = DEFAULT_LOCATIONS.find(
    (l) => l.name.toLowerCase() === canonicalName.toLowerCase()
  )
  if (found) return found
  return { name: canonicalName }
}

/**
 * Detect all locations mentioned in a text query.
 * Returns an array of Location objects.
 */
function detectAllLocations(query) {
  if (!query || typeof query !== 'string') return []
  const q = query.trim()
  const found = new Map()

  // 1. Check known alias dictionary entries (longest first to handle multi-word like "new delhi")
  const aliasKeys = Object.keys(CITY_ALIASES).sort((a, b) => b.length - a.length)
  for (const key of aliasKeys) {
    const isLatin = /^[a-zA-Z\s]+$/.test(key)
    const regex = isLatin
      ? new RegExp(`\\b${key}\\b`, 'i')
      : new RegExp(key, 'i')

    if (regex.test(q)) {
      const canonical = CITY_ALIASES[key]
      if (!found.has(canonical.toLowerCase())) {
        found.set(canonical.toLowerCase(), matchCityToLocationObject(canonical))
      }
    }
  }

  // 2. Check tokens with suffix stripping
  const tokens = q.split(/[\s,./?!=;:]+/)
  for (const t of tokens) {
    if (!t || t.length < 2) continue
    const resolved = cleanLocationToken(t)
    if (resolved && CITY_ALIASES[resolved.toLowerCase()]) {
      const canonical = CITY_ALIASES[resolved.toLowerCase()]
      if (!found.has(canonical.toLowerCase())) {
        found.set(canonical.toLowerCase(), matchCityToLocationObject(canonical))
      }
    }
  }

  // 3. Check English preposition patterns: "in Chennai", "to Ooty", "for Salem", "at Madurai"
  const prepMatches = q.matchAll(/\b(?:in|to|for|at|between|from)\s+([A-Za-z\s]+?)(?:\s+(?:today|tomorrow|tonight|this|and|or|vs|versus|with|should|what|is|how|next|\?|$))/gi)
  for (const m of prepMatches) {
    const candidate = m[1]?.trim()
    if (candidate && candidate.length > 2 && !/^(the|a|my|our|current|this|here|weather)$/i.test(candidate)) {
      const canonical = cleanLocationToken(candidate)
      const locObj = matchCityToLocationObject(canonical || candidate)
      if (!found.has(locObj.name.toLowerCase())) {
        found.set(locObj.name.toLowerCase(), locObj)
      }
    }
  }

  return Array.from(found.values())
}

/**
 * Detect if a query is asking to compare two places.
 * Returns { isComparison: boolean, loc1: object|null, loc2: object|null }
 */
function detectComparisonQuery(query, defaultLoc = null, history = []) {
  if (!query || typeof query !== 'string') {
    return { isComparison: false, loc1: null, loc2: null }
  }

  const q = query.toLowerCase().trim()

  const comparisonKeywords = [
    'compare', 'comparison', 'versus', ' vs ', ' vs. ',
    'difference between', 'which is better', 'which place is better',
    'which is hotter', 'which is cooler', 'which is colder', 'which is warmer',
    'which one is better', 'which has better', 'better to travel',
    // Tamil comparison keywords
    'ஒப்பீடு', 'ஒப்பிடுக', 'எது சிறந்தது', 'எந்த இடம் சிறந்தது',
    'எங்கு மழை அதிகம்', 'எது குளிர்', 'எது வெப்பம்',
    // Hindi comparison keywords
    'तुलना', 'तुलना करें', 'दोनों में से', 'कौनसा बेहतर', 'कौन सा बेहतर', 'कौन सी जगह',
  ]

  const hasCompareKeyword = comparisonKeywords.some((kw) => q.includes(kw))
  const detectedLocations = detectAllLocations(query)

  // Explicit keyword + at least 1 or 2 locations
  if (hasCompareKeyword) {
    if (detectedLocations.length >= 2) {
      return {
        isComparison: true,
        loc1: detectedLocations[0],
        loc2: detectedLocations[1],
      }
    }

    if (detectedLocations.length === 1 && defaultLoc) {
      // e.g. "Compare with Ooty" -> loc1 = current location, loc2 = Ooty
      const loc1 = defaultLoc
      const loc2 = detectedLocations[0]
      if (loc1.name.toLowerCase() !== loc2.name.toLowerCase()) {
        return { isComparison: true, loc1, loc2 }
      }
    }
  }

  // Two locations joined by "vs", "versus", "or", "and" in context of weather
  if (detectedLocations.length >= 2) {
    const isJoinComparison = /\b(?:vs|versus|or|and|to)\b/i.test(q) ||
      /(?:மற்றும்|அல்லது)/.test(query) ||
      /(?:और|या)/.test(query)
    if (isJoinComparison) {
      return {
        isComparison: true,
        loc1: detectedLocations[0],
        loc2: detectedLocations[1],
      }
    }
  }

  return { isComparison: false, loc1: null, loc2: null }
}

/**
 * Extract single primary location from query.
 * Prioritizes query matches (multilingual) before falling back to history or default location.
 */
function extractLocationFromQuery(query, fallbackLocation = null, history = []) {
  if (!query || typeof query !== 'string') return fallbackLocation || DEFAULT_LOCATIONS[0]

  const detected = detectAllLocations(query)
  if (detected.length > 0) {
    return detected[0]
  }

  // If no location detected in current message, look back at recent conversation history
  if (Array.isArray(history) && history.length > 0) {
    const recent = history.slice(-4).reverse()
    for (const msg of recent) {
      const content = msg?.content || ''
      const histDetected = detectAllLocations(content)
      if (histDetected.length > 0) {
        return histDetected[0]
      }
    }
  }

  return fallbackLocation || DEFAULT_LOCATIONS[0]
}

module.exports = {
  CITY_ALIASES,
  cleanLocationToken,
  detectAllLocations,
  detectComparisonQuery,
  extractLocationFromQuery,
  matchCityToLocationObject,
}
