// WeatherGPT Authoritative Weather Analysis & Context Engine (Backend)
//
// Authoritative logic layers:
// 1. Weather Code interpretation (WMO codes)
// 2. Risk Engine (LOW, MODERATE, HIGH, EXTREME)
// 3. Advisory Engine (General, Travel, Agriculture, Outdoor)
// 4. Alert Engine (Extreme rainfall, heat, wind, thunderstorm warnings)
// 5. Climate Analysis Engine (Linear trend, slope, reanalysis aggregations)
// 6. Compact Structured Weather Context Builder for Gemini
// 7. Deterministic Fallback Response Generator (if Gemini is unavailable)

// ----------------------------------------------------
// 1. WMO WEATHER CODE MAPPING
// ----------------------------------------------------
const CODE_MAP = {
  0: { label: 'Clear Sky', category: 'clear' },
  1: { label: 'Mostly Clear', category: 'cloudy' },
  2: { label: 'Partly Cloudy', category: 'cloudy' },
  3: { label: 'Overcast', category: 'cloudy' },
  45: { label: 'Fog', category: 'fog' },
  48: { label: 'Depositing Rime Fog', category: 'fog' },
  51: { label: 'Light Drizzle', category: 'drizzle' },
  53: { label: 'Drizzle', category: 'drizzle' },
  55: { label: 'Dense Drizzle', category: 'drizzle' },
  56: { label: 'Freezing Drizzle', category: 'drizzle' },
  57: { label: 'Dense Freezing Drizzle', category: 'drizzle' },
  61: { label: 'Light Rain', category: 'rain' },
  63: { label: 'Rain', category: 'rain' },
  65: { label: 'Heavy Rain', category: 'rain' },
  66: { label: 'Freezing Rain', category: 'rain' },
  67: { label: 'Heavy Freezing Rain', category: 'rain' },
  71: { label: 'Light Snow', category: 'snow' },
  73: { label: 'Snow', category: 'snow' },
  75: { label: 'Heavy Snow', category: 'snow' },
  77: { label: 'Snow Grains', category: 'snow' },
  80: { label: 'Light Rain Showers', category: 'rain' },
  81: { label: 'Rain Showers', category: 'rain' },
  82: { label: 'Violent Rain Showers', category: 'rain' },
  85: { label: 'Light Snow Showers', category: 'snow' },
  86: { label: 'Heavy Snow Showers', category: 'snow' },
  95: { label: 'Thunderstorm', category: 'storm' },
  96: { label: 'Thunderstorm with Hail', category: 'storm' },
  99: { label: 'Severe Thunderstorm with Hail', category: 'storm' },
}

function getWeatherCondition(code) {
  return CODE_MAP[code] ?? { label: 'Variable conditions', category: 'cloudy' }
}

function isRainCategory(category) {
  return category === 'rain' || category === 'drizzle' || category === 'storm'
}

// ----------------------------------------------------
// 2. RISK ENGINE
// ----------------------------------------------------
const RISK_LEVELS = {
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
  EXTREME: 'EXTREME',
}

function evaluateRisk(snapshot) {
  if (!snapshot) {
    return {
      level: RISK_LEVELS.LOW,
      title: 'Settled conditions',
      description: 'Weather observations indicate no immediate hazards.',
      recommendation: 'Normal activities may proceed.',
    }
  }

  const { weatherCode, precipitationProbability = 0, windSpeed = 0, rain = 0 } = snapshot
  const isStorm = weatherCode === 95 || weatherCode === 96 || weatherCode === 99
  const isHeavyRainCode = weatherCode === 65 || weatherCode === 82

  if (isStorm || (rain >= 10 && precipitationProbability >= 70)) {
    return {
      level: RISK_LEVELS.EXTREME,
      title: 'Thunderstorm / severe rain risk',
      description:
        'Atmospheric data indicates severe thunderstorm or intense downpour potential with lightning and sudden wind gusts.',
      recommendation: 'Avoid open areas and non-essential travel until conditions stabilize.',
    }
  }

  if (isHeavyRainCode || (precipitationProbability >= 70 && rain >= 4) || windSpeed >= 40) {
    return {
      level: RISK_LEVELS.HIGH,
      title: 'Heavy precipitation or gusty winds likely',
      description:
        'Precipitation intensity or wind speed is elevated enough to disrupt transit, roads, and outdoor plans.',
      recommendation: 'Carry rain protection, drive cautiously, and verify road conditions.',
    }
  }

  if (precipitationProbability >= 40 || windSpeed >= 25) {
    return {
      level: RISK_LEVELS.MODERATE,
      title: 'Moderate rain or breezy weather possible',
      description: 'A notable chance of rainfall or fresh breezes during the period.',
      recommendation: 'Outdoor plans are generally fine, but keep rain gear or indoor alternatives available.',
    }
  }

  return {
    level: RISK_LEVELS.LOW,
    title: 'Conditions look settled',
    description: 'No significant rain, wind, or storm signals in the data.',
    recommendation: 'Favorable window for outdoor activities and travel.',
  }
}

