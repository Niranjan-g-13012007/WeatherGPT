// WeatherGPT Chat Service (Frontend)
//
// Sends chat queries to the WeatherGPT backend API (POST /api/chat).
// The backend combines Open-Meteo live weather data with Gemini for natural reasoning.
//
// If the backend is unreachable or returns an error, this service falls back
// to the existing client-side deterministic response engine to ensure 100% uptime.

import { generateResponse, resolveTargetLocation } from '../utils/chatbot.js'
import { fetchWeather, buildCurrentSnapshot } from './weatherService.js'
import { LOCATIONS } from '../data/locations.js'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/**
 * Send a chat message to the WeatherGPT backend.
 *
 * @param {object} params
 * @param {string} params.message - The user question
 * @param {object} params.location - Current selected location { name, latitude, longitude }
 * @param {Array} params.conversationHistory - Recent messages
 * @param {object} [params.weatherData] - Client cached weather data
 * @param {object} [params.snapshot] - Client cached snapshot
 * @param {string} [params.preferredLanguage] - User's preferred language code
 * @returns {Promise<{ answer: string, enhancedByGemini: boolean, source?: string, nwpModel?: string }>}
 */
export async function sendChatMessage({
  message,
  location,
  conversationHistory = [],
  weatherData = null,
  snapshot = null,
  preferredLanguage = null,
}) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        message,
        location: {
          name: location?.name || 'Chennai',
          latitude: location?.latitude,
          longitude: location?.longitude,
        },
        conversationHistory,
        preferredLanguage,
      }),
    })

    if (res.ok) {
      const data = await res.json()
      if (data && data.success && data.answer) {
        return {
          answer: data.answer,
          enhancedByGemini: Boolean(data.enhancedByGemini),
          source: data.source || 'Open-Meteo',
          nwpModel: data.nwpModel || 'ECMWF IFS',
          location: data.location || location?.name,
        }
      }
    }
  } catch (backendErr) {
    console.warn('Backend /api/chat unreachable, falling back to local engine:', backendErr.message)
  }

  // Graceful client-side fallback if backend is offline or fails
  try {
    const targetLocation = await resolveTargetLocation(message, location, LOCATIONS)
    let activeLocationName = location?.name || 'Chennai'
    let activeWeatherData = weatherData
    let activeSnapshot = snapshot

    const isCustomLocation =
      targetLocation &&
      targetLocation.name &&
      targetLocation.name.toLowerCase() !== (location?.name || '').toLowerCase()

    if (
      isCustomLocation &&
      targetLocation.latitude != null &&
      targetLocation.longitude != null
    ) {
      activeLocationName = targetLocation.name
      activeWeatherData = await fetchWeather(
        targetLocation.latitude,
        targetLocation.longitude
      )
      activeSnapshot = buildCurrentSnapshot(activeWeatherData)
    }

    const localAnswer = await generateResponse(
      message,
      activeWeatherData,
      activeLocationName,
      activeSnapshot,
      LOCATIONS
    )

    return {
      answer: localAnswer,
      enhancedByGemini: false,
      source: 'Open-Meteo (Local Engine)',
      nwpModel: 'ECMWF IFS',
      location: activeLocationName,
    }
  } catch (localErr) {
    console.error('Local fallback failed:', localErr)
    return {
      answer:
        "I couldn't fetch live weather data for that location right now. Please check your network connection and try again.",
      enhancedByGemini: false,
    }
  }
}

/**
 * Fetch recent chat history for the authenticated user from the backend.
 *
 * @param {number} [limit=50] - Max number of messages to retrieve
 * @returns {Promise<Array<{role: string, content: string, timestamp: string}>>}
 */
export async function getChatHistory(limit = 50) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/history?limit=${limit}`, {
      method: 'GET',
      credentials: 'include',
    })
    if (res.ok) {
      const data = await res.json()
      if (data && data.success && Array.isArray(data.messages)) {
        return data.messages
      }
    }
  } catch (err) {
    console.warn('Failed to load chat history:', err.message)
  }
  return []
}

/**
 * Clear all chat history for the authenticated user.
 *
 * @returns {Promise<boolean>} - true if cleared successfully
 */
export async function clearChatHistory() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/history`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (res.ok) {
      const data = await res.json()
      return Boolean(data?.success)
    }
  } catch (err) {
    console.warn('Failed to clear chat history:', err.message)
  }
  return false
}

/**
 * Update the user's preferred language on the backend.
 *
 * @param {string} language - 2-letter language code (e.g. 'hi', 'ta', 'en')
 * @returns {Promise<boolean>}
 */
export async function updatePreferredLanguage(language) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/user/preferences/language`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ language }),
    })
    if (res.ok) {
      const data = await res.json()
      return Boolean(data?.success)
    }
  } catch (err) {
    console.warn('Failed to update user language preference:', err.message)
  }
  return false
}

/**
 * Get user preferences from the backend.
 *
 * @returns {Promise<{ preferredLanguage?: string }|null>}
 */
export async function getUserPreferences() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/user/preferences`, {
      method: 'GET',
      credentials: 'include',
    })
    if (res.ok) {
      const data = await res.json()
      return data?.preferences || null
    }
  } catch (err) {
    console.warn('Failed to fetch user preferences:', err.message)
  }
  return null
}
