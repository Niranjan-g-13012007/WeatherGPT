// WeatherGPT Text-to-Speech (TTS) Engine — Multilingual Edition
//
// Powered by the browser Web Speech API (window.speechSynthesis).
// No external API keys or network dependencies required.
//
// Features:
// 1. Script-to-Language detection (Tamil, Hindi, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi, Odia, English).
// 2. Multilingual voice resolution matching regional Indian voices (Google தமிழ், Microsoft Pallavi/Valluvar, etc.).
// 3. Strict voice isolation: NEVER assigns an English voice to non-English text.
// 4. Regional weather unit expansion: converts symbols like °C, %, mm into native language words (e.g. 35°C -> 35 டிகிரி செல்சியஸ், 55% -> 55 சதவீதம்).
// 5. Clean text processor: strips markdown asterisks, hashes, backticks, emojis, variation selectors, and parenthesized English glosses.
// 6. Single-utterance coordinator with play/stop toggle behavior.

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const SCRIPT_LANG_MAP = [
  { regex: /[\u0B80-\u0BFF]/, code: 'ta', bcp47: 'ta-IN' }, // Tamil
  { regex: /[\u0C00-\u0C7F]/, code: 'te', bcp47: 'te-IN' }, // Telugu
  { regex: /[\u0C80-\u0CFF]/, code: 'kn', bcp47: 'kn-IN' }, // Kannada
  { regex: /[\u0D00-\u0D7F]/, code: 'ml', bcp47: 'ml-IN' }, // Malayalam
  { regex: /[\u0980-\u09FF]/, code: 'bn', bcp47: 'bn-IN' }, // Bengali
  { regex: /[\u0A80-\u0AFF]/, code: 'gu', bcp47: 'gu-IN' }, // Gujarati
  { regex: /[\u0A00-\u0A7F]/, code: 'pa', bcp47: 'pa-IN' }, // Punjabi
  { regex: /[\u0B00-\u0B7F]/, code: 'or', bcp47: 'or-IN' }, // Odia
  { regex: /[\u0900-\u097F]/, code: 'hi', bcp47: 'hi-IN' }, // Devanagari (Hindi/Marathi)
]

const BCP47_MAP = {
  ta: 'ta-IN',
  hi: 'hi-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  mr: 'mr-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
  pa: 'pa-IN',
  or: 'or-IN',
  en: 'en-IN',
}

const LANGUAGE_KEYWORDS = {
  ta: ['tamil', 'தமிழ்', 'valluvar', 'pallavi', 'ta-in'],
  hi: ['hindi', 'हिन्दी', 'swara', 'madhur', 'kalpana', 'hemant', 'hi-in'],
  te: ['telugu', 'తెలుగు', 'mohan', 'shruti', 'chitra', 'te-in'],
  kn: ['kannada', 'ಕನ್ನಡ', 'gagan', 'sapna', 'kn-in'],
  ml: ['malayalam', 'മലയാളം', 'midhun', 'sobhana', 'ml-in'],
  mr: ['marathi', 'मराठी', 'aarohi', 'manohar', 'mr-in'],
  bn: ['bengali', 'bangla', 'বাংলা', 'bashkar', 'tanishaa', 'bn-in'],
  gu: ['gujarati', 'ગુજરાતી', 'niranjan', 'dhwani', 'gu-in'],
  pa: ['punjabi', 'panjabi', 'ਪੰਜਾਬੀ', 'gurpreet', 'pa-in'],
  or: ['odia', 'oriya', 'ଓଡ଼ିଆ', 'or-in'],
  en: ['english', 'david', 'zira', 'george', 'susan', 'rishi', 'veena', 'en-in', 'en-us', 'en-gb'],
}

