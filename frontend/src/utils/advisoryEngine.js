// WeatherGPT Location-Based Advisory Engine
//
// Generates location-specific weather advisories across:
// 1. General (daily activity, outdoor plans, rain/heat/wind alerts)
// 2. Travel (road conditions, commute safety, rain/visibility/wind impacts)
// 3. Agriculture (cautious irrigation, spraying, field work recommendations)
//
// Grounded strictly in live Open-Meteo weather data + ECMWF IFS NWP forecasts.

import { evaluateRisk, RISK_LEVELS } from './riskEngine.js'
import { getWeatherCondition } from './weatherCode.js'

/**
 * Extracts normalized metrics for a specific forecast period ('today' | 'tomorrow' | 'current').
 */
export function extractPeriodMetrics(weatherData, snapshot, period = 'tomorrow') {
  const daily = weatherData?.daily
  const isTomorrow = period === 'tomorrow'
  const dayIdx = isTomorrow ? 1 : 0

  const precipProb =
    daily?.precipitation_probability_max?.[dayIdx] ??
    snapshot?.precipitationProbability ??
    0

  const precipSum =
    daily?.precipitation_sum?.[dayIdx] ??
    snapshot?.rain ??
    snapshot?.precipitation ??
    0

  const tempMax =
    daily?.temperature_2m_max?.[dayIdx] ??
    snapshot?.temperature ??
    null

  const tempMin =
    daily?.temperature_2m_min?.[dayIdx] ??
    snapshot?.temperature ??
    null

  const windSpeed =
    daily?.wind_speed_10m_max?.[dayIdx] ??
    snapshot?.windSpeed ??
    0

  const weatherCode =
    daily?.weather_code?.[dayIdx] ??
    snapshot?.weatherCode ??
    0

  const humidity = snapshot?.humidity ?? 60
  const condition = getWeatherCondition(weatherCode)

  return {
    period: isTomorrow ? 'tomorrow' : 'today',
    precipProb: Math.round(precipProb),
    precipSum: Number(precipSum.toFixed(1)),
    tempMax: tempMax != null ? Math.round(tempMax) : null,
    tempMin: tempMin != null ? Math.round(tempMin) : null,
    currentTemp: snapshot?.temperature != null ? Math.round(snapshot.temperature) : null,
    windSpeed: Math.round(windSpeed),
    weatherCode,
    conditionLabel: condition?.label || 'Fair',
    humidity: Math.round(humidity),
  }
}

/**
 * Generates a location-specific General Advisory.
 */
export function generateGeneralAdvisory(metrics, locationName, risk) {
  const { period, precipProb, precipSum, tempMax, windSpeed } = metrics
  const dayLabel = period === 'tomorrow' ? 'tomorrow' : 'today'
  const dayCapital = period === 'tomorrow' ? 'Tomorrow' : 'Today'

  // Severe / Extreme weather
  if (risk.level === RISK_LEVELS.EXTREME) {
    return {
      type: 'general',
      headline: `Severe weather warning in ${locationName}`,
      summary: `Severe conditions are expected ${dayLabel}. Rain probability is ${precipProb}% with potential storms.`,
      recommendation: `Stay indoors where possible, avoid open spaces, and monitor local authorities for updates.`,
      riskLevel: risk.level,
      icon: 'AlertTriangle',
    }
  }

  // Rain alerts
  if (precipProb >= 70 || precipSum >= 10) {
    return {
      type: 'general',
      headline: `Rain is likely ${dayLabel} in ${locationName}`,
      summary: `Rain probability is around ${precipProb}% with approximately ${precipSum} mm of precipitation expected.`,
      recommendation: `Carry rain protection, allow extra travel time, and plan indoor alternatives for outdoor activities.`,
      riskLevel: risk.level !== RISK_LEVELS.LOW ? risk.level : RISK_LEVELS.MODERATE,
      icon: 'CloudRain',
    }
  }

  if (precipProb >= 40) {
    return {
      type: 'general',
      headline: `Moderate chance of rain ${dayLabel} in ${locationName}`,
      summary: `Precipitation probability is around ${precipProb}% (${precipSum} mm expected).`,
      recommendation: `Keep an umbrella handy if you are heading outside for extended periods.`,
      riskLevel: RISK_LEVELS.MODERATE,
      icon: 'CloudDrizzle',
    }
  }

  // High Heat alert
  if (tempMax != null && tempMax >= 37) {
    return {
      type: 'general',
      headline: `High temperatures expected ${dayLabel} in ${locationName}`,
      summary: `Temperatures are forecast to reach ${tempMax}°C.`,
      recommendation: `Stay hydrated, seek shade during peak midday hours, and limit prolonged direct sun exposure.`,
      riskLevel: RISK_LEVELS.MODERATE,
      icon: 'SunMedium',
    }
  }

  // Strong Wind alert
  if (windSpeed >= 35) {
    return {
      type: 'general',
      headline: `Breezy to strong winds expected in ${locationName}`,
      summary: `Wind speeds may reach around ${windSpeed} km/h ${dayLabel}.`,
      recommendation: `Exercise caution outdoors, secure lightweight objects, and take care on two-wheelers.`,
      riskLevel: RISK_LEVELS.MODERATE,
      icon: 'Wind',
    }
  }

  // Favorable weather
  return {
    type: 'general',
    headline: `Favorable conditions expected ${dayLabel} in ${locationName}`,
    summary: `${dayCapital} looks mostly dry with a low rain chance (${precipProb}%) and comfortable wind levels (${windSpeed} km/h).`,
    recommendation: `Great conditions for outdoor activities, commutes, and daily routines.`,
    riskLevel: RISK_LEVELS.LOW,
    icon: 'Sun',
  }
}

