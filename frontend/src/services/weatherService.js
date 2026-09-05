// All Open-Meteo network calls live here. No API key is required.
// Later this can be swapped for a call to a FastAPI backend
// (e.g. POST /api/chat) without touching any component code —
// components should only ever import from this file, never call
// fetch() directly.

const BASE_URL = 'https://api.open-meteo.com/v1/forecast'

const HOURLY_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'precipitation_probability',
  'precipitation',
  'rain',
  'weather_code',
  'wind_speed_10m',
  'wind_direction_10m',
  'pressure_msl',
].join(',')

const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_probability_max',
  'precipitation_sum',
  'wind_speed_10m_max',
].join(',')

const CURRENT_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'precipitation',
  'rain',
  'weather_code',
  'is_day',
  'pressure_msl',
  'wind_speed_10m',
  'wind_direction_10m',
].join(',')

/**
 * Fetches hourly + daily forecast data for a given latitude/longitude.
 * Returns the raw Open-Meteo payload plus a couple of derived helpers.
 */
export async function fetchWeather(latitude, longitude) {
  const url = `${BASE_URL}?latitude=${latitude}&longitude=${longitude}&current=${CURRENT_FIELDS}&hourly=${HOURLY_FIELDS}&daily=${DAILY_FIELDS}&timezone=auto&forecast_days=7`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with status ${response.status}`)
  }

  const data = await response.json()
  return data
}

/**
 * Convenience helper: finds the array index in `hourly.time` closest to now.
 */
export function getCurrentHourIndex(hourly) {
  if (!hourly?.time?.length) return 0
  const now = Date.now()
  let closestIndex = 0
  let smallestDiff = Infinity

  hourly.time.forEach((isoString, index) => {
    const diff = Math.abs(new Date(isoString).getTime() - now)
    if (diff < smallestDiff) {
      smallestDiff = diff
      closestIndex = index
    }
  })

  return closestIndex
}

/**
 * Builds a compact "current conditions" snapshot from the raw hourly block.
 */
export function buildCurrentSnapshot(weatherData) {
  if (!weatherData?.hourly) return null
  const { hourly } = weatherData
  const idx = getCurrentHourIndex(hourly)

  return {
    time: hourly.time[idx],
    temperature: hourly.temperature_2m?.[idx],
    humidity: hourly.relative_humidity_2m?.[idx],
    precipitationProbability: hourly.precipitation_probability?.[idx],
    precipitation: hourly.precipitation?.[idx],
    rain: hourly.rain?.[idx],
    weatherCode: hourly.weather_code?.[idx],
    windSpeed: hourly.wind_speed_10m?.[idx],
    windDirection: hourly.wind_direction_10m?.[idx],
    pressure: hourly.pressure_msl?.[idx],
  }
}

/**
 * Builds a per-day summary array from the daily block, for the forecast page.
 */
export function buildDailySummaries(weatherData) {
  if (!weatherData?.daily) return []
  const { daily } = weatherData

  return daily.time.map((date, i) => ({
    date,
    weatherCode: daily.weather_code?.[i],
    tempMax: daily.temperature_2m_max?.[i],
    tempMin: daily.temperature_2m_min?.[i],
    precipitationProbability: daily.precipitation_probability_max?.[i],
    precipitationSum: daily.precipitation_sum?.[i],
    windSpeedMax: daily.wind_speed_10m_max?.[i],
  }))
}
