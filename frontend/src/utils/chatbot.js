// WeatherGPT Natural Language Query Engine
//
// Frontend-only query understanding for the current prototype.
// No LLM or backend is required yet.
//
// Flow:
// User question
//    ↓
// Understand intent / time / location
//    ↓
// Read Open-Meteo data
//    ↓
// Analyze weather
//    ↓
// Generate natural-language response
//
// Later:
// React → FastAPI → LLM + ML → WeatherGPT
//
// This file is intentionally isolated so the UI does not need
// to change when the rule-based engine is replaced by an LLM.

import { getWeatherCondition, isRainCategory } from './weatherCode.js'
import { evaluateRisk } from './riskEngine.js'
import { LOCATIONS } from '../data/locations.js'
import {
  fetchWeather,
  buildCurrentSnapshot,
  getForecastModel,
  getModelDescription,
  getNwpExplanation,
} from '../services/weatherService.js'



// ============================================================
// HELPERS
// ============================================================

function groupHoursByDay(hourly) {
  const days = {}

  if (!hourly?.time) return days

  hourly.time.forEach((iso, i) => {
    const day = iso.slice(0, 10)

    if (!days[day]) {
      days[day] = []
    }

    days[day].push({
      hour: Number(iso.slice(11, 13)),
      time: iso,

      temperature: hourly.temperature_2m?.[i],

      precipitationProbability:
        hourly.precipitation_probability?.[i],

      precipitation:
        hourly.precipitation?.[i],

      rain:
        hourly.rain?.[i],

      weatherCode:
        hourly.weather_code?.[i],

      windSpeed:
        hourly.wind_speed_10m?.[i],

      windDirection:
        hourly.wind_direction_10m?.[i],

      pressure:
        hourly.pressure_msl?.[i],
    })
  })

  return days
}


// Get today's date in local time instead of relying on UTC.
function getLocalDate(offsetDays = 0) {
  const date = new Date()

  date.setDate(date.getDate() + offsetDays)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}


function partOfDayLabel(hour) {
  if (hour < 11) return 'morning'
  if (hour < 16) return 'afternoon'
  if (hour < 19) return 'evening'
  return 'night'
}


function peakPrecipWindow(hours) {
  if (!hours?.length) return null

  return hours.reduce(
    (max, current) =>
      (current.precipitationProbability ?? 0) >
      (max.precipitationProbability ?? 0)
        ? current
        : max,
    hours[0]
  )
}


// ============================================================
// NATURAL LANGUAGE UNDERSTANDING
// ============================================================

/**
 * Check if the query asks about the weather forecast model / NWP / source.
 */
export function isModelInquiry(query) {
  if (!query || typeof query !== 'string') return false
  const q = query.toLowerCase().trim()

  return (
    /\b(nwp|numerical weather prediction)\b/i.test(q) ||
    /which.*(?:weather\s+)?model/i.test(q) ||
    /what.*(?:weather\s+|nwp\s+|forecast\s+)?model/i.test(q) ||
    (/\bmodel\b/i.test(q) && /(weather|forecast|nwp|ecmwf|gfs|wrf|use|used|using|prediction)/i.test(q)) ||
    /(weather|forecast|nwp)\s+model/i.test(q) ||
    /where.*(?:forecast|weather|data).*come from/i.test(q) ||
    /where do you get (?:this|the|your) (?:forecast|weather|data)/i.test(q) ||
    /source of (?:this|the) (?:forecast|weather|data)/i.test(q) ||
    /forecast source/i.test(q) ||
    /is this (?:forecast\s+)?based on (?:ecmwf|gfs|wrf|nwp)/i.test(q) ||
    /how (?:is|are) (?:this|the)?\s*(?:weather\s+)?forecast(?:s)? generated/i.test(q) ||
    /how do you generate (?:this|the)?\s*(?:weather\s+)?forecast/i.test(q) ||
    /\b(ecmwf|ifs)\b/i.test(q)
  )
}

/**
 * Detect specific weather variable intent (rain, temperature, etc.).
 */
