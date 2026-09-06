// WeatherGPT i18n Central Index
// Supports 11 Indian languages

import en from './en.js'
import hi from './hi.js'
import ta from './ta.js'
import te from './te.js'
import kn from './kn.js'
import ml from './ml.js'
import mr from './mr.js'
import bn from './bn.js'
import gu from './gu.js'
import pa from './pa.js'
import or from './or.js'

export const TRANSLATIONS = {
  en,
  hi,
  ta,
  te,
  kn,
  ml,
  mr,
  bn,
  gu,
  pa,
  or,
}

export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिंदी' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ' },
]

/**
 * Get translation for a key in the given language.
 * Falls back to English if the key is missing in the target language.
 *
 * @param {string} key
 * @param {string} lang - Language code ('en', 'hi', 'ta', etc.)
 * @returns {any}
 */
export function t(key, lang = 'en') {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.en
  if (dict && dict[key] !== undefined) {
    return dict[key]
  }
  return TRANSLATIONS.en[key] ?? key
}