// ----------------------------------------------------
// 3. ADVISORY ENGINE
// ----------------------------------------------------
function extractPeriodMetrics(weatherData, snapshot, period = 'tomorrow') {
  const daily = weatherData?.daily
  let dayIdx = 1
  let periodName = 'tomorrow'

  if (typeof period === 'number') {
    dayIdx = Math.max(0, Math.min(6, period))
    periodName = dayIdx === 0 ? 'today' : dayIdx === 1 ? 'tomorrow' : dayIdx === 2 ? 'day after tomorrow' : `day ${dayIdx + 1}`
  } else if (typeof period === 'string') {
    const p = period.toLowerCase()
    if (p.includes('day after') || p.includes('overmorrow') || p === '2') {
      dayIdx = 2
      periodName = 'day after tomorrow'
    } else if (p.includes('today') || p === '0' || p === 'now') {
      dayIdx = 0
      periodName = 'today'
    } else {
      dayIdx = 1
      periodName = 'tomorrow'
    }
  }

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

  const humidity = snapshot?.humidity ?? 65
  const condition = getWeatherCondition(weatherCode)

  return {
    period: periodName,
    precipProb: Math.round(precipProb),
    precipSum: Number(Number(precipSum).toFixed(1)),
    tempMax: tempMax != null ? Math.round(tempMax) : null,
    tempMin: tempMin != null ? Math.round(tempMin) : null,
    windSpeed: Math.round(windSpeed),
    humidity: Math.round(humidity),
    weatherCode,
    conditionLabel: condition.label,
    isRainy: isRainCategory(condition.category) || precipProb >= 40,
  }
}

function generateAdvisories(metrics, risk) {
  const advisories = {
    general: '',
    travel: '',
    agriculture: '',
    outdoor: '',
  }

  // Travel Advisory
  if (risk.level === RISK_LEVELS.EXTREME) {
    advisories.travel =
      'Travel Warning: Heavy rain or thunderstorm conditions may cause waterlogging and low visibility. Avoid non-essential road travel.'
  } else if (risk.level === RISK_LEVELS.HIGH || metrics.precipProb >= 60 || metrics.precipSum >= 5) {
    advisories.travel =
      'Travel Caution: Wet roads and showers expected. Carry rain protection, allow extra travel time, and exercise caution while driving.'
  } else if (metrics.precipProb >= 30) {
    advisories.travel =
      'Normal Travel with Light Caution: Spotty showers possible. Commutes should generally proceed smoothly; keeping an umbrella is prudent.'
  } else {
    advisories.travel =
      'Favorable Travel: Clear to partly cloudy conditions with dry roadways. Good conditions for commuting and highway driving.'
  }

  // Outdoor Advisory
  if (metrics.tempMax && metrics.tempMax >= 38) {
    advisories.outdoor =
      'Extreme Heat Precaution: Temperatures exceed 38°C. Stay well hydrated, avoid midday sun exposure between 12 PM and 4 PM, and wear light clothing.'
  } else if (metrics.tempMax && metrics.tempMax >= 35) {
    advisories.outdoor =
      'Warm Conditions: Peak afternoon temperature around ' +
      metrics.tempMax +
      '°C. Plan strenuous outdoor activities for morning or late evening.'
  } else if (metrics.isRainy) {
    advisories.outdoor =
      'Rain Alert for Outdoors: High probability of showers (' +
      metrics.precipProb +
      '%). Carry an umbrella or plan indoor venues.'
  } else {
    advisories.outdoor =
      'Pleasant for Outdoors: Temperature around ' +
      (metrics.tempMax || 28) +
      '°C with settled skies. Suitable for outdoor sports and walks.'
  }

  // Agriculture Advisory
  if (metrics.precipSum >= 15 || metrics.precipProb >= 70) {
    advisories.agriculture =
      'Irrigation Alert: Substantial rainfall (' +
      metrics.precipSum +
      ' mm, ' +
      metrics.precipProb +
      '%) anticipated. Postpone field irrigation and chemical spraying to avoid nutrient runoff.'
  } else if (metrics.precipProb >= 40) {
    advisories.agriculture =
      'Moderate Irrigation: Scattered showers likely. Monitor soil moisture before scheduling irrigation.'
  } else {
    advisories.agriculture =
      'Routine Field Work: Dry conditions suitable for irrigation, fertilizer application, and harvesting.'
  }

  return advisories
}