export function detectWeatherIntent(query) {
  if (!query || typeof query !== 'string') return null
  const q = query.toLowerCase().trim()

  // Rain / precipitation
  if (/rain|raining|precip|shower|drizzle|umbrella/.test(q)) {
    return 'rain'
  }

  // Travel / outdoor advice
  if (/travel|go out|step out|drive|commute|journey|trip|outdoor|outside|safe/.test(q)) {
    return 'travel_safety'
  }

  // Weekend
  if (/weekend|saturday|sunday/.test(q)) {
    return 'weekend'
  }

  // Temperature
  if (/temperature|temp|hot|cold|heat|cool|degrees|°c|°f/.test(q)) {
    return 'temperature'
  }

  // Wind
  if (/wind|windy|breeze|gust/.test(q)) {
    return 'wind'
  }

  // Humidity
  if (/humid|humidity|moisture/.test(q)) {
    return 'humidity'
  }

  // Pressure
  if (/pressure|atmospheric pressure/.test(q)) {
    return 'pressure'
  }

  // Risk / warning
  if (/risk|warning|alert|danger|hazard|severe|extreme/.test(q)) {
    return 'risk'
  }

  // General summary (only if explicitly asking about general conditions and not a pure model query)
  if (
    /summary|overview|weather today|weather tomorrow|how.*weather|weather like/.test(q) &&
    !isModelInquiry(q)
  ) {
    return 'summary'
  }

  return null
}

/**
 * Detect what the user wants to know.
 */
export function matchIntent(query) {
  const weatherIntent = detectWeatherIntent(query)
  const hasModel = isModelInquiry(query)

  if (weatherIntent) {
    return weatherIntent
  }

  if (hasModel) {
    return 'nwp_model'
  }

  return 'weather'
}




/**
 * Detect the requested time period.
 */
export function detectTime(query) {
  const q = query.toLowerCase()

  if (/tomorrow|next day/.test(q)) {
    return 'tomorrow'
  }

  if (
    /this evening|tonight|this night/.test(q)
  ) {
    return 'evening'
  }

  if (
    /evening|afternoon|morning|night/.test(q)
  ) {
    return 'today_part'
  }

  if (
    /weekend|saturday|sunday/.test(q)
  ) {
    return 'weekend'
  }

  if (
    /today|now|currently|right now/.test(q)
  ) {
    return 'today'
  }

  // Default to today
  return 'today'
}


/**
 * Detect a location mentioned inside the user's question.
 *
 * Example:
 *
 * "Will it rain tomorrow in Ooty?"
 *
 * → Ooty
 */
export function detectLocation(query, selectedLocation, locations = LOCATIONS) {
  if (!query || typeof query !== 'string') {
    return selectedLocation
  }

  const q = query.toLowerCase()

  // 1. Check exact location names with word boundaries to avoid false substring matches
  for (const location of locations) {
    if (!location?.name) continue
    const regex = new RegExp(`\\b${location.name}\\b`, 'i')
    if (regex.test(query)) {
      return location
    }
  }

  // 2. Check common city aliases / nicknames
  const aliases = {
    bangalore: 'Bengaluru',
    trichy: 'Tiruchirappalli',
    bombay: 'Mumbai',
    madras: 'Chennai',
    calcutta: 'Kolkata',
  }

  for (const [alias, canonicalName] of Object.entries(aliases)) {
    const regex = new RegExp(`\\b${alias}\\b`, 'i')
    if (regex.test(query)) {
      const match = locations.find(
        (l) => l.name.toLowerCase() === canonicalName.toLowerCase()
      )
      if (match) return match
    }
  }

  // 3. Fallback: substring matching
  for (const location of locations) {
    if (
      location?.name &&
      q.includes(location.name.toLowerCase())
    ) {
      return location
    }
  }

  return selectedLocation
}


/**
 * Convert the natural-language question into structured data.
 */
export function parseWeatherQuery(
  query,
  selectedLocation,
  locations = LOCATIONS
) {
  const weatherIntent = detectWeatherIntent(query)
  const hasModel = isModelInquiry(query)
  const isCompound = Boolean(weatherIntent && hasModel)

  return {
    intent: weatherIntent || (hasModel ? 'nwp_model' : 'weather'),
    weatherIntent,
    hasModelQuery: hasModel,
    isCompoundQuery: isCompound,
    time: detectTime(query),
    location: detectLocation(
      query,
      selectedLocation,
      locations
    ),
  }
}


// ============================================================
// DAY SUMMARY
// ============================================================

