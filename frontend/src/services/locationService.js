// Location Service: Handles browser geolocation, reverse geocoding, and worldwide city search.

const REVERSE_GEOCODE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client'
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse'
const OPEN_METEO_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'

/**
 * Promisified browser Geolocation API wrapper.
 * Requests the user's high-accuracy geographic position.
 */
export function getUserCoordinates(options = {}) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return reject({
        code: 'NOT_SUPPORTED',
        message: 'Location access is unavailable. Select a location manually to continue.',
      })
    }

    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
      ...options,
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
      },
      (error) => {
        // Map browser error codes to a user-friendly message without exposing technical internals
        let friendlyMessage = 'Location access is unavailable. Select a location manually to continue.'
        let code = 'UNKNOWN'

        switch (error.code) {
          case error.PERMISSION_DENIED:
            code = 'PERMISSION_DENIED'
            friendlyMessage = 'Location permission was denied. Select a location manually to continue.'
            break
          case error.POSITION_UNAVAILABLE:
            code = 'POSITION_UNAVAILABLE'
            friendlyMessage = 'Location access is unavailable. Select a location manually to continue.'
            break
          case error.TIMEOUT:
            code = 'TIMEOUT'
            friendlyMessage = 'Location request timed out. Select a location manually to continue.'
            break
          default:
            break
        }

        reject({ code, message: friendlyMessage })
      },
      defaultOptions
    )
  })
}

/**
 * Reverse geocodes latitude & longitude into a readable location name (city, state, country).
 * Uses BigDataCloud client API (free, CORS-enabled, no key needed) with Nominatim as fallback.
 */
export async function reverseGeocode(latitude, longitude) {
  // 1. Try BigDataCloud reverse geocoding client
  try {
    const url = `${REVERSE_GEOCODE_URL}?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      const city =
        data.city ||
        data.locality ||
        data.principalSubdivision ||
        data.lookupSource ||
        ''
      const state = data.principalSubdivision || ''
      const country = data.countryName || ''

      const name = city || (state ? `${state}` : `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`)
      return {
        name,
        city,
        state,
        country,
        formatted: [name, state, country].filter(Boolean).join(', '),
      }
    }
  } catch (err) {
    console.warn('BigDataCloud reverse geocode failed, attempting Nominatim fallback:', err)
  }

  // 2. Fallback to OpenStreetMap Nominatim
  try {
    const url = `${NOMINATIM_URL}?format=json&lat=${latitude}&lon=${longitude}&zoom=12&addressdetails=1`
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
      },
    })
    if (res.ok) {
      const data = await res.json()
      const addr = data.address || {}
      const city =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.county ||
        addr.suburb ||
        ''
      const state = addr.state || ''
      const country = addr.country || ''

      const name = city || state || `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`
      return {
        name,
        city,
        state,
        country,
        formatted: [name, state, country].filter(Boolean).join(', '),
      }
    }
  } catch (err) {
    console.warn('Nominatim reverse geocode fallback failed:', err)
  }

  // 3. Fallback coordinates representation
  const coordName = `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`
  return {
    name: coordName,
    city: coordName,
    state: '',
    country: '',
    formatted: coordName,
  }
}

/**
 * Searches locations worldwide using Open-Meteo Geocoding API.
 * Removes the limitation where only predefined cities are supported.
 */
export async function searchLocations(query, count = 6) {
  if (!query || query.trim().length < 2) return []

  try {
    const url = `${OPEN_METEO_GEOCODING_URL}?name=${encodeURIComponent(
      query.trim()
    )}&count=${count}&language=en&format=json`
    const res = await fetch(url)
    if (!res.ok) return []

    const data = await res.json()
    if (!data.results || !Array.isArray(data.results)) return []

    return data.results.map((item) => ({
      name: item.name,
      state: item.admin1 || item.admin2 || '',
      country: item.country || '',
      latitude: item.latitude,
      longitude: item.longitude,
      source: 'search',
      timezone: item.timezone,
    }))
  } catch (err) {
    console.error('Error searching locations:', err)
    return []
  }
}