/**
 * Generates a location-specific Travel Advisory.
 */
export function generateTravelAdvisory(metrics, locationName, risk) {
  const { period, precipProb, precipSum, windSpeed, weatherCode } = metrics
  const dayLabel = period === 'tomorrow' ? 'tomorrow' : 'today'
  const isStorm = weatherCode === 95 || weatherCode === 96 || weatherCode === 99

  // Storm / extreme travel conditions
  if (isStorm || risk.level === RISK_LEVELS.EXTREME) {
    return {
      type: 'travel',
      headline: `Hazardous travel conditions in ${locationName} ${dayLabel}`,
      summary: `Severe storm activity or torrential rain (${precipProb}% probability) may cause major delays and waterlogging.`,
      recommendation: `Postpone non-essential travel in ${locationName}. If you must drive, exercise extreme caution and avoid waterlogged roads.`,
      riskLevel: RISK_LEVELS.EXTREME,
      icon: 'AlertOctagon',
    }
  }

  // Heavy rain or strong wind travel impacts
  if (precipProb >= 70 || precipSum >= 8 || windSpeed >= 40) {
    return {
      type: 'travel',
      headline: `Travel may be moderately affected in ${locationName} ${dayLabel}`,
      summary: `Rain probability is around ${precipProb}% with expected precipitation of ${precipSum} mm and winds up to ${windSpeed} km/h.`,
      recommendation: `Wet roads may reduce traction and visibility. Allow extra transit time, maintain safe following distances, and check live traffic updates.`,
      riskLevel: RISK_LEVELS.HIGH,
      icon: 'Car',
    }
  }

  // Moderate rain chance
  if (precipProb >= 40 || windSpeed >= 25) {
    return {
      type: 'travel',
      headline: `Fair travel conditions with potential rain showers in ${locationName}`,
      summary: `There is a ${precipProb}% chance of rain ${dayLabel} with gentle to moderate winds (${windSpeed} km/h).`,
      recommendation: `Travel is generally fine, but keep rain gear in your vehicle and allow a few extra minutes for potential wet commutes.`,
      riskLevel: RISK_LEVELS.MODERATE,
      icon: 'Navigation',
    }
  }

  // Favorable travel
  return {
    type: 'travel',
    headline: `Favorable travel conditions in ${locationName} ${dayLabel}`,
    summary: `Dry conditions with low rain probability (${precipProb}%) and calm winds (${windSpeed} km/h).`,
    recommendation: `Good driving and transit conditions expected. Highway driving and inter-city travel should be smooth.`,
    riskLevel: RISK_LEVELS.LOW,
    icon: 'CheckCircle',
  }
}

