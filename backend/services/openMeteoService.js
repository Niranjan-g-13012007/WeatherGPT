// WeatherGPT Open-Meteo Data Service (Backend)
//
// Grounded strictly in real Open-Meteo API data.
// Source of truth for all weather facts (ECMWF IFS NWP model & ERA5 Reanalysis).
// Open-Meteo = Source of Truth for weather observations and numerical forecasts.

const BASE_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const BASE_ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive'
const BASE_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'

const NWP_MODELS = {
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

const PRIMARY_NWP_MODEL = 'ecmwf_ifs'

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

const HISTORICAL_DAILY_FIELDS = [
  'temperature_2m_mean',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'wind_speed_10m_max',
  'relative_humidity_2m_mean',
].join(',')

const DEFAULT_LOCATIONS = [
  { name: 'Chennai', state: 'Tamil Nadu', latitude: 13.0827, longitude: 80.2707 },
  { name: 'Perundurai', state: 'Tamil Nadu', latitude: 11.2764, longitude: 77.5838 },
  { name: 'Coimbatore', state: 'Tamil Nadu', latitude: 11.0168, longitude: 76.9558 },
  { name: 'Madurai', state: 'Tamil Nadu', latitude: 9.9252, longitude: 78.1198 },
  { name: 'Salem', state: 'Tamil Nadu', latitude: 11.6643, longitude: 78.146 },
  { name: 'Erode', state: 'Tamil Nadu', latitude: 11.341, longitude: 77.7172 },
  { name: 'Tiruchirappalli', state: 'Tamil Nadu', latitude: 10.7905, longitude: 78.7047 },
  { name: 'Tirunelveli', state: 'Tamil Nadu', latitude: 8.7139, longitude: 77.7567 },
  { name: 'Thanjavur', state: 'Tamil Nadu', latitude: 10.787, longitude: 79.1378 },
  { name: 'Vellore', state: 'Tamil Nadu', latitude: 12.9165, longitude: 79.1325 },
  { name: 'Tiruppur', state: 'Tamil Nadu', latitude: 11.1085, longitude: 77.3411 },
  { name: 'Ooty', state: 'Tamil Nadu', latitude: 11.4064, longitude: 76.6932 },
  { name: 'Kodaikanal', state: 'Tamil Nadu', latitude: 10.2381, longitude: 77.4892 },
  { name: 'Dindigul', state: 'Tamil Nadu', latitude: 10.3673, longitude: 77.9803 },
  { name: 'Kanchipuram', state: 'Tamil Nadu', latitude: 12.8342, longitude: 79.7036 },
  { name: 'Kanyakumari', state: 'Tamil Nadu', latitude: 8.0883, longitude: 77.5385 },
  { name: 'Puducherry', state: 'Puducherry', latitude: 11.9416, longitude: 79.8083 },
  { name: 'Bengaluru', state: 'Karnataka', latitude: 12.9716, longitude: 77.5946 },
  { name: 'Mumbai', state: 'Maharashtra', latitude: 19.076, longitude: 72.8777 },
  { name: 'Delhi', state: 'Delhi', latitude: 28.6139, longitude: 77.209 },
  { name: 'Hyderabad', state: 'Telangana', latitude: 17.385, longitude: 78.4867 },
  { name: 'Pune', state: 'Maharashtra', latitude: 18.5204, longitude: 73.8567 },
  { name: 'Kolkata', state: 'West Bengal', latitude: 22.5726, longitude: 88.3639 },
]

// In-memory cache for forecast and historical data
const forecastCache = new Map()
const historicalCache = new Map()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Fetch real forecast data from Open-Meteo with ECMWF IFS model.
 */
async function fetchForecastWeather(latitude, longitude, modelKey = PRIMARY_NWP_MODEL) {
  const cacheKey = `${Number(latitude).toFixed(3)}_${Number(longitude).toFixed(3)}_${modelKey}`
  const cached = forecastCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }

  const modelConfig = NWP_MODELS[modelKey] || NWP_MODELS[PRIMARY_NWP_MODEL]
  const baseQuery = `latitude=${latitude}&longitude=${longitude}&current=${CURRENT_FIELDS}&hourly=${HOURLY_FIELDS}&daily=${DAILY_FIELDS}&timezone=auto&forecast_days=7`

  // 1. Attempt ECMWF IFS model
  try {
    const url = `${BASE_FORECAST_URL}?${baseQuery}&models=${modelConfig.id}`
    const response = await fetch(url)
    if (response.ok) {
      const data = await response.json()
      const result = {
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
      forecastCache.set(cacheKey, { timestamp: Date.now(), data: result })
      return result
    }
  } catch (err) {
    console.warn(`ECMWF IFS request failed for (${latitude}, ${longitude}):`, err.message)
  }

  // 2. Fallback to standard Open-Meteo forecast
  try {
    const fallbackUrl = `${BASE_FORECAST_URL}?${baseQuery}`
    const fallbackRes = await fetch(fallbackUrl)
    if (!fallbackRes.ok) {
      throw new Error(`Open-Meteo forecast failed with status ${fallbackRes.status}`)
    }
    const fallbackData = await fallbackRes.json()
    const result = {
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
    forecastCache.set(cacheKey, { timestamp: Date.now(), data: result })
    return result
  } catch (err) {
    throw new Error(`Open-Meteo forecast failed: ${err.message}`)
  }
}

/**
 * Fetch real historical climate reanalysis data from Open-Meteo Historical Archive.
 */
async function fetchHistoricalData(latitude, longitude, startDate, endDate) {
  const cacheKey = `${Number(latitude).toFixed(3)}_${Number(longitude).toFixed(3)}_${startDate}_${endDate}`
  if (historicalCache.has(cacheKey)) {
    return historicalCache.get(cacheKey)
  }

  const url = `${BASE_ARCHIVE_URL}?latitude=${latitude}&longitude=${longitude}&start_date=${startDate}&end_date=${endDate}&daily=${HISTORICAL_DAILY_FIELDS}&timezone=auto`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Historical Weather API error: status ${response.status}`)
  }

  const data = await response.json()
  if (!data?.daily?.time?.length) {
    throw new Error('No historical weather observations found for the specified period.')
  }

  const result = {
    latitude: data.latitude,
    longitude: data.longitude,
    elevation: data.elevation,
    timezone: data.timezone,
    daily: data.daily,
    source: 'Open-Meteo Historical Archive',
    dataset: 'ECMWF ERA5 Reanalysis',
  }

  historicalCache.set(cacheKey, result)
  return result
}

/**
 * Geocode a city name using Open-Meteo Geocoding API.
 */
async function geocodeLocation(cityName) {
  if (!cityName || typeof cityName !== 'string') return null
  const cleaned = cityName.trim()
  if (!cleaned) return null

  // Check known default locations first
  const localMatch = DEFAULT_LOCATIONS.find(
    (l) => l.name.toLowerCase() === cleaned.toLowerCase()
  )
  if (localMatch) return localMatch

  try {
    const url = `${BASE_GEOCODING_URL}?name=${encodeURIComponent(cleaned)}&count=1&language=en&format=json`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (data?.results && data.results.length > 0) {
      const top = data.results[0]
      return {
        name: top.name,
        state: top.admin1 || top.country,
        country: top.country,
        latitude: top.latitude,
        longitude: top.longitude,
      }
    }
  } catch (err) {
    console.warn(`Geocoding error for ${cityName}:`, err.message)
  }

  return null
}

/**
 * Convenience helper: finds index in hourly.time closest to now.
 */
function getCurrentHourIndex(hourly) {
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
 * Builds a compact snapshot of current conditions from the hourly block.
 */
function buildCurrentSnapshot(data) {
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

module.exports = {
  fetchForecastWeather,
  fetchHistoricalData,
  geocodeLocation,
  buildCurrentSnapshot,
  DEFAULT_LOCATIONS,
  NWP_MODELS,
  PRIMARY_NWP_MODEL,
}
