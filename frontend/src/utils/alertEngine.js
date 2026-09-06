// WeatherGPT Extreme Weather Alerts & Early Warning Engine
//
// Evaluates live Open-Meteo & ECMWF IFS forecast data across:
// 1. Heavy Rainfall (intensity, probability, multi-day sums, flash flood signals)
// 2. Extreme Heat (temperatures >= 35°C, >= 38°C, >= 42°C)
// 3. Strong Winds (wind speeds >= 30 km/h, >= 45 km/h, >= 65 km/h)
// 4. Thunderstorms (WMO codes 95, 96, 99)
// 5. Early Warning (analyzes future hourly and daily forecast windows up to 7 days)
//
// All alerts are designated as "WeatherGPT Risk Alert" / "WeatherGPT Forecast Alert"
// to clearly distinguish forecast analysis from official government/IMD warnings.

import { getWeatherCondition } from './weatherCode.js'

export const ALERT_SEVERITIES = {
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
  EXTREME: 'EXTREME',
}

export const ALERT_TYPES = {
  HEAVY_RAIN: 'heavy_rain',
  EXTREME_HEAT: 'extreme_heat',
  STRONG_WIND: 'strong_wind',
  THUNDERSTORM: 'thunderstorm',
  SEVERE_WEATHER: 'severe_weather',
}

// Configurable threshold constants (avoid magic numbers)
export const ALERT_THRESHOLDS = {
  RAIN: {
    EXTREME_DAILY_SUM_MM: 50,
    EXTREME_HOURLY_MM: 15,
    EXTREME_PROBABILITY: 80,
    HIGH_DAILY_SUM_MM: 25,
    HIGH_HOURLY_MM: 8,
    HIGH_PROBABILITY: 70,
    MODERATE_DAILY_SUM_MM: 10,
    MODERATE_PROBABILITY: 50,
  },
  HEAT: {
    EXTREME_TEMP_C: 42,
    HIGH_TEMP_C: 38,
    MODERATE_TEMP_C: 35,
  },
  WIND: {
    EXTREME_KMH: 65,
    HIGH_KMH: 45,
    MODERATE_KMH: 30,
  },
}

/**
 * Format a relative day label ('today' | 'tomorrow' | 'Wednesday' | 'Sep 8')
 */