function summarizeDay(
  hours,
  dayLabel,
  locationName
) {
  if (!hours?.length) {
    return `I don't have forecast data for ${dayLabel} yet for ${locationName}.`
  }

  const probabilities = hours
    .map(
      (h) => h.precipitationProbability
    )
    .filter((value) => value != null)

  const maxProbability = probabilities.length
    ? Math.max(...probabilities)
    : 0

  const peak = peakPrecipWindow(hours)

  const condition = peak
    ? getWeatherCondition(peak.weatherCode)
    : null

  const temperatures = hours
    .map((h) => h.temperature)
    .filter((value) => value != null)

  const minTemperature = temperatures.length
    ? Math.round(Math.min(...temperatures))
    : null

  const maxTemperature = temperatures.length
    ? Math.round(Math.max(...temperatures))
    : null

  const temperatureText =
    minTemperature != null &&
    maxTemperature != null
      ? `Temperatures should range from ${minTemperature}°C to ${maxTemperature}°C.`
      : ''


  // High rain probability
  if (maxProbability >= 60) {
    return (
      `${dayLabel} has a high chance of rain in ${locationName}, ` +
      `with precipitation probability reaching ${Math.round(
        maxProbability
      )}% during the ${partOfDayLabel(peak.hour)}. ` +
      `${temperatureText} ` +
      `If you're planning outdoor activities, consider a safer weather window.`
    )
  }


  // Moderate rain probability
  if (maxProbability >= 30) {
    return (
      `${dayLabel} has a moderate chance of rain in ${locationName}. ` +
      `The highest precipitation probability is around ${Math.round(
        maxProbability
      )}% during the ${partOfDayLabel(peak.hour)}. ` +
      `${temperatureText} ` +
      `It would be a good idea to keep an umbrella nearby.`
    )
  }


  // Low rain probability
  return (
    `${dayLabel} looks mostly dry in ${locationName}, ` +
    `with a low precipitation probability of around ${Math.round(
      maxProbability
    )}%. ` +
    `${condition ? `Expect ${condition.label.toLowerCase()} conditions. ` : ''}` +
    `${temperatureText}`
  )
}


// ============================================================
// RAIN RESPONSE
// ============================================================