// Unit and symbol expansions in regional languages so speech synthesizers read naturally
const UNIT_EXPANSIONS = {
  ta: [
    [/(\d+(?:\.\d+)?)\s*°\s*C(?![a-zA-Z])/gi, '$1 டிகிரி செல்சியஸ்'],
    [/(\d+(?:\.\d+)?)\s*°(?![a-zA-Z])/gi, '$1 டிகிரி'],
    [/(\d+(?:\.\d+)?)\s*%/g, '$1 சதவீதம்'],
    [/(\d+(?:\.\d+)?)\s*(?:km\/h|kmph|kph)(?![a-zA-Z])/gi, '$1 மணிக்கு கிலோமீட்டர்'],
    [/(\d+(?:\.\d+)?)\s*mm(?![a-zA-Z])/gi, '$1 மில்லிமீட்டர்'],
    [/(\d+(?:\.\d+)?)\s*cm(?![a-zA-Z])/gi, '$1 சென்டிமீட்டர்'],
    [/கி\.?மீ\.?/g, 'கிலோமீட்டர்'],
    [/மி\.?மீ\.?/g, 'மில்லிமீட்டர்'],
  ],
  hi: [
    [/(\d+(?:\.\d+)?)\s*°\s*C(?![a-zA-Z])/gi, '$1 डिग्री सेल्सियस'],
    [/(\d+(?:\.\d+)?)\s*°(?![a-zA-Z])/gi, '$1 डिग्री'],
    [/(\d+(?:\.\d+)?)\s*%/g, '$1 प्रतिशत'],
    [/(\d+(?:\.\d+)?)\s*(?:km\/h|kmph|kph)(?![a-zA-Z])/gi, '$1 किलोमीटर प्रति घंटा'],
    [/(\d+(?:\.\d+)?)\s*mm(?![a-zA-Z])/gi, '$1 मिलीमीटर'],
    [/(\d+(?:\.\d+)?)\s*cm(?![a-zA-Z])/gi, '$1 सेंटीमीटर'],
    [/कि\.?मी\.?/g, 'किलोमीटर'],
    [/मि\.?मी\.?/g, 'मिलीमीटर'],
  ],
  te: [
    [/(\d+(?:\.\d+)?)\s*°\s*C(?![a-zA-Z])/gi, '$1 డిగ్రీల సెల్సియస్'],
    [/(\d+(?:\.\d+)?)\s*°(?![a-zA-Z])/gi, '$1 డిగ్రీలు'],
    [/(\d+(?:\.\d+)?)\s*%/g, '$1 శాతం'],
    [/(\d+(?:\.\d+)?)\s*(?:km\/h|kmph|kph)(?![a-zA-Z])/gi, '$1 కిలోమీటర్లు ప్రతి గంటకు'],
    [/(\d+(?:\.\d+)?)\s*mm(?![a-zA-Z])/gi, '$1 మిల్లీమీటర్లు'],
    [/(\d+(?:\.\d+)?)\s*cm(?![a-zA-Z])/gi, '$1 సెంటీమీటర్లు'],
    [/కి\.?మీ\.?/g, 'కిలోమీటర్లు'],
  ],
  kn: [
    [/(\d+(?:\.\d+)?)\s*°\s*C(?![a-zA-Z])/gi, '$1 ಡಿಗ್ರಿ ಸೆಲ್ಸಿಯಸ್'],
    [/(\d+(?:\.\d+)?)\s*°(?![a-zA-Z])/gi, '$1 ಡಿಗ್ರಿ'],
    [/(\d+(?:\.\d+)?)\s*%/g, '$1 ಪ್ರತಿಶತ'],
    [/(\d+(?:\.\d+)?)\s*(?:km\/h|kmph|kph)(?![a-zA-Z])/gi, '$1 ಕಿಲೋಮೀಟರ್ ಪ್ರತಿ ಗಂಟೆಗೆ'],
    [/(\d+(?:\.\d+)?)\s*mm(?![a-zA-Z])/gi, '$1 ಮಿಲಿಮೀಟರ್'],
    [/(\d+(?:\.\d+)?)\s*cm(?![a-zA-Z])/gi, '$1 ಸೆಂಟಿಮೀಟರ್'],
    [/ಕಿ\.?ಮೀ\.?/g, 'ಕಿಲೋಮೀಟರ್'],
  ],
  ml: [
    [/(\d+(?:\.\d+)?)\s*°\s*C(?![a-zA-Z])/gi, '$1 ഡിഗ്രി സെൽഷ്യസ്'],
    [/(\d+(?:\.\d+)?)\s*°(?![a-zA-Z])/gi, '$1 ഡിഗ്രി'],
    [/(\d+(?:\.\d+)?)\s*%/g, '$1 ശതമാനം'],
    [/(\d+(?:\.\d+)?)\s*(?:km\/h|kmph|kph)(?![a-zA-Z])/gi, '$1 കിലോമീറ്റർ മണിക്കൂറിൽ'],
    [/(\d+(?:\.\d+)?)\s*mm(?![a-zA-Z])/gi, '$1 മില്ലിമീറ്റർ'],
    [/(\d+(?:\.\d+)?)\s*cm(?![a-zA-Z])/gi, '$1 സെന്റിമീറ്റർ'],
    [/കി\.?മീ\.?/g, 'കിലോമീറ്റർ'],
  ],
  mr: [
    [/(\d+(?:\.\d+)?)\s*°\s*C(?![a-zA-Z])/gi, '$1 डिग्री सेल्सिअस'],
    [/(\d+(?:\.\d+)?)\s*°(?![a-zA-Z])/gi, '$1 डिग्री'],
    [/(\d+(?:\.\d+)?)\s*%/g, '$1 टक्के'],
    [/(\d+(?:\.\d+)?)\s*(?:km\/h|kmph|kph)(?![a-zA-Z])/gi, '$1 किमी प्रति तास'],
    [/(\d+(?:\.\d+)?)\s*mm(?![a-zA-Z])/gi, '$1 मिलिमीटर'],
    [/(\d+(?:\.\d+)?)\s*cm(?![a-zA-Z])/gi, '$1 सेंटीमीटर'],
    [/कि\.?मी\.?/g, 'किमी'],
    [/मि\.?மீ\.?/g, 'मिलीमीटर'],
  ],
  bn: [
    [/(\d+(?:\.\d+)?)\s*°\s*C(?![a-zA-Z])/gi, '$1 ডিগ্রি সেলসিয়াস'],
    [/(\d+(?:\.\d+)?)\s*°(?![a-zA-Z])/gi, '$1 ডিগ্রি'],
    [/(\d+(?:\.\d+)?)\s*%/g, '$1 শতাংশ'],
    [/(\d+(?:\.\d+)?)\s*(?:km\/h|kmph|kph)(?![a-zA-Z])/gi, '$1 কিলোমিটার প্রতি ঘণ্টা'],
    [/(\d+(?:\.\d+)?)\s*mm(?![a-zA-Z])/gi, '$1 মিলিমিটার'],
    [/(\d+(?:\.\d+)?)\s*cm(?![a-zA-Z])/gi, '$1 সেন্টিমিটার'],
    [/কি\.?মি\.?/g, 'কিলোমিটার'],
  ],
  gu: [
    [/(\d+(?:\.\d+)?)\s*°\s*C(?![a-zA-Z])/gi, '$1 ડિગ્રી સેલ્સિયસ'],
    [/(\d+(?:\.\d+)?)\s*°(?![a-zA-Z])/gi, '$1 ડિગ્રી'],
    [/(\d+(?:\.\d+)?)\s*%/g, '$1 ટકા'],
    [/(\d+(?:\.\d+)?)\s*(?:km\/h|kmph|kph)(?![a-zA-Z])/gi, '$1 કિલોમીટર પ્રતિ કલાક'],
    [/(\d+(?:\.\d+)?)\s*mm(?![a-zA-Z])/gi, '$1 મિલીમીટર'],
    [/(\d+(?:\.\d+)?)\s*cm(?![a-zA-Z])/gi, '$1 સેન્ટીમીટર'],
    [/કિ\.?મી\.?/g, 'કિલોમીટર'],
  ],
  pa: [
    [/(\d+(?:\.\d+)?)\s*°\s*C(?![a-zA-Z])/gi, '$1 ਡਿਗਰੀ ਸੈਲਸੀਅਸ'],
    [/(\d+(?:\.\d+)?)\s*°(?![a-zA-Z])/gi, '$1 ਡਿਗਰੀ'],
    [/(\d+(?:\.\d+)?)\s*%/g, '$1 ਪ੍ਰਤੀਸ਼ਤ'],
    [/(\d+(?:\.\d+)?)\s*(?:km\/h|kmph|kph)(?![a-zA-Z])/gi, '$1 ਕਿਲੋਮੀਟਰ ਪ੍ਰਤੀ ਘੰਟਾ'],
    [/(\d+(?:\.\d+)?)\s*mm(?![a-zA-Z])/gi, '$1 ਮਿਲੀਮੀਟਰ'],
    [/(\d+(?:\.\d+)?)\s*cm(?![a-zA-Z])/gi, '$1 ਸੈਂਟੀਮੀਟਰ'],
    [/ਕਿ\.?ਮੀ\.?/g, 'ਕਿਲੋਮੀਟਰ'],
  ],
  or: [
    [/(\d+(?:\.\d+)?)\s*°\s*C(?![a-zA-Z])/gi, '$1 ଡିଗ୍ରୀ ସେଲସିୟସ'],
    [/(\d+(?:\.\d+)?)\s*°(?![a-zA-Z])/gi, '$1 ଡିଗ୍ରୀ'],
    [/(\d+(?:\.\d+)?)\s*%/g, '$1 ପ୍ରତିଶତ'],
    [/(\d+(?:\.\d+)?)\s*(?:km\/h|kmph|kph)(?![a-zA-Z])/gi, '$1 କିଲୋମିଟର ପ୍ରତି ଘଣ୍ଟା'],
    [/(\d+(?:\.\d+)?)\s*mm(?![a-zA-Z])/gi, '$1 ମିଲିମିଟର'],
    [/(\d+(?:\.\d+)?)\s*cm(?![a-zA-Z])/gi, '$1 ସେଣ୍ଟିମିଟର'],
    [/କି\.?ମି\.?/g, 'କିଲୋମିଟର'],
  ],
  en: [
    [/(\d+(?:\.\d+)?)\s*°\s*C(?![a-zA-Z])/gi, '$1 degrees Celsius'],
    [/(\d+(?:\.\d+)?)\s*°(?![a-zA-Z])/gi, '$1 degrees'],
    [/(\d+(?:\.\d+)?)\s*%/g, '$1 percent'],
    [/(\d+(?:\.\d+)?)\s*(?:km\/h|kmph|kph)(?![a-zA-Z])/gi, '$1 kilometers per hour'],
    [/(\d+(?:\.\d+)?)\s*mm(?![a-zA-Z])/gi, '$1 millimeters'],
    [/(\d+(?:\.\d+)?)\s*cm(?![a-zA-Z])/gi, '$1 centimeters'],
  ],
}