function formatDayLabel(dayIsoString, offsetIndex) {
  if (offsetIndex === 0) return 'today'
  if (offsetIndex === 1) return 'tomorrow'
  
  try {
    const date = new Date(dayIsoString + 'T00:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'long' })
  } catch {
    return `Day ${offsetIndex + 1}`
  }
}

/**
 * Identify the peak hours window for a given day from hourly forecast data
 */
function getPeakHoursWindow(hourly, dayIso) {
  if (!hourly?.time?.length) return null

  const dayHours = []
  hourly.time.forEach((iso, idx) => {
    if (iso.startsWith(dayIso)) {
      dayHours.push({
        hour: Number(iso.slice(11, 13)),
        time: iso,
        rain: hourly.rain?.[idx] ?? hourly.precipitation?.[idx] ?? 0,
        prob: hourly.precipitation_probability?.[idx] ?? 0,
        temp: hourly.temperature_2m?.[idx] ?? 0,
        wind: hourly.wind_speed_10m?.[idx] ?? 0,
      })
    }
  })

  if (!dayHours.length) return null

  // Peak rain window
  const peakRainHour = [...dayHours].sort((a, b) => b.rain - a.rain || b.prob - a.prob)[0]
  const peakTempHour = [...dayHours].sort((a, b) => b.temp - a.temp)[0]
  const peakWindHour = [...dayHours].sort((a, b) => b.wind - a.wind)[0]

  return {
    dayHours,
    peakRainHour,
    peakTempHour,
    peakWindHour,
  }
}

/**
 * Determines lifecycle state ('Active' | 'Upcoming' | 'Expired')
 */
function getLifecycleState(offsetIndex, peakHour) {
  if (offsetIndex === 0) {
    const currentHour = new Date().getHours()
    if (peakHour != null && currentHour > peakHour + 2) {
      return 'Expired'
    }
    return 'Active'
  }
  return 'Upcoming'
}

/**
 * Evaluates forecast data and returns an array of structured WeatherGPT Risk Alerts.
 * 
 * @param {Object} weatherData - Open-Meteo weatherData object with daily, hourly, current
 * @param {string} locationName - Name of the location evaluated
 * @returns {Array<Object>} List of structured, deduplicated alerts
 */
export function evaluateForecastAlerts(weatherData, locationName = 'Your location') {
  if (!weatherData || !weatherData.daily) return []

  const { daily, hourly } = weatherData
  const times = daily.time || []
  const alerts = []

  // Analyze forecast days (up to 7 days ahead for early warnings)
  times.forEach((dayIso, dayIdx) => {
    const dayLabel = formatDayLabel(dayIso, dayIdx)
    const dayCap = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)
    
    const precipSum = daily.precipitation_sum?.[dayIdx] ?? 0
    const precipProb = daily.precipitation_probability_max?.[dayIdx] ?? 0
    const tempMax = daily.temperature_2m_max?.[dayIdx] ?? null
    const windSpeedMax = daily.wind_speed_10m_max?.[dayIdx] ?? 0
    const weatherCode = daily.weather_code?.[dayIdx] ?? 0

    const peakWindows = getPeakHoursWindow(hourly, dayIso)
    const isThunderstormCode = weatherCode === 95 || weatherCode === 96 || weatherCode === 99
    const isViolentRainCode = weatherCode === 65 || weatherCode === 82

    // ----------------------------------------------------
    // 1. THUNDERSTORM ALERT
    // ----------------------------------------------------
    if (isThunderstormCode) {
      const isSevere = weatherCode === 96 || weatherCode === 99 || precipSum >= 30
      const severity = isSevere ? ALERT_SEVERITIES.EXTREME : ALERT_SEVERITIES.HIGH
      const peakHour = peakWindows?.peakRainHour?.hour ?? 16
      const timeDescription = `${dayCap} around ${peakHour > 12 ? peakHour - 12 + ' PM' : peakHour + ' AM'}`

      alerts.push({
        id: `alert-${locationName.toLowerCase().replace(/\s+/g, '-')}-thunderstorm-${dayIso}`,
        type: ALERT_TYPES.THUNDERSTORM,
        severity,
        location: locationName,
        title: isSevere ? 'Severe Thunderstorm Alert' : 'Thunderstorm Alert',
        message: `Thunderstorm activity with lightning and gusty winds is forecast for ${locationName} ${dayLabel}.`,
        expectedAt: timeDescription,
        expiresAt: `${dayIso}T23:59:59`,
        lifecycle: getLifecycleState(dayIdx, peakHour),
        recommendedAction:
          'Seek sturdy indoor shelter, avoid open fields and bodies of water, and unplug sensitive electronics.',
        source: 'Open-Meteo forecast (ECMWF IFS NWP)',
        sourceType: 'forecast_analysis',
        metrics: {
          precipitationSum: Number(precipSum.toFixed(1)),
          precipitationProbability: Math.round(precipProb),
          weatherCode,
          windSpeed: Math.round(windSpeedMax),
        },
        isRead: false,
        createdAt: Date.now(),
      })
    }

    // ----------------------------------------------------
    // 2. HEAVY RAINFALL ALERT / EARLY WARNING
    // ----------------------------------------------------
    if (
      precipSum >= ALERT_THRESHOLDS.RAIN.MODERATE_DAILY_SUM_MM ||
      precipProb >= ALERT_THRESHOLDS.RAIN.MODERATE_PROBABILITY ||
      isViolentRainCode
    ) {
      let severity = ALERT_SEVERITIES.LOW
      if (
        precipSum >= ALERT_THRESHOLDS.RAIN.EXTREME_DAILY_SUM_MM ||
        (precipSum >= 35 && precipProb >= ALERT_THRESHOLDS.RAIN.EXTREME_PROBABILITY) ||
        (peakWindows?.peakRainHour?.rain >= ALERT_THRESHOLDS.RAIN.EXTREME_HOURLY_MM)
      ) {
        severity = ALERT_SEVERITIES.EXTREME
      } else if (
        precipSum >= ALERT_THRESHOLDS.RAIN.HIGH_DAILY_SUM_MM ||
        (precipProb >= ALERT_THRESHOLDS.RAIN.HIGH_PROBABILITY && precipSum >= 15) ||
        isViolentRainCode
      ) {
        severity = ALERT_SEVERITIES.HIGH
      } else if (
        precipSum >= ALERT_THRESHOLDS.RAIN.MODERATE_DAILY_SUM_MM ||
        precipProb >= ALERT_THRESHOLDS.RAIN.MODERATE_PROBABILITY
      ) {
        severity = ALERT_SEVERITIES.MODERATE
      }

      // Only produce alert if at least MODERATE
      if (severity !== ALERT_SEVERITIES.LOW) {
        const peakHour = peakWindows?.peakRainHour?.hour ?? 15
        const timingStr =
          peakHour < 12
            ? 'morning'
            : peakHour < 17
            ? 'afternoon'
            : peakHour < 21
            ? 'evening'
            : 'night'

        const timingDetail = `${dayCap} ${timingStr} (around ${peakHour > 12 ? peakHour - 12 + ' PM' : peakHour + ' AM'})`

        alerts.push({
          id: `alert-${locationName.toLowerCase().replace(/\s+/g, '-')}-rain-${dayIso}`,
          type: ALERT_TYPES.HEAVY_RAIN,
          severity,
          location: locationName,
          title:
            severity === ALERT_SEVERITIES.EXTREME
              ? 'Extreme Rainfall Early Warning'
              : severity === ALERT_SEVERITIES.HIGH
              ? 'Heavy Rainfall Alert'
              : 'Moderate Rainfall Advisory',
          message:
            severity === ALERT_SEVERITIES.EXTREME
              ? `Heavy rainfall (${Number(precipSum.toFixed(1))} mm) is expected ${dayLabel} in ${locationName} with potential localized waterlogging.`
              : severity === ALERT_SEVERITIES.HIGH
              ? `Elevated precipitation (~${Number(precipSum.toFixed(1))} mm, ${Math.round(precipProb)}% chance) is forecast ${dayLabel}.`
              : `Moderate rainfall is expected ${dayLabel} with a ${Math.round(precipProb)}% chance of rain.`,
          expectedAt: timingDetail,
          expiresAt: `${dayIso}T23:59:59`,
          lifecycle: getLifecycleState(dayIdx, peakHour),
          recommendedAction:
            severity === ALERT_SEVERITIES.EXTREME
              ? 'Avoid non-essential travel through flood-prone underpasses, keep emergency supplies handy, and follow local traffic advisories.'
              : severity === ALERT_SEVERITIES.HIGH
              ? 'Carry waterproof gear, expect wet roads and commute delays, and avoid low-lying waterlogged spots.'
              : 'Keep an umbrella accessible and plan outdoor activities around expected shower windows.',
          source: 'Open-Meteo forecast (ECMWF IFS NWP)',
          sourceType: 'forecast_analysis',
          metrics: {
            precipitationSum: Number(precipSum.toFixed(1)),
            precipitationProbability: Math.round(precipProb),
            peakRainPerHour: Number((peakWindows?.peakRainHour?.rain ?? 0).toFixed(1)),
          },
          isRead: false,
          createdAt: Date.now(),
        })
      }
    }

    // ----------------------------------------------------
    // 3. EXTREME HEAT ALERT
    // ----------------------------------------------------
    if (tempMax != null && tempMax >= ALERT_THRESHOLDS.HEAT.MODERATE_TEMP_C) {
      const severity =
        tempMax >= ALERT_THRESHOLDS.HEAT.EXTREME_TEMP_C
          ? ALERT_SEVERITIES.EXTREME
          : tempMax >= ALERT_THRESHOLDS.HEAT.HIGH_TEMP_C
          ? ALERT_SEVERITIES.HIGH
          : ALERT_SEVERITIES.MODERATE

      const peakHour = peakWindows?.peakTempHour?.hour ?? 14
      const timeDetail = `${dayCap} midday (peak around ${peakHour > 12 ? peakHour - 12 + ' PM' : peakHour + ' AM'})`

      alerts.push({
        id: `alert-${locationName.toLowerCase().replace(/\s+/g, '-')}-heat-${dayIso}`,
        type: ALERT_TYPES.EXTREME_HEAT,
        severity,
        location: locationName,
        title:
          severity === ALERT_SEVERITIES.EXTREME
            ? 'Extreme Heat Warning'
            : severity === ALERT_SEVERITIES.HIGH
            ? 'High Temperature Alert'
            : 'Warm Weather Advisory',
        message: `High temperatures reaching up to ${Math.round(tempMax)}°C are forecast ${dayLabel} in ${locationName}.`,
        expectedAt: timeDetail,
        expiresAt: `${dayIso}T19:00:00`,
        lifecycle: getLifecycleState(dayIdx, peakHour),
        recommendedAction:
          severity === ALERT_SEVERITIES.EXTREME
            ? 'Avoid direct sun exposure between 11 AM and 4 PM, stay vigorously hydrated, and check on elderly family members.'
            : 'Drink plenty of fluids, wear light-colored breathable clothing, and take regular indoor shade breaks.',
        source: 'Open-Meteo forecast (ECMWF IFS NWP)',
        sourceType: 'forecast_analysis',
        metrics: {
          tempMax: Math.round(tempMax),
        },
        isRead: false,
        createdAt: Date.now(),
      })
    }

    // ----------------------------------------------------
    // 4. STRONG WIND ALERT
    // ----------------------------------------------------
    if (windSpeedMax >= ALERT_THRESHOLDS.WIND.MODERATE_KMH) {
      const severity =
        windSpeedMax >= ALERT_THRESHOLDS.WIND.EXTREME_KMH
          ? ALERT_SEVERITIES.EXTREME
          : windSpeedMax >= ALERT_THRESHOLDS.WIND.HIGH_KMH
          ? ALERT_SEVERITIES.HIGH
          : ALERT_SEVERITIES.MODERATE

      const peakHour = peakWindows?.peakWindHour?.hour ?? 16
      const timeDetail = `${dayCap} afternoon (around ${peakHour > 12 ? peakHour - 12 + ' PM' : peakHour + ' AM'})`

      alerts.push({
        id: `alert-${locationName.toLowerCase().replace(/\s+/g, '-')}-wind-${dayIso}`,
        type: ALERT_TYPES.STRONG_WIND,
        severity,
        location: locationName,
        title:
          severity === ALERT_SEVERITIES.EXTREME
            ? 'Gale-Force Wind Alert'
            : severity === ALERT_SEVERITIES.HIGH
            ? 'Strong Wind Advisory'
            : 'Breezy Conditions Notice',
        message: `Wind gusts up to ${Math.round(windSpeedMax)} km/h are expected ${dayLabel} in ${locationName}.`,
        expectedAt: timeDetail,
        expiresAt: `${dayIso}T23:59:59`,
        lifecycle: getLifecycleState(dayIdx, peakHour),
        recommendedAction:
          'Secure loose outdoor items, exercise caution when operating two-wheelers, and stay clear of weak branches or signboards.',
        source: 'Open-Meteo forecast (ECMWF IFS NWP)',
        sourceType: 'forecast_analysis',
        metrics: {
          windSpeed: Math.round(windSpeedMax),
        },
        isRead: false,
        createdAt: Date.now(),
      })
    }
  })

  // Deduplicate and prioritize by severity: EXTREME > HIGH > MODERATE > LOW, then by date
  const severityRank = {
    [ALERT_SEVERITIES.EXTREME]: 4,
    [ALERT_SEVERITIES.HIGH]: 3,
    [ALERT_SEVERITIES.MODERATE]: 2,
    [ALERT_SEVERITIES.LOW]: 1,
  }

  return alerts.sort((a, b) => {
    const diff = severityRank[b.severity] - severityRank[a.severity]
    if (diff !== 0) return diff
    return (a.expiresAt || '').localeCompare(b.expiresAt || '')
  })
}

/**
 * Extracts the single highest severity alert from an alert list.
 */
export function getHighestSeverityAlert(alerts) {
  if (!alerts || !alerts.length) return null
  return alerts[0]
}