function generateRainResponse(
  query,
  weatherData,
  locationName,
  isCompound = false
) {
  const { daily, hourly } = weatherData

  const time = detectTime(query)

  // -----------------------------------------
  // Tomorrow
  // -----------------------------------------

  if (time === 'tomorrow') {
    if (!daily?.time?.length) {
      return `I don't have tomorrow's rain forecast for ${locationName} yet.`
    }

    const index = 1

    const probability =
      daily.precipitation_probability_max?.[index]

    const precipitation =
      daily.precipitation_sum?.[index]

    const minTemperature =
      daily.temperature_2m_min?.[index]

    const maxTemperature =
      daily.temperature_2m_max?.[index]

    if (probability == null) {
      return `I couldn't determine tomorrow's rain probability for ${locationName}.`
    }

    if (isCompound) {
      const roundedProb = Math.round(probability)
      const precipVal = precipitation != null ? precipitation : 0
      const modelInfo = getForecastModel(weatherData)
      const modelSuffix = modelInfo?.isAvailable && modelInfo?.model
        ? ` The forecast is based on the ${modelInfo.model} numerical weather prediction model via ${modelInfo.provider}.`
        : (modelInfo?.message ? ` ${modelInfo.message}` : '')

      if (probability >= 70) {
        return (
          `Rain is quite likely in ${locationName} tomorrow, with an ${roundedProb}% precipitation probability and approximately ${precipVal} mm of expected precipitation.${modelSuffix}`
        )
      }

      if (probability >= 40) {
        return (
          `There is a moderate chance of rain in ${locationName} tomorrow, with a ${roundedProb}% precipitation probability and approximately ${precipVal} mm of expected precipitation.${modelSuffix}`
        )
      }

      return (
        `Rain is less likely in ${locationName} tomorrow, with a precipitation probability of around ${roundedProb}% and approximately ${precipVal} mm of expected precipitation.${modelSuffix}`
      )
    }

    if (probability >= 70) {
      return (
        `Yes, rain is quite likely in ${locationName} tomorrow. ` +
        `The maximum precipitation probability is around ${Math.round(
          probability
        )}%. ` +
        `Expected precipitation is approximately ${
          precipitation ?? 0
        } mm. ` +
        `If you're heading outside, carrying an umbrella would be advisable.`
      )
    }

    if (probability >= 40) {
      return (
        `There is a moderate chance of rain in ${locationName} tomorrow, ` +
        `with a precipitation probability of around ${Math.round(
          probability
        )}%. ` +
        `Expected precipitation is approximately ${
          precipitation ?? 0
        } mm. ` +
        `I'd recommend keeping an umbrella with you.`
      )
    }

    return (
      `Rain is less likely in ${locationName} tomorrow, ` +
      `with a precipitation probability of around ${Math.round(
        probability
      )}%. ` +
      `Expected precipitation is approximately ${
        precipitation ?? 0
      } mm.`
    )
  }


  // -----------------------------------------
  // Today
  // -----------------------------------------

  if (time === 'today') {
    const todayKey = getLocalDate(0)

    const days = groupHoursByDay(hourly)
    const todayHours = days[todayKey] || days[Object.keys(days)[0]]

    return summarizeDay(
      todayHours,
      'Today',
      locationName
    )
  }


  // -----------------------------------------
  // Evening
  // -----------------------------------------

  if (time === 'evening') {
    const todayKey = getLocalDate(0)

    const days = groupHoursByDay(hourly)
    const todayHours = days[todayKey] || days[Object.keys(days)[0]]

    const eveningHours =
      (todayHours ?? []).filter(
        (hour) => hour.hour >= 16 && hour.hour < 20
      )

    if (!eveningHours.length) {
      return `I don't have enough evening forecast data for ${locationName}.`
    }

    const peak = peakPrecipWindow(eveningHours)

    const probability =
      peak.precipitationProbability ?? 0

    if (probability >= 60) {
      return (
        `Rain is quite possible in ${locationName} this evening, ` +
        `with precipitation probability reaching around ${Math.round(
          probability
        )}%. Carrying an umbrella would be a good idea.`
      )
    }

    if (probability >= 30) {
      return (
        `There is a moderate chance of rain in ${locationName} this evening, ` +
        `with the highest probability around ${Math.round(
          probability
        )}%.`
      )
    }

    return (
      `Rain looks unlikely in ${locationName} this evening, ` +
      `with precipitation probability staying around ${Math.round(
        probability
      )}%.`
    )
  }


  // -----------------------------------------
  // Default: Today
  // -----------------------------------------

  const todayKey = getLocalDate(0)

  const days = groupHoursByDay(hourly)
  const todayHours = days[todayKey] || days[Object.keys(days)[0]]

  return summarizeDay(
    todayHours,
    'Today',
    locationName
  )
}


// ============================================================
// TEMPERATURE RESPONSE
// ============================================================

function generateTemperatureResponse(
  query,
  weatherData,
  locationName,
  snapshot
) {
  const { daily } = weatherData

  const time = detectTime(query)

  // Tomorrow
  if (time === 'tomorrow') {
    const min =
      daily?.temperature_2m_min?.[1]

    const max =
      daily?.temperature_2m_max?.[1]

    if (min == null || max == null) {
      return `I don't have tomorrow's temperature forecast for ${locationName}.`
    }

    return (
      `Tomorrow in ${locationName}, ` +
      `temperatures are expected to range from ${Math.round(
        min
      )}°C to ${Math.round(max)}°C.`
    )
  }


  // Today
  const min =
    daily?.temperature_2m_min?.[0]

  const max =
    daily?.temperature_2m_max?.[0]

  const current =
    snapshot?.temperature

  if (current == null && min == null && max == null) {
    return `I don't have temperature information for ${locationName} right now.`
  }

  if (current != null && min != null && max != null) {
    return (
      `It's currently ${Math.round(
        current
      )}°C in ${locationName}. ` +
      `Today's temperature is expected to range from ${Math.round(
        min
      )}°C to ${Math.round(max)}°C.`
    )
  }

  return (
    `Today's temperature in ${locationName} ` +
    `is expected to range from ${Math.round(
      min
    )}°C to ${Math.round(max)}°C.`
  )
}


// ============================================================
// HUMIDITY
// ============================================================