// ----------------------------------------------------
// 4. ALERT ENGINE (Early Warning Evaluation)
// ----------------------------------------------------
function evaluateAlerts(weatherData) {
  const alerts = []
  if (!weatherData?.daily) return alerts

  const daily = weatherData.daily
  const days = Math.min(daily.time?.length || 0, 7)

  for (let i = 0; i < days; i++) {
    const dayLabel = i === 0 ? 'today' : i === 1 ? 'tomorrow' : daily.time[i]
    const precipSum = daily.precipitation_sum?.[i] || 0
    const precipProb = daily.precipitation_probability_max?.[i] || 0
    const tempMax = daily.temperature_2m_max?.[i] || 0
    const windMax = daily.wind_speed_10m_max?.[i] || 0
    const code = daily.weather_code?.[i] || 0

    // Heavy rain alert
    if (precipSum >= 50 || (precipSum >= 25 && precipProb >= 80)) {
      alerts.push({
        type: 'Heavy Rainfall',
        severity: precipSum >= 50 ? 'EXTREME' : 'HIGH',
        period: dayLabel,
        rainProbability: `${precipProb}%`,
        expectedRainfall: `${precipSum.toFixed(1)} mm`,
        recommendation: 'Avoid flood-prone roads and secure outdoor items.',
        source: 'WeatherGPT Forecast Alert',
      })
    } else if (precipSum >= 15 && precipProb >= 65) {
      alerts.push({
        type: 'Moderate to Heavy Rain',
        severity: 'MODERATE',
        period: dayLabel,
        rainProbability: `${precipProb}%`,
        expectedRainfall: `${precipSum.toFixed(1)} mm`,
        recommendation: 'Keep rain gear ready and monitor weather updates.',
        source: 'WeatherGPT Forecast Alert',
      })
    }

    // Heat alert
    if (tempMax >= 42) {
      alerts.push({
        type: 'Severe Heatwave',
        severity: 'EXTREME',
        period: dayLabel,
        maxTemp: `${Math.round(tempMax)}°C`,
        recommendation: 'Remain indoors during peak hours, drink plenty of water.',
        source: 'WeatherGPT Forecast Alert',
      })
    } else if (tempMax >= 38) {
      alerts.push({
        type: 'Elevated Heat Alert',
        severity: 'HIGH',
        period: dayLabel,
        maxTemp: `${Math.round(tempMax)}°C`,
        recommendation: 'Stay hydrated and limit direct midday sun exposure.',
        source: 'WeatherGPT Forecast Alert',
      })
    }

    // Thunderstorm alert
    if (code === 95 || code === 96 || code === 99) {
      alerts.push({
        type: 'Thunderstorm Warning',
        severity: code === 99 ? 'EXTREME' : 'HIGH',
        period: dayLabel,
        recommendation: 'Seek sturdy shelter, avoid tall trees and metallic structures.',
        source: 'WeatherGPT Forecast Alert',
      })
    }

    // Wind alert
    if (windMax >= 55) {
      alerts.push({
        type: 'High Wind Warning',
        severity: windMax >= 65 ? 'EXTREME' : 'HIGH',
        period: dayLabel,
        windSpeed: `${Math.round(windMax)} km/h`,
        recommendation: 'Beware of flying debris and tree branches.',
        source: 'WeatherGPT Forecast Alert',
      })
    }
  }

  return alerts
}

// ----------------------------------------------------
// 5. CLIMATE & HISTORICAL ANALYSIS ENGINE
// ----------------------------------------------------
function analyzeHistoricalTrends(historicalResult) {
  if (!historicalResult?.daily?.time?.length) return null
  const daily = historicalResult.daily

  const yearlyMap = new Map()
  daily.time.forEach((dateStr, idx) => {
    const year = dateStr.slice(0, 4)
    if (!yearlyMap.has(year)) {
      yearlyMap.set(year, {
        year: Number(year),
        tempSum: 0,
        tempCount: 0,
        precipSum: 0,
        validDays: 0,
      })
    }
    const y = yearlyMap.get(year)
    const tMean = daily.temperature_2m_mean?.[idx]
    const pSum = daily.precipitation_sum?.[idx]
    if (tMean != null) {
      y.tempSum += tMean
      y.tempCount++
    }
    if (pSum != null) {
      y.precipSum += pSum
      y.validDays++
    }
  })

  const yearlySeries = Array.from(yearlyMap.values())
    .filter((y) => y.tempCount >= 30)
    .map((y) => ({
      year: y.year,
      avgTemp: Number((y.tempSum / y.tempCount).toFixed(2)),
      totalPrecip: Number(y.precipSum.toFixed(1)),
    }))
    .sort((a, b) => a.year - b.year)

  if (yearlySeries.length < 2) return null

  // Linear trend for temperature: y = slope * x + intercept
  const n = yearlySeries.length
  const xVals = yearlySeries.map((s) => s.year)
  const yVals = yearlySeries.map((s) => s.avgTemp)
  const xMean = xVals.reduce((a, b) => a + b, 0) / n
  const yMean = yVals.reduce((a, b) => a + b, 0) / n

  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xVals[i] - xMean) * (yVals[i] - yMean)
    den += (xVals[i] - xMean) ** 2
  }
  const slope = den !== 0 ? num / den : 0
  const trendDirection = slope > 0.02 ? 'Increasing' : slope < -0.02 ? 'Decreasing' : 'Stable'

  const firstYear = yearlySeries[0]
  const lastYear = yearlySeries[yearlySeries.length - 1]
  const overallAvg = Number((yVals.reduce((a, b) => a + b, 0) / n).toFixed(1))

  // Linear trend for annual precipitation
  const pVals = yearlySeries.map((s) => s.totalPrecip)
  const pMean = pVals.reduce((a, b) => a + b, 0) / n

  let pNum = 0
  let pDen = 0
  for (let i = 0; i < n; i++) {
    pNum += (xVals[i] - xMean) * (pVals[i] - pMean)
    pDen += (xVals[i] - xMean) ** 2
  }
  const precipSlope = pDen !== 0 ? pNum / pDen : 0
  const precipTrendDirection = precipSlope > 5 ? 'Increasing' : precipSlope < -5 ? 'Decreasing' : 'Stable'
  const overallAvgPrecip = Number(pMean.toFixed(1))

  let wettest = yearlySeries[0]
  let driest = yearlySeries[0]
  for (const item of yearlySeries) {
    if (item.totalPrecip > wettest.totalPrecip) wettest = item
    if (item.totalPrecip < driest.totalPrecip) driest = item
  }

  return {
    period: `${firstYear.year} - ${lastYear.year}`,
    metric: 'Annual Mean Temperature & Precipitation',
    trend: trendDirection,
    slope: `${slope >= 0 ? '+' : ''}${slope.toFixed(3)}°C/year`,
    historicalAverage: `${overallAvg}°C`,
    earliestAverage: `${firstYear.avgTemp}°C (${firstYear.year})`,
    recentAverage: `${lastYear.avgTemp}°C (${lastYear.year})`,
    // Precipitation trends & statistics
    precipTrend: precipTrendDirection,
    precipSlope: `${precipSlope >= 0 ? '+' : ''}${precipSlope.toFixed(2)} mm/year`,
    averageAnnualPrecipitation: `${overallAvgPrecip} mm`,
    wettestYear: `${wettest.year} (${wettest.totalPrecip} mm)`,
    driestYear: `${driest.year} (${driest.totalPrecip} mm)`,
    earliestPrecip: `${firstYear.totalPrecip} mm (${firstYear.year})`,
    recentPrecip: `${lastYear.totalPrecip} mm (${lastYear.year})`,
    yearlySeries,
    dataset: historicalResult.dataset || 'ECMWF ERA5 Reanalysis',
  }
}