/**
 * Detect language of the message text using Unicode script blocks.
 */
export function detectSpeechLanguage(text, preferredLang = 'en') {
  if (!text || typeof text !== 'string') return preferredLang || 'en'

  for (const entry of SCRIPT_LANG_MAP) {
    if (entry.regex.test(text)) {
      if (entry.code === 'hi' && preferredLang === 'mr') {
        return 'mr'
      }
      return entry.code
    }
  }

  return preferredLang || 'en'
}

/**
 * Clean response text before passing to speech synthesis:
 * - Expands weather units (°C, %, mm, km/h) into native language words
 * - Strips markdown symbols, asterisks, hashes, backticks, list bullets, emojis, and URLs
 * - Cleans parenthesized English glosses inside non-English text
 */
export function cleanTextForSpeech(text, langCode = 'en') {
  if (!text || typeof text !== 'string') return ''

  let cleaned = text

  // 1. If Indian language text contains parenthesized English like "(Light Drizzle)",
  // remove the parenthesized English so regional TTS reads smoothly without choking
  if (langCode !== 'en') {
    cleaned = cleaned.replace(/\s*\([A-Za-z\s\-]+\)/g, '')
  }

  // 2. Expand weather units for the specific language
  const expansions = UNIT_EXPANSIONS[langCode] || UNIT_EXPANSIONS.en
  for (const [pattern, replacement] of expansions) {
    cleaned = cleaned.replace(pattern, replacement)
  }

  // 3. Remove markdown syntax, emojis, and formatting
  cleaned = cleaned
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, ' ')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove markdown links: [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove headings: #, ##, ###, etc.
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold and italics
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove bullet points / lists: "* ", "- ", "1. ", "• "
    .replace(/^[\*\-\+•]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^[•]\s*/gm, '')
    // Remove blockquotes: "> "
    .replace(/^>\s+/gm, '')
    // Remove horizontal rules: --- or ***
    .replace(/^[\-\*]{3,}$/gm, '')
    // Remove emojis, pictographs, variation selectors, and symbol flags
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\uFE00-\uFE0F]/gu, ' ')
    // Remove web links / URLs
    .replace(/https?:\/\/\S+/g, '')
    // Remove standalone bullet character
    .replace(/•/g, '')
    // Clean multiple whitespace
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned
}