/**
 * Generates a location-specific Agriculture Advisory.
 * Adheres strictly to cautious advisory language ("may", "consider", "likely", "monitor", "expected").
 */
export function generateAgricultureAdvisory(metrics, locationName, risk) {
  const { period, precipProb, precipSum, tempMax, windSpeed, humidity } = metrics
  const dayLabel = period === 'tomorrow' ? 'tomorrow' : 'today'

  // Significant rain expected (> 5mm or >= 70% probability)
  if (precipProb >= 70 || precipSum >= 5) {
    return {
      type: 'agriculture',
      headline: `Rain expected in ${locationName} — consider pausing irrigation`,
      summary: `Rain is expected ${dayLabel} in ${locationName} with a ${precipProb}% probability and approximately ${precipSum} mm of precipitation.`,
      recommendation: `Consider holding off on scheduled irrigation and pesticide/fertilizer spraying to avoid chemical runoff. Ensure proper drainage in low-lying fields and monitor the latest forecast.`,
      riskLevel: RISK_LEVELS.MODERATE,
      icon: 'Sprout',
    }
  }

  // Moderate rain chance (2-5mm or 40-69% probability)
  if (precipProb >= 40 || precipSum >= 2) {
    return {
      type: 'agriculture',
      headline: `Light showers possible in ${locationName} — monitor soil moisture`,
      summary: `There is a moderate ${precipProb}% chance of precipitation ${dayLabel} with approximately ${precipSum} mm expected.`,
      recommendation: `Consider inspecting soil moisture before running full irrigation cycles. Delay foliar spraying if showers develop, and monitor local atmospheric conditions.`,
      riskLevel: RISK_LEVELS.LOW,
      icon: 'CloudRain',
    }
  }

  // High winds impact on spraying/standing crops
  if (windSpeed >= 28) {
    return {
      type: 'agriculture',
      headline: `Elevated wind speeds in ${locationName} — caution for spraying`,
      summary: `Wind speeds are expected around ${windSpeed} km/h ${dayLabel}.`,
      recommendation: `Stronger gusts may cause spray drift and affect pesticide distribution. Consider postponing chemical application to calmer morning or evening hours and check staking for vulnerable crops.`,
      riskLevel: RISK_LEVELS.MODERATE,
      icon: 'Wind',
    }
  }

  // High heat & dry conditions
  if (tempMax != null && tempMax >= 36) {
    return {
      type: 'agriculture',
      headline: `High temperatures in ${locationName} — consider light irrigation`,
      summary: `Warm and dry weather with highs near ${tempMax}°C and rain probability around ${precipProb}%.`,
      recommendation: `High evapo-transpiration rates are likely. Consider irrigating early in the morning or late in the evening to minimize evaporative loss and preserve crop moisture.`,
      riskLevel: RISK_LEVELS.LOW,
      icon: 'Sun',
    }
  }

  // Settled farming conditions
  return {
    type: 'agriculture',
    headline: `Stable weather conditions in ${locationName} for farm operations`,
    summary: `Dry and steady conditions expected ${dayLabel} (${precipProb}% rain chance, ${windSpeed} km/h wind, ~${humidity}% humidity).`,
    recommendation: `Favorable window for routine field operations, scheduled irrigation, harvesting, and crop protection activities. Continue monitoring regular weather updates.`,
    riskLevel: RISK_LEVELS.LOW,
    icon: 'CheckCircle',
  }
}

/**
 * Main function to generate a comprehensive advisory package for the UI or Chatbot.
 */
export function generateLocationAdvisory({
  weatherData,
  snapshot,
  locationName = 'Current Location',
  period = 'tomorrow',
}) {
  if (!weatherData && !snapshot) {
    return null
  }

  const metrics = extractPeriodMetrics(weatherData, snapshot, period)
  const risk = evaluateRisk(snapshot)

  const general = generateGeneralAdvisory(metrics, locationName, risk)
  const travel = generateTravelAdvisory(metrics, locationName, risk)
  const agriculture = generateAgricultureAdvisory(metrics, locationName, risk)

  return {
    locationName,
    period: metrics.period,
    metrics,
    risk,
    general,
    travel,
    agriculture,
  }
}