// ----------------------------------------------------
// 6. COMPACT STRUCTURED CONTEXT BUILDER FOR GEMINI
// ----------------------------------------------------
// ----------------------------------------------------
// 6. COMPACT STRUCTURED CONTEXT BUILDER FOR GEMINI
// ----------------------------------------------------
function buildStructuredWeatherContext({
  location,
  weatherData,
  snapshot,
  metrics,
  todayMetrics,
  tomorrowMetrics,
  dayAfterTomorrowMetrics,
  risk,
  advisories,
  alerts,
  historicalAnalysis,
}) {
  const lines = []

  lines.push('=== REAL WEATHER CONTEXT (OPEN-METEO / AUTHORITATIVE) ===')
  lines.push(`LOCATION: ${location?.name || 'Unknown'}${location?.state ? ', ' + location.state : ''}`)
  if (location?.latitude && location?.longitude) {
    lines.push(`COORDINATES: ${location.latitude}, ${location.longitude}`)
  }

  if (snapshot) {
    const currentCond = getWeatherCondition(snapshot.weatherCode)
    lines.push('\nCURRENT OBSERVATIONS:')
    lines.push(`Temperature: ${snapshot.temperature != null ? snapshot.temperature + '°C' : 'N/A'}`)
    lines.push(`Condition: ${currentCond.label}`)
    lines.push(`Relative Humidity: ${snapshot.humidity != null ? snapshot.humidity + '%' : 'N/A'}`)
    lines.push(`Wind Speed: ${snapshot.windSpeed != null ? snapshot.windSpeed + ' km/h' : 'N/A'}`)
    if (snapshot.precipitationProbability != null) {
      lines.push(`Precipitation Probability: ${snapshot.precipitationProbability}%`)
    }
    if (snapshot.precipitation != null) {
      lines.push(`Precipitation: ${snapshot.precipitation} mm`)
    }
    if (snapshot.pressure != null) {
      lines.push(`Pressure: ${snapshot.pressure} hPa`)
    }
  }

  // Today's forecast
  const mToday = todayMetrics || (metrics?.period === 'today' ? metrics : extractPeriodMetrics(weatherData, snapshot, 0))
  if (mToday) {
    lines.push('\nTODAY FORECAST:')
    lines.push(`Max Temperature: ${mToday.tempMax != null ? mToday.tempMax + '°C' : 'N/A'}`)
    lines.push(`Min Temperature: ${mToday.tempMin != null ? mToday.tempMin + '°C' : 'N/A'}`)
    lines.push(`Rain Probability: ${mToday.precipProb}%`)
    lines.push(`Expected Rainfall: ${mToday.precipSum} mm`)
    lines.push(`Max Wind Speed: ${mToday.windSpeed} km/h`)
    lines.push(`Expected Condition: ${mToday.conditionLabel}`)
  }

  // Tomorrow's forecast
  const mTomorrow = tomorrowMetrics || (metrics?.period === 'tomorrow' ? metrics : extractPeriodMetrics(weatherData, snapshot, 1))
  if (mTomorrow) {
    lines.push('\nTOMORROW FORECAST:')
    lines.push(`Max Temperature: ${mTomorrow.tempMax != null ? mTomorrow.tempMax + '°C' : 'N/A'}`)
    lines.push(`Min Temperature: ${mTomorrow.tempMin != null ? mTomorrow.tempMin + '°C' : 'N/A'}`)
    lines.push(`Rain Probability: ${mTomorrow.precipProb}%`)
    lines.push(`Expected Rainfall: ${mTomorrow.precipSum} mm`)
    lines.push(`Max Wind Speed: ${mTomorrow.windSpeed} km/h`)
    lines.push(`Expected Condition: ${mTomorrow.conditionLabel}`)
  }

  // Day after tomorrow's forecast
  const mDayAfter = dayAfterTomorrowMetrics || extractPeriodMetrics(weatherData, snapshot, 2)
  if (mDayAfter && weatherData?.daily?.time?.[2]) {
    lines.push('\nDAY AFTER TOMORROW FORECAST:')
    lines.push(`Max Temperature: ${mDayAfter.tempMax != null ? mDayAfter.tempMax + '°C' : 'N/A'}`)
    lines.push(`Min Temperature: ${mDayAfter.tempMin != null ? mDayAfter.tempMin + '°C' : 'N/A'}`)
    lines.push(`Rain Probability: ${mDayAfter.precipProb}%`)
    lines.push(`Expected Rainfall: ${mDayAfter.precipSum} mm`)
    lines.push(`Max Wind Speed: ${mDayAfter.windSpeed} km/h`)
    lines.push(`Expected Condition: ${mDayAfter.conditionLabel}`)
  }

  // 7-day overview
  if (weatherData?.daily?.time?.length > 3) {
    lines.push('\n7-DAY FORECAST SUMMARY:')
    const daily = weatherData.daily
    for (let i = 0; i < Math.min(7, daily.time.length); i++) {
      const date = daily.time[i]
      const maxT = daily.temperature_2m_max?.[i]
      const minT = daily.temperature_2m_min?.[i]
      const pProb = daily.precipitation_probability_max?.[i]
      const pSum = daily.precipitation_sum?.[i]
      const cond = getWeatherCondition(daily.weather_code?.[i]).label
      const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : i === 2 ? 'Day After Tomorrow' : date
      lines.push(`- ${dayName} (${date}): ${cond} | High: ${maxT}°C, Low: ${minT}°C | Rain: ${pProb}% (${pSum} mm)`)
    }
  }

  if (risk) {
    lines.push('\nRISK ANALYSIS (WeatherGPT Risk Engine):')
    lines.push(`Level: ${risk.level}`)
    lines.push(`Assessment: ${risk.title} - ${risk.description}`)
    lines.push(`Recommendation: ${risk.recommendation}`)
  }

  if (advisories) {
    lines.push('\nAPPLICATION ADVISORIES:')
    if (advisories.travel) lines.push(`Travel Advisory: ${advisories.travel}`)
    if (advisories.outdoor) lines.push(`Outdoor Advisory: ${advisories.outdoor}`)
    if (advisories.agriculture) lines.push(`Agriculture Advisory: ${advisories.agriculture}`)
  }

  if (alerts && alerts.length > 0) {
    lines.push('\nACTIVE FORECAST ALERTS (WeatherGPT Early Warning Engine):')
    alerts.forEach((alt, idx) => {
      lines.push(
        `- Alert ${idx + 1}: ${alt.type} | Severity: ${alt.severity} | Period: ${alt.period} | Rec: ${alt.recommendation} | Source: ${alt.source}`
      )
    })
  }

  // NWP Model Context
  const model = weatherData?.model || 'ECMWF IFS'
  const provider = weatherData?.provider || 'Open-Meteo'
  lines.push('\nNUMERICAL WEATHER PREDICTION (NWP) INFO:')
  lines.push(`Model: ${model}`)
  lines.push(`Provider: ${provider}`)
  lines.push(
    `Description: ECMWF IFS (Integrated Forecasting System) is a leading global numerical weather prediction model operated by the European Centre for Medium-Range Weather Forecasts, retrieved via Open-Meteo.`
  )

  if (historicalAnalysis) {
    lines.push('\nHISTORICAL CLIMATE & RAINFALL ANALYSIS (ECMWF ERA5 Reanalysis):')
    lines.push(`Period: ${historicalAnalysis.period}`)
    lines.push(`Temperature Trend: ${historicalAnalysis.trend} (${historicalAnalysis.slope}) | Historical Average: ${historicalAnalysis.historicalAverage}`)
    lines.push(`Earliest Mean Temp: ${historicalAnalysis.earliestAverage} | Recent Mean Temp: ${historicalAnalysis.recentAverage}`)
    if (historicalAnalysis.precipTrend) {
      lines.push(`Rainfall Trend: ${historicalAnalysis.precipTrend} (${historicalAnalysis.precipSlope})`)
      lines.push(`Average Annual Rainfall: ${historicalAnalysis.averageAnnualPrecipitation}`)
      lines.push(`Wettest Year: ${historicalAnalysis.wettestYear}`)
      lines.push(`Driest Year: ${historicalAnalysis.driestYear}`)
      lines.push(`Recent Annual Rainfall: ${historicalAnalysis.recentPrecip}`)
    }
  }

  lines.push('\n=== END WEATHER CONTEXT ===')
  lines.push('INSTRUCTION FOR FACTS: Use ONLY the supplied weather context above for all weather facts, numbers, and predictions. NEVER fabricate or alter numbers.')

  return lines.join('\n')
}