/**
 * Helper to pick the most natural sounding voice among matching candidates
 * (e.g. prefers Microsoft Natural / Edge Online / Google voices over standard robotic SAPI).
 */
function pickBestQualityVoice(candidates) {
  if (!candidates || candidates.length === 0) return null
  const natural = candidates.find((v) => {
    const n = (v.name || '').toLowerCase()
    return n.includes('natural') || n.includes('online') || n.includes('google')
  })
  return natural || candidates[0]
}

/**
 * Find best matching browser voice for the given language code.
 *
 * STRICT RULE: If langCode is non-English, NEVER return an English voice!
 * Returning null allows Chrome/Edge/Android to synthesize via cloud/native language pack
 * without being forced to use an English-only voice that skips Indian script.
 */
export function findBestVoice(langCode) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null

  const voices = window.speechSynthesis.getVoices()
  if (!voices || voices.length === 0) return null

  const targetBCP47 = (BCP47_MAP[langCode] || 'en-IN').toLowerCase()
  const prefix = targetBCP47.split('-')[0]
  const keywords = LANGUAGE_KEYWORDS[langCode] || [prefix]

  // 1. Exact BCP-47 match (e.g. "ta-in" or "ta_in")
  const exactMatches = voices.filter((v) => {
    const l = (v.lang || '').toLowerCase().replace('_', '-')
    return l === targetBCP47
  })
  if (exactMatches.length > 0) return pickBestQualityVoice(exactMatches)

  // 2. Language prefix match (e.g. "ta" or "ta-LK")
  const prefixMatches = voices.filter((v) => {
    const l = (v.lang || '').toLowerCase().replace('_', '-')
    return l === prefix || l.startsWith(`${prefix}-`)
  })
  if (prefixMatches.length > 0) return pickBestQualityVoice(prefixMatches)

  // 3. Name & URI keyword match (e.g. "Google தமிழ்", "Microsoft Pallavi Online", "Tamil")
  const keywordMatches = voices.filter((v) => {
    const name = (v.name || '').toLowerCase()
    const uri = (v.voiceURI || '').toLowerCase()
    return keywords.some((kw) => name.includes(kw) || uri.includes(kw))
  })
  if (keywordMatches.length > 0) return pickBestQualityVoice(keywordMatches)

  // 4. Regional script fallbacks:
  // Marathi -> Hindi (both use Devanagari script)
  if (langCode === 'mr') {
    const devanagariMatches = voices.filter((v) => {
      const l = (v.lang || '').toLowerCase()
      const n = (v.name || '').toLowerCase()
      return l.startsWith('hi') || n.includes('hindi') || n.includes('हिन्दी')
    })
    if (devanagariMatches.length > 0) return pickBestQualityVoice(devanagariMatches)
  }

  // Odia -> Bengali or Hindi
  if (langCode === 'or') {
    const regionalMatches = voices.filter((v) => {
      const l = (v.lang || '').toLowerCase()
      const n = (v.name || '').toLowerCase()
      return l.startsWith('bn') || l.startsWith('hi') || n.includes('bengali') || n.includes('hindi')
    })
    if (regionalMatches.length > 0) return pickBestQualityVoice(regionalMatches)
  }

  // 5. English voice matching (ONLY for English queries)
  if (langCode === 'en') {
    // Prefer Indian English voice if available
    const inMatches = voices.filter((v) => {
      const l = (v.lang || '').toLowerCase().replace('_', '-')
      return l === 'en-in'
    })
    if (inMatches.length > 0) return pickBestQualityVoice(inMatches)

    const enMatches = voices.filter((v) => (v.lang || '').toLowerCase().startsWith('en'))
    if (enMatches.length > 0) return pickBestQualityVoice(enMatches)

    return voices[0] || null
  }

  // 6. STRICT ISOLATION FOR NON-ENGLISH:
  // If no voice object for this non-English language is installed, return NULL.
  // Do NOT return Microsoft David or any English voice!
  // Setting utterance.voice = englishVoice breaks non-English TTS by dropping all native words!
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE-INSTANCE SPEECH CONTROLLER (HYBRID DUAL-ENGINE)
//
// 1. English: Uses the browser Web Speech API (David, Zira, etc.) with 0 latency.
// 2. Indian languages (Tamil, Hindi, Telugu, Kannada, Malayalam, Marathi, Bengali,
//    Gujarati, Punjabi, Odia): Streams studio-quality native speech via the backend
//    TTS proxy (/api/chat/tts), reading every sentence clearly and correctly.
// ─────────────────────────────────────────────────────────────────────────────
let activeSpeakingId = null
let activeAudio = null
let activeAudioBlobUrl = null
const stateListeners = new Set()

