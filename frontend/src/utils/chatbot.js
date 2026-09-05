// Lightweight, fully frontend response engine for WeatherGPT.
// No LLM, no backend. It reads structured signals out of the Open-Meteo
// payload already fetched by weatherService.js and turns them into a
// short natural-language answer.
//
// This function is intentionally isolated so that later it can be
// replaced with a call to POST /api/chat (FastAPI + ML model + LLM)
// without changing anything in the UI components that call it —
// only the body of generateResponse needs to change.

import { getWeatherCondition, isRainCategory } from './weatherCode.js'
import { evaluateRisk } from './riskEngine.js'

function groupHoursByDay(hourly) {
  const days = {}
  hourly.time.forEach((iso, i) => {
    const day = iso.slice(0, 10)
    if (!days[day]) days[day] = []
    days[day].push({
      hour: Number(iso.slice(11, 13)),
      time: iso,
      temperature: hourly.temperature_2m?.[i],
      precipitationProbability: hourly.precipitation_probability?.[i],
      precipitation: hourly.precipitation?.[i],
      weatherCode: hourly.weather_code?.[i],
      windSpeed: hourly.wind_speed_10m?.[i],
    })
  })
  return days
}

function dayKeyOffset(offsetDays) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

function partOfDayLabel(hour) {
  if (hour < 11) return 'morning'
  if (hour < 16) return 'afternoon'
  if (hour < 19) return 'evening'
  return 'night'
}

function peakPrecipWindow(hours) {
  if (!hours?.length) return null
  const peak = hours.reduce((max, h) =>
    (h.precipitationProbability ?? 0) > (max.precipitationProbability ?? 0) ? h : max
  , hours[0])
  return peak
}

function summarizeDay(hours, dayLabel, locationName) {
  if (!hours?.length) {
    return `I don't have data for ${dayLabel} yet for ${locationName}.`
  }
  const maxProb = Math.max(...hours.map((h) => h.precipitationProbability ?? 0))
  const peak = peakPrecipWindow(hours)
  const condition = getWeatherCondition(peak.weatherCode)
  const temps = hours.map((h) => h.temperature).filter((t) => t != null)
  const minT = Math.round(Math.min(...temps))
  const maxT = Math.round(Math.max(...temps))

  if (maxProb >= 60) {
    return `${dayLabel} has a fairly high chance of rain in ${locationName} — up to ${Math.round(maxProb)}% during the ${partOfDayLabel(peak.hour)}. Expect ${condition.label.toLowerCase()} conditions, with temperatures between ${minT}°C and ${maxT}°C. If you can, plan outdoor activities for a drier window.`
  }
  if (maxProb >= 30) {
    return `${dayLabel} has a moderate chance of rain in ${locationName}. The highest precipitation probability (${Math.round(maxProb)}%) is expected during the ${partOfDayLabel(peak.hour)}. Temperatures should range from ${minT}°C to ${maxT}°C, so if you're planning outdoor activities, the ${partOfDayLabel(peak.hour) === 'morning' ? 'afternoon' : 'morning'} may be a better option.`
  }
  return `${dayLabel} looks mostly dry in ${locationName}, with only a low chance of rain (around ${Math.round(maxProb)}%). Expect ${condition.label.toLowerCase()} skies and temperatures between ${minT}°C and ${maxT}°C.`
}

function matchIntent(query) {
  const q = query.toLowerCase()

  if (/(tomorrow)/.test(q) && /(rain|precip|shower)/.test(q)) return 'rain_tomorrow'
  if (/(today)/.test(q) && /(rain|precip|shower)/.test(q)) return 'rain_today'
  if (/rain|precip|shower|drizzle/.test(q)) return 'rain_today'

  if (/(travel|go out|step out|drive|commute|safe)/.test(q)) return 'travel_safety'

  if (/(weekend|saturday|sunday)/.test(q)) return 'weekend'

  if (/(summary|overview|how.*weather|today.*weather)/.test(q)) return 'summary'

  if (/(temperature|hot|cold|degrees|°c)/.test(q)) return 'temperature'

  if (/(wind)/.test(q)) return 'wind'

  if (/(humid)/.test(q)) return 'humidity'

  if (/(risk|warning|alert|danger)/.test(q)) return 'risk'

  return 'fallback'
}

/**
 * @param {string} query - raw user text
 * @param {object} weatherData - full Open-Meteo payload from weatherService.fetchWeather
 * @param {string} locationName - display name, e.g. "Chennai"
 * @param {object} snapshot - current snapshot from buildCurrentSnapshot
 */