function generateHumidityResponse(
  locationName,
  snapshot
) {
  if (snapshot?.humidity == null) {
    return `I don't have current humidity data for ${locationName}.`
  }

  const humidity =
    Math.round(snapshot.humidity)

  let explanation = ''

  if (humidity >= 80) {
    explanation =
      'The air is quite humid and it may feel muggy.'
  } else if (humidity >= 60) {
    explanation =
      'Humidity is moderately high.'
  } else if (humidity >= 40) {
    explanation =
      'Humidity is at a fairly comfortable level.'
  } else {
    explanation =
      'The air is relatively dry.'
  }

  return (
    `Current humidity in ${locationName} is ${humidity}%. ` +
    explanation
  )
}


// ============================================================
// WIND
// ============================================================

function generateWindResponse(
  locationName,
  snapshot
) {
  if (snapshot?.windSpeed == null) {
    return `I don't have current wind data for ${locationName}.`
  }

  const wind =
    Math.round(snapshot.windSpeed)

  const direction =
    snapshot.windDirection

  let description = ''

  if (wind >= 40) {
    description =
      'Winds are strong, so extra caution is recommended outdoors.'
  } else if (wind >= 25) {
    description =
      'It is fairly windy, especially in exposed areas.'
  } else {
    description =
      'Winds are relatively gentle.'
  }

  const directionText =
    direction != null
      ? ` Wind direction is around ${Math.round(direction)}°.`
      : ''

  return (
    `Current wind speed in ${locationName} is around ${wind} km/h.` +
    directionText +
    ` ${description}`
  )
}


// ============================================================
// PRESSURE
// ============================================================

function generatePressureResponse(
  locationName,
  snapshot
) {
  if (snapshot?.pressure == null) {
    return `I don't have current pressure data for ${locationName}.`
  }

  return (
    `Current sea-level pressure in ${locationName} ` +
    `is around ${Math.round(snapshot.pressure)} hPa.`
  )
}


// ============================================================
// GENERAL WEATHER SUMMARY
// ============================================================

function generateWeatherResponse(
  locationName,
  weatherData,
  snapshot
) {
  if (!snapshot) {
    return `I couldn't retrieve the current weather conditions for ${locationName}.`
  }

  const condition =
    getWeatherCondition(snapshot.weatherCode)

  const temperature =
    snapshot.temperature != null
      ? Math.round(snapshot.temperature)
      : null

  const humidity =
    snapshot.humidity != null
      ? Math.round(snapshot.humidity)
      : null

  const wind =
    snapshot.windSpeed != null
      ? Math.round(snapshot.windSpeed)
      : null

  const rainProbability =
    snapshot.precipitationProbability != null
      ? Math.round(snapshot.precipitationProbability)
      : null

  let response =
    `Currently in ${locationName}, `

  if (temperature != null) {
    response += `it's ${temperature}°C`
  }

  if (condition?.label) {
    response += ` with ${condition.label.toLowerCase()} conditions`
  }

  response += '.'

  if (humidity != null) {
    response += ` Humidity is ${humidity}%.`
  }

  if (wind != null) {
    response += ` Wind speed is around ${wind} km/h.`
  }

  if (rainProbability != null) {
    response += ` Rain probability is around ${rainProbability}%.`
  }

  return response
}


// ============================================================
// TRAVEL / OUTDOOR ADVISORY
// ============================================================

function generateTravelSafetyResponse(
  locationName,
  snapshot
) {
  if (!snapshot) {
    return `I couldn't evaluate travel conditions for ${locationName} right now.`
  }

  const risk =
    evaluateRisk(snapshot)

  if (risk.level === 'LOW') {
    return (
      `Travel conditions in ${locationName} look generally favorable right now. ` +
      `${risk.description} ${risk.recommendation}`
    )
  }

  if (risk.level === 'MODERATE') {
    return (
      `Travel is possible in ${locationName}, but some caution is advisable. ` +
      `${risk.description} ${risk.recommendation}`
    )
  }

  if (risk.level === 'HIGH') {
    return (
      `I'd recommend extra caution when travelling in ${locationName}. ` +
      `${risk.description} ${risk.recommendation}`
    )
  }

  return (
    `Weather conditions in ${locationName} may be hazardous right now. ` +
    `${risk.description} ${risk.recommendation}`
  )
}


// ============================================================
// RISK
// ============================================================