export function getActiveSpeakingId() {
  return activeSpeakingId
}

export function subscribeSpeechState(listener) {
  stateListeners.add(listener)
  return () => stateListeners.delete(listener)
}

function notifyStateChange(id) {
  activeSpeakingId = id
  stateListeners.forEach((fn) => {
    try {
      fn(id)
    } catch (err) {
      console.warn('Speech state listener error:', err)
    }
  })
}

/**
 * Stop any ongoing speech playback (audio element or Web Speech API).
 */
export function stopSpeech() {
  // 1. Stop active streaming audio
  if (activeAudio) {
    try {
      activeAudio.pause()
      activeAudio.src = ''
    } catch {
      // Ignore
    }
    activeAudio = null
  }

  // 2. Revoke active blob URL to prevent memory leaks
  if (activeAudioBlobUrl) {
    try {
      URL.revokeObjectURL(activeAudioBlobUrl)
    } catch {
      // Ignore
    }
    activeAudioBlobUrl = null
  }

  // 3. Stop browser Web Speech API
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel()
    } catch {
      // Ignore
    }
  }

  notifyStateChange(null)
}

// Eagerly trigger voice enumeration in browser
if (typeof window !== 'undefined' && window.speechSynthesis) {
  try {
    window.speechSynthesis.getVoices()
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices()
    }
  } catch {
    // Ignore
  }
}