export function generateResponse(query, weatherData, locationName, snapshot) {
  if (!weatherData?.hourly) {
    return "I don't have live weather data to work with right now. Please check your connection and try again."
  }

  const intent = matchIntent(query)
  const days = groupHoursByDay(weatherData.hourly)
  const todayKey = dayKeyOffset(0)
  const tomorrowKey = dayKeyOffset(1)

  switch (intent) {
    case 'rain_today':
      return summarizeDay(days[todayKey], 'Today', locationName)

    case 'rain_tomorrow':
      return summarizeDay(days[tomorrowKey], 'Tomorrow', locationName)

    case 'travel_safety': {
      const risk = evaluateRisk(snapshot)
      if (risk.level === 'LOW') {
        return `Travel conditions in ${locationName} look fine right now. ${risk.description} ${risk.recommendation}`
      }
      return `I'd be a little cautious about travel in ${locationName} at the moment. ${risk.description} ${risk.recommendation}`
    }

    case 'weekend': {
      const now = new Date()
      const currentDay = now.getDay() // 0 Sun ... 6 Sat
      const daysUntilSat = (6 - currentDay + 7) % 7
      const satKey = dayKeyOffset(daysUntilSat)
      const sunKey = dayKeyOffset(daysUntilSat + 1)
      const satSummary = summarizeDay(days[satKey], 'Saturday', locationName)
      const sunSummary = summarizeDay(days[sunKey], 'Sunday', locationName)
      if (!days[satKey] && !days[sunKey]) {
        return `My forecast window only covers the next 7 days, so I can't reach this weekend yet for ${locationName}.`
      }
      return `${satSummary} ${sunSummary}`
    }

    case 'summary': {
      if (!snapshot) return `I couldn't build a summary for ${locationName} right now.`
      const condition = getWeatherCondition(snapshot.weatherCode)
      const risk = evaluateRisk(snapshot)
      return `Right now in ${locationName}, it's ${Math.round(snapshot.temperature)}°C and ${condition.label.toLowerCase()}. Humidity is at ${Math.round(snapshot.humidity)}%, wind is moving at ${Math.round(snapshot.windSpeed)} km/h, and rain probability sits around ${Math.round(snapshot.precipitationProbability ?? 0)}%. Overall risk level: ${risk.level.toLowerCase()}.`
    }

    case 'temperature': {
      if (!snapshot) return `I don't have a current temperature reading for ${locationName}.`
      const todayHours = days[todayKey] ?? []
      const temps = todayHours.map((h) => h.temperature).filter((t) => t != null)
      const minT = temps.length ? Math.round(Math.min(...temps)) : null
      const maxT = temps.length ? Math.round(Math.max(...temps)) : null
      return `It's currently ${Math.round(snapshot.temperature)}°C in ${locationName}. Today's range should fall between ${minT}°C and ${maxT}°C.`
    }

    case 'wind': {
      if (!snapshot) return `I don't have current wind data for ${locationName}.`
      return `Wind in ${locationName} is currently around ${Math.round(snapshot.windSpeed)} km/h. That's ${
        snapshot.windSpeed >= 30 ? 'strong enough to notice outdoors, especially near open spaces.' : 'a fairly gentle breeze.'
      }`
    }

    case 'humidity': {
      if (!snapshot) return `I don't have current humidity data for ${locationName}.`
      return `Humidity in ${locationName} is currently at ${Math.round(snapshot.humidity)}%. ${
        snapshot.humidity >= 75 ? "It'll likely feel muggier than the temperature alone suggests." : 'That feels reasonably comfortable.'
      }`
    }

    case 'risk': {
      const risk = evaluateRisk(snapshot)
      return `${risk.title}. ${risk.description} ${risk.recommendation} (This is a prototype estimate, not an official warning.)`
    }

    default: {
      const condition = snapshot ? getWeatherCondition(snapshot.weatherCode).label.toLowerCase() : null
      return `I can help with rain chances, temperature, wind, humidity, travel safety and weekend outlooks for ${locationName}.${
        condition ? ` Right now it's ${condition} with ${Math.round(snapshot.temperature)}°C.` : ''
      } Try asking something like "Will it rain tomorrow?" or "Is it safe to travel this evening?"`
    }
  }
}

export function isRainy(weatherCode) {
  return isRainCategory(getWeatherCondition(weatherCode).category)
}