function generateRiskResponse(
  locationName,
  snapshot
) {
  if (!snapshot) {
    return `I couldn't evaluate the weather risk for ${locationName}.`
  }

  const risk =
    evaluateRisk(snapshot)

  return (
    `${risk.title}. ` +
    `${risk.description} ` +
    `${risk.recommendation} ` +
    `(This is a prototype estimate, not an official weather warning.)`
  )
}


// ============================================================
// WEEKEND
// ============================================================

function generateWeekendResponse(
  weatherData,
  locationName
) {
  const { daily } = weatherData

  if (!daily?.time?.length) {
    return `I don't have enough forecast data to analyze the weekend for ${locationName}.`
  }

  const today = new Date()

  const currentDay =
    today.getDay()

  const daysUntilSaturday =
    (6 - currentDay + 7) % 7

  const saturdayIndex =
    daysUntilSaturday

  const sundayIndex =
    daysUntilSaturday + 1

  if (
    saturdayIndex >= daily.time.length
  ) {
    return (
      `The current 7-day forecast window does not reach this weekend for ${locationName}.`
    )
  }

  const saturdayProbability =
    daily.precipitation_probability_max?.[
      saturdayIndex
    ]

  const sundayProbability =
    daily.precipitation_probability_max?.[
      sundayIndex
    ]

  const saturdayMax =
    daily.temperature_2m_max?.[
      saturdayIndex
    ]

  const sundayMax =
    daily.temperature_2m_max?.[
      sundayIndex
    ]

  let response =
    `Here's the weekend outlook for ${locationName}. `

  if (saturdayProbability != null) {
    response +=
      `Saturday has around ${Math.round(
        saturdayProbability
      )}% precipitation probability`

    if (saturdayMax != null) {
      response +=
        ` with a high near ${Math.round(
          saturdayMax
        )}°C`
    }

    response += '. '
  }

  if (
    sundayIndex < daily.time.length &&
    sundayProbability != null
  ) {
    response +=
      `Sunday has around ${Math.round(
        sundayProbability
      )}% precipitation probability`

    if (sundayMax != null) {
      response +=
        ` with a high near ${Math.round(
          sundayMax
        )}°C`
    }

    response += '.'
  }

  return response
}


// ============================================================
// NWP FORECAST MODEL RESPONSE
// ============================================================

function generateModelResponse(query, weatherData, locationName) {
  const modelInfo = getForecastModel(weatherData)
  const q = query.toLowerCase()

  if (!modelInfo || !modelInfo.isAvailable || !modelInfo.model) {
    return 'Forecast model information is currently unavailable.'
  }

  const modelName = modelInfo.model
  const modelType = modelInfo.modelType || 'Numerical Weather Prediction'
  const explanation = modelInfo.explanation || getNwpExplanation()

  // 1. "How is this forecast generated?"
  if (/how.*(generated|created|calculated|computed|work)/.test(q)) {
    return (
      `This forecast is generated using the ${modelName} numerical weather prediction (NWP) model via ${modelInfo.provider}. ` +
      `${explanation}`
    )
  }

  // 2. "Is this forecast based on ECMWF?"
  if (/is this.*(ecmwf|ifs)/.test(q)) {
    return (
      `Yes, this forecast is based on the ${modelName} numerical weather prediction model, accessed in real time via ${modelInfo.provider}.`
    )
  }

  // 3. "Where does this weather forecast come from?" / source inquiries
  if (/where.*come from|source|provider|who generates/i.test(q)) {
    return `This forecast comes from ${modelInfo.provider} using the ${modelName} numerical weather prediction model.`
  }

  // 4. "What NWP model is being used?" / "Which weather model are you using?"
  return `This forecast is based on the ${modelName} numerical weather prediction model.`
}


// ============================================================
// MAIN RESPONSE FUNCTION
// ============================================================

/**
 * Main WeatherGPT response generator.
 *
 * @param {string} query
 * @param {object} weatherData
 * @param {string} locationName
 * @param {object} snapshot
 * @param {object[]} locations
 */