/**
 * Play speech using browser Web Speech API (ideal for English).
 */
function speakWithWebSpeech(messageId, cleanText, langCode) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return

  const bcp47 = BCP47_MAP[langCode] || 'en-IN'
  const voice = findBestVoice(langCode)

  const utterance = new SpeechSynthesisUtterance(cleanText)
  utterance.lang = bcp47
  if (voice) {
    utterance.voice = voice
  }

  utterance.rate = 0.95
  utterance.pitch = 1.0

  utterance.onstart = () => {
    notifyStateChange(messageId)
  }

  utterance.onend = () => {
    if (activeSpeakingId === messageId) {
      notifyStateChange(null)
    }
  }

  utterance.onerror = () => {
    if (activeSpeakingId === messageId) {
      notifyStateChange(null)
    }
  }

  try {
    window.speechSynthesis.cancel()
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume()
    }
    window.speechSynthesis.speak(utterance)
  } catch (err) {
    console.warn('Web Speech API speak failed:', err)
    notifyStateChange(null)
  }
}

/**
 * Play speech using the backend streaming TTS proxy.
 * Speaks full native sentences for Tamil, Hindi, Telugu, Kannada, Malayalam, etc.
 */
async function playStreamAudio(messageId, cleanText, langCode) {
  try {
    notifyStateChange(messageId)

    // For moderate length texts (< 450 chars), stream directly via GET for minimal latency
    if (cleanText.length < 450) {
      const audioUrl = `${API_BASE_URL}/api/chat/tts?lang=${encodeURIComponent(
        langCode
      )}&text=${encodeURIComponent(cleanText)}`

      const audio = new Audio(audioUrl)
      activeAudio = audio

      audio.onplay = () => {
        notifyStateChange(messageId)
      }

      audio.onended = () => {
        if (activeSpeakingId === messageId) {
          activeAudio = null
          notifyStateChange(null)
        }
      }

      audio.onerror = (e) => {
        console.warn('Audio stream error, falling back to Web Speech API:', e)
        if (activeSpeakingId === messageId) {
          activeAudio = null
          speakWithWebSpeech(messageId, cleanText, langCode)
        }
      }

      await audio.play()
      return
    }

    // For longer responses, fetch as POST blob to prevent URL query string limit truncation
    const res = await fetch(`${API_BASE_URL}/api/chat/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText, lang: langCode }),
    })

    if (!res.ok) {
      throw new Error(`TTS server HTTP ${res.status}`)
    }

    const blob = await res.blob()
    // Check if user pressed stop while audio was downloading
    if (activeSpeakingId !== messageId) return

    const blobUrl = URL.createObjectURL(blob)
    activeAudioBlobUrl = blobUrl
    const audio = new Audio(blobUrl)
    activeAudio = audio

    audio.onended = () => {
      if (activeAudioBlobUrl) {
        URL.revokeObjectURL(activeAudioBlobUrl)
        activeAudioBlobUrl = null
      }
      if (activeSpeakingId === messageId) {
        activeAudio = null
        notifyStateChange(null)
      }
    }

    audio.onerror = () => {
      if (activeAudioBlobUrl) {
        URL.revokeObjectURL(activeAudioBlobUrl)
        activeAudioBlobUrl = null
      }
      if (activeSpeakingId === messageId) {
        activeAudio = null
        speakWithWebSpeech(messageId, cleanText, langCode)
      }
    }

    await audio.play()
  } catch (err) {
    console.warn('TTS streaming error, falling back to Web Speech:', err)
    if (activeSpeakingId === messageId) {
      activeAudio = null
      speakWithWebSpeech(messageId, cleanText, langCode)
    }
  }
}

/**
 * Speak the given message text. If this message is already speaking, stops it.
 */
export function toggleSpeak(messageId, text, preferredLang = 'en') {
  // If already playing this message, clicking stops it
  if (activeSpeakingId === messageId) {
    stopSpeech()
    return
  }

  // Stop any other active speech
  stopSpeech()

  // Detect language from text
  const detectedLang = detectSpeechLanguage(text, preferredLang)
  const clean = cleanTextForSpeech(text, detectedLang)
  if (!clean) return

  // 1. English: uses local Web Speech API (David, Zira, etc. work 100% offline with zero latency)
  if (detectedLang === 'en') {
    speakWithWebSpeech(messageId, clean, 'en')
    return
  }

  // 2. Indian & regional languages (Tamil, Hindi, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Odia):
  // Stream natural, native speech audio from the backend TTS proxy
  playStreamAudio(messageId, clean, detectedLang)
}