// ----------------------------------------------------
// COMPARATIVE WEATHER CONTEXT BUILDER
// ----------------------------------------------------
function buildComparativeWeatherContext({
  loc1,
  loc2,
  snapshot1,
  snapshot2,
  metricsToday1,
  metricsToday2,
  metricsTomorrow1,
  metricsTomorrow2,
  risk1,
  risk2,
  advisories1,
  advisories2,
}) {
  const lines = []
  const name1 = loc1?.name || 'Location 1'
  const name2 = loc2?.name || 'Location 2'

  lines.push('=== REAL COMPARATIVE WEATHER CONTEXT (OPEN-METEO / AUTHORITATIVE) ===')
  lines.push(`Comparing: ${name1} vs ${name2}`)

  // Location 1
  lines.push(`\n--- LOCATION 1: ${name1} ---`)
  if (snapshot1) {
    const c1 = getWeatherCondition(snapshot1.weatherCode)
    lines.push(`Current: ${snapshot1.temperature != null ? snapshot1.temperature + '°C' : 'N/A'}, ${c1.label} | Humidity: ${snapshot1.humidity || 'N/A'}% | Wind: ${snapshot1.windSpeed || 'N/A'} km/h`)
  }
  if (metricsToday1) {
    lines.push(`Today Forecast: High ${metricsToday1.tempMax}°C, Low ${metricsToday1.tempMin}°C, Rain: ${metricsToday1.precipProb}% (${metricsToday1.precipSum} mm, ${metricsToday1.conditionLabel})`)
  }
  if (metricsTomorrow1) {
    lines.push(`Tomorrow Forecast: High ${metricsTomorrow1.tempMax}°C, Low ${metricsTomorrow1.tempMin}°C, Rain: ${metricsTomorrow1.precipProb}% (${metricsTomorrow1.precipSum} mm, ${metricsTomorrow1.conditionLabel})`)
  }
  if (risk1) lines.push(`Risk Level: ${risk1.level} (${risk1.title})`)
  if (advisories1?.travel) lines.push(`Travel Advisory: ${advisories1.travel}`)

  // Location 2
  lines.push(`\n--- LOCATION 2: ${name2} ---`)
  if (snapshot2) {
    const c2 = getWeatherCondition(snapshot2.weatherCode)
    lines.push(`Current: ${snapshot2.temperature != null ? snapshot2.temperature + '°C' : 'N/A'}, ${c2.label} | Humidity: ${snapshot2.humidity || 'N/A'}% | Wind: ${snapshot2.windSpeed || 'N/A'} km/h`)
  }
  if (metricsToday2) {
    lines.push(`Today Forecast: High ${metricsToday2.tempMax}°C, Low ${metricsToday2.tempMin}°C, Rain: ${metricsToday2.precipProb}% (${metricsToday2.precipSum} mm, ${metricsToday2.conditionLabel})`)
  }
  if (metricsTomorrow2) {
    lines.push(`Tomorrow Forecast: High ${metricsTomorrow2.tempMax}°C, Low ${metricsTomorrow2.tempMin}°C, Rain: ${metricsTomorrow2.precipProb}% (${metricsTomorrow2.precipSum} mm, ${metricsTomorrow2.conditionLabel})`)
  }
  if (risk2) lines.push(`Risk Level: ${risk2.level} (${risk2.title})`)
  if (advisories2?.travel) lines.push(`Travel Advisory: ${advisories2.travel}`)

  // Quick Analytical Diff
  lines.push('\n--- COMPARATIVE SUMMARY METRICS ---')
  if (snapshot1?.temperature != null && snapshot2?.temperature != null) {
    const diff = (snapshot1.temperature - snapshot2.temperature).toFixed(1)
    lines.push(`Current Temperature Difference: ${name1} is ${diff >= 0 ? '+' : ''}${diff}°C relative to ${name2}`)
  }
  if (metricsTomorrow1 && metricsTomorrow2) {
    lines.push(`Tomorrow Rain Probability: ${name1} (${metricsTomorrow1.precipProb}%) vs ${name2} (${metricsTomorrow2.precipProb}%)`)
    lines.push(`Tomorrow High Temperatures: ${name1} (${metricsTomorrow1.tempMax}°C) vs ${name2} (${metricsTomorrow2.tempMax}°C)`)
  }

  lines.push('\n=== END COMPARATIVE WEATHER CONTEXT ===')
  lines.push('INSTRUCTION FOR FACTS: Provide an objective, insightful side-by-side comparison comparing temperatures, rain likelihood, and travel comfort between both places using ONLY the supplied data.')

  return lines.join('\n')
}