export async function generateResponse(
  query,
  weatherData,
  locationName,
  snapshot,
  locations = LOCATIONS
) {
  const currentLocation =
    locations.find(
      (loc) => loc.name.toLowerCase() === (locationName || '').toLowerCase()
    ) || { name: locationName }

  const parsed = parseWeatherQuery(query, currentLocation, locations)

  const intent = parsed.intent
  const detectedLocation = parsed.location
  const resolvedLocationName = detectedLocation?.name || locationName

  let activeWeatherData = weatherData
  let activeSnapshot = snapshot

  // If a specific location was mentioned that differs from locationName,
  // or if weatherData was not provided, fetch live Open-Meteo weather data.
  const isDifferentLocation =
    detectedLocation &&
    detectedLocation.name &&
    locationName &&
    detectedLocation.name.toLowerCase() !== locationName.toLowerCase()

  if (
    (isDifferentLocation || !activeWeatherData) &&
    detectedLocation?.latitude != null &&
    detectedLocation?.longitude != null
  ) {
    try {
      activeWeatherData = await fetchWeather(
        detectedLocation.latitude,
        detectedLocation.longitude
      )
      activeSnapshot = buildCurrentSnapshot(activeWeatherData)
    } catch (err) {
      console.error(`Failed to fetch weather for ${resolvedLocationName}:`, err)
      return `I couldn't fetch live weather data for ${resolvedLocationName} right now. Please check your connection and try again.`
    }
  }

  if (intent === 'nwp_model' && !activeWeatherData) {
    return generateModelResponse(query, null, resolvedLocationName)
  }

  if (!activeWeatherData) {
    return (
      "I don't have weather data to work with right now. " +
      'Please check your connection and try again.'
    )
  }

  let reply = ''

  switch (intent) {

    // -------------------------------
    // NWP Model
    // -------------------------------

    case 'nwp_model':
      return generateModelResponse(
        query,
        activeWeatherData,
        resolvedLocationName
      )

    // -------------------------------
    // Rain
    // -------------------------------

    case 'rain':
      reply = generateRainResponse(
        query,
        activeWeatherData,
        resolvedLocationName,
        parsed.isCompoundQuery
      )
      break


    // -------------------------------
    // Temperature
    // -------------------------------

    case 'temperature':
      reply = generateTemperatureResponse(
        query,
        activeWeatherData,
        resolvedLocationName,
        activeSnapshot
      )
      break


    // -------------------------------
    // Humidity
    // -------------------------------

    case 'humidity':
      reply = generateHumidityResponse(
        resolvedLocationName,
        activeSnapshot
      )
      break


    // -------------------------------
    // Wind
    // -------------------------------

    case 'wind':
      reply = generateWindResponse(
        resolvedLocationName,
        activeSnapshot
      )
      break


    // -------------------------------
    // Pressure
    // -------------------------------

    case 'pressure':
      reply = generatePressureResponse(
        resolvedLocationName,
        activeSnapshot
      )
      break


    // -------------------------------
    // Travel / outdoor
    // -------------------------------

    case 'travel_safety':
      reply = generateTravelSafetyResponse(
        resolvedLocationName,
        activeSnapshot
      )
      break


    // -------------------------------
    // Risk
    // -------------------------------

    case 'risk':
      reply = generateRiskResponse(
        resolvedLocationName,
        activeSnapshot
      )
      break


    // -------------------------------
    // Weekend
    // -------------------------------

    case 'weekend':
      reply = generateWeekendResponse(
        activeWeatherData,
        resolvedLocationName
      )
      break

    // -------------------------------
    // General summary
    // -------------------------------

    case 'summary':
      reply = generateWeatherResponse(
        resolvedLocationName,
        activeWeatherData,
        activeSnapshot
      )
      break


    // -------------------------------
    // General weather
    // -------------------------------

    default:
      reply = generateWeatherResponse(
        resolvedLocationName,
        activeWeatherData,
        activeSnapshot
      )
      break
  }

  // If this was a compound query (weather question + model inquiry) and not already handled by rain tomorrow:
  if (parsed.isCompoundQuery && !(intent === 'rain' && parsed.time === 'tomorrow')) {
    const modelInfo = getForecastModel(activeWeatherData)
    const modelSentence = modelInfo?.isAvailable && modelInfo?.model
      ? ` The forecast is based on the ${modelInfo.model} numerical weather prediction model via ${modelInfo.provider}.`
      : (modelInfo?.message ? ` ${modelInfo.message}` : '')
    reply += modelSentence
  }

  return reply
}


// ============================================================
// WEATHER CODE HELPER
// ============================================================

export function isRainy(weatherCode) {
  const condition =
    getWeatherCondition(weatherCode)

  return isRainCategory(
    condition.category
  )
}