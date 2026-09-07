// WeatherGPT TTS Controller
// Handles speech synthesis audio requests for all languages.

const { synthesizeSpeech } = require('../services/ttsService');

/**
 * Handle TTS speech synthesis request.
 * Supports both POST (body: { text, lang }) and GET (query: ?text=...&lang=...)
 */
async function handleTts(req, res) {
  try {
    const text = req.method === 'POST' ? req.body?.text : req.query?.text;
    const lang = (req.method === 'POST' ? req.body?.lang : req.query?.lang) || 'en';

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Text parameter is required for speech synthesis',
      });
    }

    const audioBuffer = await synthesizeSpeech(text.trim(), lang);

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    });

    return res.status(200).send(audioBuffer);
  } catch (err) {
    console.error('TTS synthesis controller error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to synthesize speech audio',
      error: err.message,
    });
  }
}

module.exports = {
  handleTts,
};