// ----------------------------------------------------
// 7. DETERMINISTIC FALLBACK RESPONSE GENERATOR
// ----------------------------------------------------
function generateDeterministicFallback({
  query,
  locationName,
  metrics,
  snapshot,
  risk,
  advisories,
  weatherData,
  alerts,
  historicalAnalysis,
}) {
  const q = (query || '').toLowerCase()
  const loc = locationName || 'your location'

  // Model inquiry
  if (/model|ecmwf|nwp|source/i.test(q)) {
    return `WeatherGPT uses the ECMWF IFS (Integrated Forecasting System) global numerical weather prediction model provided via Open-Meteo. ECMWF IFS runs physics-based simulations on supercomputers to deliver reliable global forecasts.`
  }

  // Historical / climate inquiry
  if (historicalAnalysis) {
    if (/rain|rainfall|precip|monsoon/i.test(q)) {
      return `According to ECMWF ERA5 Reanalysis data for ${loc} over ${historicalAnalysis.period}:\n\n- **Annual Rainfall Trend**: ${historicalAnalysis.precipTrend} (rate of ${historicalAnalysis.precipSlope})\n- **Average Annual Precipitation**: ${historicalAnalysis.averageAnnualPrecipitation}\n- **Wettest Year**: ${historicalAnalysis.wettestYear}\n- **Driest Year**: ${historicalAnalysis.driestYear}\n- **Recent Annual Rainfall**: ${historicalAnalysis.recentPrecip}\n\nOver the same period, mean temperature has exhibited an ${historicalAnalysis.trend.toLowerCase()} trend (${historicalAnalysis.slope}) with a historical average of ${historicalAnalysis.historicalAverage}.`
    }
    return `According to ECMWF ERA5 Reanalysis data for ${loc} over ${historicalAnalysis.period}, the annual mean temperature exhibits an ${historicalAnalysis.trend.toLowerCase()} trend with a rate of ${historicalAnalysis.slope}. The historical average temperature is ${historicalAnalysis.historicalAverage}, with recent observations around ${historicalAnalysis.recentAverage}. In terms of precipitation, the annual average is ${historicalAnalysis.averageAnnualPrecipitation} (${historicalAnalysis.precipTrend} at ${historicalAnalysis.precipSlope}), with the wettest year being ${historicalAnalysis.wettestYear} and driest being ${historicalAnalysis.driestYear}.`
  }

  // Multi-intent: Rain + Travel + Model
  if (
    /rain/i.test(q) &&
    (/travel/i.test(q) || /trip/i.test(q)) &&
    /model/i.test(q)
  ) {
    return `Tomorrow in ${loc}, rain probability is ${metrics.precipProb}% with expected rainfall of ${metrics.precipSum} mm (${metrics.conditionLabel}).\n\nTravel Advisory: ${advisories?.travel || 'Proceed with normal caution.'}\n\nForecast Model: This forecast is generated using the ECMWF IFS numerical weather prediction model via Open-Meteo.`
  }

  // Multi-intent: Rain + Travel
  if (/rain/i.test(q) && (/travel/i.test(q) || /trip/i.test(q))) {
    return `Tomorrow in ${loc}, rain probability is ${metrics.precipProb}% with an estimated ${metrics.precipSum} mm of rain (${metrics.conditionLabel}).\n\nTravel Advisory: ${advisories?.travel || 'Carry an umbrella and check local transit before leaving.'}`
  }

  // Umbrella
  if (/umbrella|raincoat/i.test(q)) {
    if (metrics.precipProb >= 40 || metrics.precipSum >= 1) {
      return `Yes, carrying an umbrella is recommended for ${loc} tomorrow. Rain probability is ${metrics.precipProb}% with expected precipitation of ${metrics.precipSum} mm.`
    }
    return `An umbrella is likely unnecessary in ${loc} tomorrow. Rain probability is only ${metrics.precipProb}% with dry conditions expected.`
  }

  // Travel specific
  if (/travel|trip|drive|commute/i.test(q)) {
    return `Travel assessment for ${loc} (${metrics.period}): ${advisories?.travel || 'Conditions appear settled.'} The risk level is ${risk.level}.`
  }

  // Rain specific
  if (/rain|precip|shower/i.test(q)) {
    return `In ${loc} for ${metrics.period}, rain probability is ${metrics.precipProb}% with an estimated ${metrics.precipSum} mm of rainfall. Conditions point to ${metrics.conditionLabel}.`
  }

  // Temperature specific
  if (/temp|hot|cold|degrees/i.test(q)) {
    return `In ${loc}, current temperature is ${snapshot?.temperature != null ? snapshot.temperature + '°C' : 'around ' + metrics.tempMax + '°C'}. The forecasted high is ${metrics.tempMax}°C and the overnight low is ${metrics.tempMin}°C.`
  }

  // Humidity
  if (/humid|moisture/i.test(q)) {
    return `Current relative humidity in ${loc} is ${snapshot?.humidity != null ? snapshot.humidity + '%' : 'around ' + metrics.humidity + '%'}.`
  }

  // Wind
  if (/wind|breeze|gust/i.test(q)) {
    return `Current wind speed in ${loc} is ${snapshot?.windSpeed != null ? snapshot.windSpeed + ' km/h' : 'around ' + metrics.windSpeed + ' km/h'}.`
  }

  // Alerts
  if (/alert|warning|danger|severe/i.test(q)) {
    if (alerts && alerts.length > 0) {
      const altStr = alerts
        .map((a) => `${a.type} (${a.severity}) for ${a.period}: ${a.recommendation}`)
        .join('\n')
      return `Current WeatherGPT Forecast Alerts for ${loc}:\n${altStr}`
    }
    return `There are currently no active high or extreme WeatherGPT forecast alerts for ${loc}. Conditions remain within standard seasonal ranges.`
  }

  // General summary
  return `${loc} is currently experiencing ${snapshot ? getWeatherCondition(snapshot.weatherCode).label : metrics.conditionLabel} with a temperature of ${snapshot?.temperature != null ? snapshot.temperature + '°C' : metrics.tempMax + '°C'}. Tomorrow's high is expected to reach ${metrics.tempMax}°C with a low of ${metrics.tempMin}°C and a rain probability of ${metrics.precipProb}%.`
}

