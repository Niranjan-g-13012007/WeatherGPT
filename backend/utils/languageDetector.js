// WeatherGPT Language Detector
//
// Uses franc-min (ESM) to detect the language of a text string.
// Maps ISO-639-3 codes returned by franc to WeatherGPT's supported 2-letter codes.
// Falls back to 'en' for unknown or unsupported languages.
//
// Supported output codes: en, hi, ta, te, kn, ml, mr, bn, gu, pa, or

const SUPPORTED_LANGS = new Set(['en', 'hi', 'ta', 'te', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'or'])

// franc ISO-639-3 → WeatherGPT language code mapping
const FRANC_TO_LANG = {
  // English
  eng: 'en',
  // Hindi (Devanagari)
  hin: 'hi',
  // Tamil
  tam: 'ta',
  // Telugu
  tel: 'te',
  // Kannada
  kan: 'kn',
  // Malayalam
  mal: 'ml',
  // Marathi (Devanagari, same script as Hindi — franc may classify as Hindi)
  mar: 'mr',
  // Bengali
  ben: 'bn',
  // Gujarati
  guj: 'gu',
  // Punjabi / Gurmukhi
  pan: 'pa',
  pnj: 'pa',
  // Odia
  ori: 'or',
  ory: 'or',
  // Romanized/transliterated — treat as message to Gemini in user's preferred lang
  // These fall through to 'und' → 'en' fallback
}

// Lazy-loaded franc instance (ESM module)
let _franc = null
async function getFranc() {
  if (!_franc) {
    const mod = await import('franc-min')
    _franc = mod.franc
  }
  return _franc
}

/**
 * Detect the language of a given text string.
 *
 * @param {string} text - The user's message
 * @returns {Promise<string>} - Language code: 'en' | 'hi' | 'ta' | 'te' | 'kn' | 'ml' | 'mr' | 'bn' | 'gu' | 'pa' | 'or'
 */
async function detectLanguage(text) {
  if (!text || typeof text !== 'string' || text.trim().length < 3) {
    return 'en'
  }

  try {
    const franc = await getFranc()

    // Only consider the scripts we support; whitelist keeps accuracy high
    const detected = franc(text.trim(), {
      minLength: 3,
      only: Object.keys(FRANC_TO_LANG),
    })

    if (detected && detected !== 'und' && FRANC_TO_LANG[detected]) {
      return FRANC_TO_LANG[detected]
    }

    // If franc returns 'und' (undetermined), try without the whitelist
    // This handles short messages and transliterated (Roman-script) text
    const detectedOpen = franc(text.trim(), { minLength: 3 })
    if (detectedOpen && detectedOpen !== 'und' && FRANC_TO_LANG[detectedOpen]) {
      return FRANC_TO_LANG[detectedOpen]
    }
  } catch (err) {
    console.warn('[LanguageDetector] franc detection failed:', err.message)
  }

  return 'en' // safe fallback
}

/**
 * Resolve the response language from multiple signals.
 *
 * Priority:
 * 1. User's manually set preferred language (highest — explicit choice)
 * 2. Detected language from the current message
 * 3. English fallback
 *
 * @param {string|null} preferredLanguage - From user profile / frontend selection
 * @param {string} detectedLanguage - From detectLanguage()
 * @returns {string} - Final response language code
 */
function resolveResponseLanguage(preferredLanguage, detectedLanguage) {
  if (preferredLanguage && SUPPORTED_LANGS.has(preferredLanguage)) {
    return preferredLanguage
  }
  if (detectedLanguage && SUPPORTED_LANGS.has(detectedLanguage)) {
    return detectedLanguage
  }
  return 'en'
}

/**
 * Get the full language name for a language code.
 */
const LANGUAGE_NAMES = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  kn: 'Kannada',
  ml: 'Malayalam',
  mr: 'Marathi',
  bn: 'Bengali',
  gu: 'Gujarati',
  pa: 'Punjabi',
  or: 'Odia',
}

function getLanguageName(code) {
  return LANGUAGE_NAMES[code] || 'English'
}

module.exports = { detectLanguage, resolveResponseLanguage, getLanguageName, SUPPORTED_LANGS }
