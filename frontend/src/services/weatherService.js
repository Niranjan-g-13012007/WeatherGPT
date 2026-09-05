// All Open-Meteo network calls live here. No API key is required.
// Later this can be swapped for a call to a FastAPI backend
// (e.g. POST /api/chat) without touching any component code —
// components should only ever import from this file, never call
// fetch() directly.

const BASE_URL = 'https://api.open-meteo.com/v1/forecast'

export const NWP_MODELS = {
  ecmwf_ifs: {
    id: 'ecmwf_ifs',
    name: 'ECMWF IFS',
    type: 'Numerical Weather Prediction',
    provider: 'Open-Meteo',
    resolution: '0.25° (~25 km)',
    description:
      'ECMWF IFS (Integrated Forecasting System) is a leading global numerical weather prediction model operated by the European Centre for Medium-Range Weather Forecasts.',
    explanation:
      'NWP (Numerical Weather Prediction) models use mathematical and physical atmospheric models to simulate and forecast future weather conditions.',
  },
}

export const PRIMARY_NWP_MODEL = 'ecmwf_ifs'

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
 * Uses ECMWF IFS as primary NWP model through Open-Meteo.
 * Falls back gracefully to standard Open-Meteo forecast if model is unavailable.
 */
export async function fetchWeather(latitude, longitude, modelKey = PRIMARY_NWP_MODEL) {
  const modelConfig = NWP_MODELS[modelKey] || NWP_MODELS[PRIMARY_NWP_MODEL]
  const baseQuery = `latitude=${latitude}&longitude=${longitude}&current=${CURRENT_FIELDS}&hourly=${HOURLY_FIELDS}&daily=${DAILY_FIELDS}&timezone=auto&forecast_days=7`

  // 1. Attempt NWP model request
  try {
    const url = `${BASE_URL}?${baseQuery}&models=${modelConfig.id}`
    const response = await fetch(url)

    if (response.ok) {
      const data = await response.json()
      return {
        ...data,
        weatherData: data,
        model: modelConfig.name,
        modelType: modelConfig.type,
        modelId: modelConfig.id,
        provider: modelConfig.provider,
        resolution: modelConfig.resolution,
        modelDescription: modelConfig.description,
        modelExplanation: modelConfig.explanation,
        modelUnavailable: false,
      }
    }
  } catch (err) {
    console.warn(`NWP model (${modelConfig.name}) request failed, attempting fallback:`, err)
  }

  // 2. Graceful Fallback to standard Open-Meteo forecast
  try {
    const fallbackUrl = `${BASE_URL}?${baseQuery}`
    const fallbackRes = await fetch(fallbackUrl)

    if (!fallbackRes.ok) {
      throw new Error(`Open-Meteo request failed with status ${fallbackRes.status}`)
    }

    const fallbackData = await fallbackRes.json()
    return {
      ...fallbackData,
      weatherData: fallbackData,
      model: null,
      modelType: null,
      modelId: null,
      provider: 'Open-Meteo',
      modelDescription: 'Forecast model information is currently unavailable.',
      modelExplanation: modelConfig.explanation,
      modelUnavailable: true,
      modelMessage: 'Forecast model information is currently unavailable.',
    }
  } catch (err) {
    throw new Error(`Open-Meteo forecast failed: ${err.message}`)
  }
}

/**
 * Reusable helper: Extracts model metadata from weather data.
 */
export function getForecastModel(weatherData) {
  if (!weatherData) return null

  if (weatherData.model) {
    return {
      model: weatherData.model,
      modelType: weatherData.modelType || 'Numerical Weather Prediction',
      provider: weatherData.provider || 'Open-Meteo',
      resolution: weatherData.resolution || '0.25° (~25 km)',
      description: weatherData.modelDescription || NWP_MODELS[PRIMARY_NWP_MODEL].description,
      explanation: weatherData.modelExplanation || NWP_MODELS[PRIMARY_NWP_MODEL].explanation,
      isAvailable: true,
    }
  }

  if (weatherData.modelUnavailable) {
    return {
      model: null,
      modelType: null,
      isAvailable: false,
      message: weatherData.modelMessage || 'Forecast model information is currently unavailable.',
      explanation: NWP_MODELS[PRIMARY_NWP_MODEL].explanation,
    }
  }

  return null
}

/**
 * Reusable helper: Returns human-readable model description.
 */
export function getModelDescription(weatherData) {
  const info = getForecastModel(weatherData)
  if (!info || !info.isAvailable) {
    return 'Forecast model information is currently unavailable.'
  }
  return info.description
}

/**
 * Reusable helper: Returns standard NWP explanation text.
 */
export function getNwpExplanation() {
  return NWP_MODELS[PRIMARY_NWP_MODEL].explanation
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
export function buildCurrentSnapshot(data) {
  const weatherData = data?.weatherData || data
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
export function buildDailySummaries(data) {
  const weatherData = data?.weatherData || data
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