// ----------------------------------------------------
// 8. DETERMINISTIC COMPARISON FALLBACK GENERATOR
// ----------------------------------------------------
function generateDeterministicComparisonFallback({
  loc1,
  loc2,
  snapshot1,
  snapshot2,
  metricsToday1,
  metricsToday2,
  metricsTomorrow1,
  metricsTomorrow2,
  risk1,
  risk2,
  advisories1,
  advisories2,
}) {
  const name1 = loc1?.name || 'Location 1'
  const name2 = loc2?.name || 'Location 2'

  const tempDiff = (snapshot1?.temperature != null && snapshot2?.temperature != null)
    ? Math.abs(snapshot1.temperature - snapshot2.temperature).toFixed(1)
    : null
  const warmer = (snapshot1?.temperature > snapshot2?.temperature) ? name1 : name2
  const cooler = warmer === name1 ? name2 : name1

  const cond1 = snapshot1 ? getWeatherCondition(snapshot1.weatherCode).label : metricsTomorrow1?.conditionLabel
  const cond2 = snapshot2 ? getWeatherCondition(snapshot2.weatherCode).label : metricsTomorrow2?.conditionLabel

  return `### Weather Comparison: ${name1} vs ${name2}

**Current Conditions:**
- **${name1}**: ${snapshot1?.temperature != null ? snapshot1.temperature + '°C' : 'N/A'}, ${cond1} (Humidity: ${snapshot1?.humidity || 'N/A'}%, Wind: ${snapshot1?.windSpeed || 'N/A'} km/h)
- **${name2}**: ${snapshot2?.temperature != null ? snapshot2.temperature + '°C' : 'N/A'}, ${cond2} (Humidity: ${snapshot2?.humidity || 'N/A'}%, Wind: ${snapshot2?.windSpeed || 'N/A'} km/h)
${tempDiff ? `\n*${warmer} is currently warmer than ${cooler} by ${tempDiff}°C.*` : ''}

**Tomorrow's Forecast:**
- **${name1}**: High ${metricsTomorrow1?.tempMax}°C / Low ${metricsTomorrow1?.tempMin}°C, Rain chance: ${metricsTomorrow1?.precipProb}% (${metricsTomorrow1?.precipSum} mm, ${metricsTomorrow1?.conditionLabel})
- **${name2}**: High ${metricsTomorrow2?.tempMax}°C / Low ${metricsTomorrow2?.tempMin}°C, Rain chance: ${metricsTomorrow2?.precipProb}% (${metricsTomorrow2?.precipSum} mm, ${metricsTomorrow2?.conditionLabel})

**Travel & Risk Outlook:**
- **${name1}**: Risk level is **${risk1?.level || 'LOW'}**. ${advisories1?.travel || 'Conditions appear settled.'}
- **${name2}**: Risk level is **${risk2?.level || 'LOW'}**. ${advisories2?.travel || 'Conditions appear settled.'}`
}

module.exports = {
  getWeatherCondition,
  isRainCategory,
  evaluateRisk,
  RISK_LEVELS,
  extractPeriodMetrics,
  generateAdvisories,
  evaluateAlerts,
  analyzeHistoricalTrends,
  buildStructuredWeatherContext,
  buildComparativeWeatherContext,
  generateDeterministicFallback,
  generateDeterministicComparisonFallback,
}
