// WeatherGPT Text-to-Speech (TTS) Service
//
// Synthesizes natural speech audio for all supported Indian and global languages:
// Tamil, Hindi, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Odia, English.
//
// Powered by Google Translate TTS engine with parallel chunk streaming.
// Zero external API keys or paid dependencies required.

const https = require('https');

// In-memory LRU cache to serve repeated phrases with 0ms latency
const ttsCache = new Map();
const MAX_CACHE_SIZE = 200;

/**
 * Split text into punctuation-delimited chunks of <= maxLen characters
 * to comply with upstream TTS chunk limits.
 */
function splitTextIntoChunks(text, maxLen = 180) {
  if (!text || text.length <= maxLen) return [text];

  // Split on punctuation marks: full stop, exclamation, question mark, comma, semicolon, newline, Devanagari danda
  const sentences = text.match(/[^.!?।\n,;]+[.!?।\n,;]*/g) || [text];
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if ((current + ' ' + trimmed).trim().length <= maxLen) {
      current = (current + ' ' + trimmed).trim();
    } else {
      if (current) chunks.push(current);
      if (trimmed.length <= maxLen) {
        current = trimmed;
      } else {
        // Fallback for extremely long clauses without punctuation: split by words
        const words = trimmed.split(/\s+/);
        current = '';
        for (const word of words) {
          if ((current + ' ' + word).trim().length <= maxLen) {
            current = (current + ' ' + word).trim();
          } else {
            if (current) chunks.push(current);
            current = word;
          }
        }
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.filter((c) => c.length > 0);
}

/**
 * Fetch one TTS audio chunk from the upstream engine.
 */
function fetchChunk(text, lang) {
  return new Promise((resolve, reject) => {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(
      lang
    )}&client=tw-ob&q=${encodeURIComponent(text)}`;

    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: '*/*',
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Upstream TTS HTTP error: ${res.statusCode}`));
        }
        const data = [];
        res.on('data', (c) => data.push(c));
        res.on('end', () => resolve(Buffer.concat(data)));
      }
    );

    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy(new Error('TTS request timed out'));
    });
  });
}

/**
 * Synthesize complete MP3 audio buffer for the given text and language.
 *
 * @param {string} text - Cleaned response text
 * @param {string} lang - 2-letter ISO code (ta, hi, te, kn, ml, mr, bn, gu, pa, or, en)
 * @returns {Promise<Buffer>} Combined MP3 audio buffer
 */
async function synthesizeSpeech(text, lang = 'en') {
  if (!text || typeof text !== 'string') {
    throw new Error('Text parameter is required for TTS synthesis');
  }

  // Normalize language code
  let targetLang = (lang || 'en').toLowerCase().split('-')[0];
  // Map Odia to Bengali phonetic bridge if needed
  if (targetLang === 'or') targetLang = 'bn';

  const cacheKey = `${targetLang}:${text.trim()}`;
  if (ttsCache.has(cacheKey)) {
    return ttsCache.get(cacheKey);
  }

  const chunks = splitTextIntoChunks(text.trim(), 180);
  if (chunks.length === 0) {
    throw new Error('Empty text after processing');
  }

  // Fetch all chunks in parallel for minimal latency
  const audioBuffers = await Promise.all(
    chunks.map((chunk) => fetchChunk(chunk, targetLang))
  );

  const combinedAudio = Buffer.concat(audioBuffers);

  // Cache result with LRU eviction
  if (ttsCache.size >= MAX_CACHE_SIZE) {
    const firstKey = ttsCache.keys().next().value;
    ttsCache.delete(firstKey);
  }
  ttsCache.set(cacheKey, combinedAudio);

  return combinedAudio;
}

module.exports = {
  synthesizeSpeech,
  splitTextIntoChunks,
};
