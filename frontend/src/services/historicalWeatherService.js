// WeatherGPT Historical Weather & Climate Analysis Service
//
// Fetches genuine historical climate observations from Open-Meteo Historical Archive
// (ECMWF ERA5 & ERA5-Land Reanalysis dataset).
// Does NOT use mock or hardcoded weather data.
// Includes caching to eliminate redundant network calls.

const ARCHIVE_BASE_URL = 'https://archive-api.open-meteo.com/v1/archive'

const DAILY_VARS = [
  'temperature_2m_mean',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'wind_speed_10m_max',
  'relative_humidity_2m_mean',
].join(',')

// In-memory request cache
const historicalCache = new Map()

/**
 * Fetch daily historical weather observations for a coordinate pair between startDate and endDate (YYYY-MM-DD).
 */
export async function fetchHistoricalWeather(latitude, longitude, startDate, endDate) {
  const cacheKey = `${Number(latitude).toFixed(3)}_${Number(longitude).toFixed(3)}_${startDate}_${endDate}`
  if (historicalCache.has(cacheKey)) {
    return historicalCache.get(cacheKey)
  }

  const url = `${ARCHIVE_BASE_URL}?latitude=${latitude}&longitude=${longitude}&start_date=${startDate}&end_date=${endDate}&daily=${DAILY_VARS}&timezone=auto`

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
 * Aggregates daily observations into yearly climate indicators.
 */
export function aggregateYearlyData(dailyData) {
  if (!dailyData?.time?.length) return []

  const yearlyMap = new Map()

  dailyData.time.forEach((dateStr, idx) => {
    const year = dateStr.slice(0, 4)
    if (!yearlyMap.has(year)) {
      yearlyMap.set(year, {
        year: Number(year),
        tempSum: 0,
        tempCount: 0,
        tempMaxSum: 0,
        tempMinSum: 0,
        highestTemp: -Infinity,
        lowestTemp: Infinity,
        precipSum: 0,
        windSum: 0,
        humiditySum: 0,
        validDays: 0,
      })
    }

    const yData = yearlyMap.get(year)
    const tMean = dailyData.temperature_2m_mean?.[idx]
    const tMax = dailyData.temperature_2m_max?.[idx]
    const tMin = dailyData.temperature_2m_min?.[idx]
    const precip = dailyData.precipitation_sum?.[idx]
    const wind = dailyData.wind_speed_10m_max?.[idx]
    const hum = dailyData.relative_humidity_2m_mean?.[idx]

    if (tMean != null) {
      yData.tempSum += tMean
      yData.tempCount++
    }
    if (tMax != null) {
      yData.tempMaxSum += tMax
      if (tMax > yData.highestTemp) yData.highestTemp = tMax
    }
    if (tMin != null) {
      yData.tempMinSum += tMin
      if (tMin < yData.lowestTemp) yData.lowestTemp = tMin
    }
    if (precip != null) yData.precipSum += precip
    if (wind != null) yData.windSum += wind
    if (hum != null) yData.humiditySum += hum

    yData.validDays++
  })

  const sortedYears = Array.from(yearlyMap.values())
    .filter((y) => y.tempCount > 50) // ensure representative year
    .map((y) => ({
      year: y.year,
      avgTemp: Number((y.tempSum / y.tempCount).toFixed(2)),
      avgMaxTemp: Number((y.tempMaxSum / y.tempCount).toFixed(2)),
      avgMinTemp: Number((y.tempMinSum / y.tempCount).toFixed(2)),
      highestTemp: Number(y.highestTemp.toFixed(1)),
      lowestTemp: Number(y.lowestTemp.toFixed(1)),
      totalRainfall: Number(y.precipSum.toFixed(1)),
      avgWindSpeed: Number((y.windSum / y.validDays).toFixed(1)),
      avgHumidity: Math.round(y.humiditySum / y.validDays),
    }))
    .sort((a, b) => a.year - b.year)

  return sortedYears
}

/**
 * Aggregates daily observations into monthly climatological averages (Jan to Dec).
 */
export function aggregateMonthlyData(dailyData) {
  if (!dailyData?.time?.length) return []

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ]

  const monthsMap = new Map()
  for (let m = 0; m < 12; m++) {
    monthsMap.set(m, {
      monthIndex: m,
      month: monthNames[m],
      tempSum: 0,
      tempCount: 0,
      precipSum: 0,
      precipCount: 0,
      humiditySum: 0,
      humidityCount: 0,
      windSum: 0,
      windCount: 0,
    })
  }

  dailyData.time.forEach((dateStr, idx) => {
    const month = Number(dateStr.slice(5, 7)) - 1
    const mData = monthsMap.get(month)
    if (!mData) return

    const tMean = dailyData.temperature_2m_mean?.[idx]
    const precip = dailyData.precipitation_sum?.[idx]
    const hum = dailyData.relative_humidity_2m_mean?.[idx]
    const wind = dailyData.wind_speed_10m_max?.[idx]

    if (tMean != null) {
      mData.tempSum += tMean
      mData.tempCount++
    }
    if (precip != null) {
      mData.precipSum += precip
      mData.precipCount++
    }
    if (hum != null) {
      mData.humiditySum += hum
      mData.humidityCount++
    }
    if (wind != null) {
      mData.windSum += wind
      mData.windCount++
    }
  })

  // Normalize by number of distinct years in dataset
  const yearsSpan = new Set(dailyData.time.map((d) => d.slice(0, 4))).size || 1

  return Array.from(monthsMap.values()).map((m) => ({
    month: m.month,
    monthIndex: m.monthIndex,
    avgTemp: m.tempCount ? Number((m.tempSum / m.tempCount).toFixed(1)) : 0,
    avgRainfall: Number((m.precipSum / yearsSpan).toFixed(1)),
    avgHumidity: m.humidityCount ? Math.round(m.humiditySum / m.humidityCount) : 0,
    avgWindSpeed: m.windCount ? Number((m.windSum / m.windCount).toFixed(1)) : 0,
  }))
}

/**
 * Calculates a least-squares linear regression trend over an array of yearly data points.
 */
export function calculateLinearTrend(dataPoints, metricKey = 'avgTemp') {
  if (!dataPoints || dataPoints.length < 2) {
    return {
      slope: 0,
      direction: 'Stable',
      directionIcon: '→',
      periodChange: 0,
      historicalAvg: 0,
      recentAvg: 0,
      firstYear: null,
      lastYear: null,
      fittedLine: [],
    }
  }

  const n = dataPoints.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0

  const x0 = dataPoints[0].year

  dataPoints.forEach((point) => {
    const x = point.year - x0
    const y = point[metricKey] ?? 0
    sumX += x
    sumY += y
    sumXY += x * y
    sumX2 += x * x
  })

  const denominator = n * sumX2 - sumX * sumX
  const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0
  const intercept = (sumY - slope * sumX) / n

  // Trend direction classification threshold
  let direction = 'Stable'
  let directionIcon = '→'
  const absSlope = Math.abs(slope)

  if (metricKey.toLowerCase().includes('rain')) {
    if (slope > 5) {
      direction = 'Increasing'
      directionIcon = '↑'
    } else if (slope < -5) {
      direction = 'Decreasing'
      directionIcon = '↓'
    }
  } else {
    // Temperature or percentage metrics
    if (slope > 0.015) {
      direction = 'Increasing'
      directionIcon = '↑'
    } else if (slope < -0.015) {
      direction = 'Decreasing'
      directionIcon = '↓'
    }
  }

  const totalChange = Number((slope * (dataPoints[n - 1].year - x0)).toFixed(2))

  // Historical average (all years) vs Recent average (last 3 years)
  const allY = dataPoints.map((p) => p[metricKey] ?? 0)
  const historicalAvg = Number((allY.reduce((a, b) => a + b, 0) / n).toFixed(2))

  const recentCount = Math.min(3, Math.max(1, Math.floor(n / 2)))
  const recentSlice = allY.slice(-recentCount)
  const recentAvg = Number((recentSlice.reduce((a, b) => a + b, 0) / recentCount).toFixed(2))

  // Fitted regression line points
  const fittedLine = dataPoints.map((p) => {
    const x = p.year - x0
    return {
      year: p.year,
      actual: p[metricKey],
      trend: Number((slope * x + intercept).toFixed(2)),
    }
  })

  return {
    slope: Number(slope.toFixed(3)),
    direction,
    directionIcon,
    periodChange: totalChange,
    historicalAvg,
    recentAvg,
    difference: Number((recentAvg - historicalAvg).toFixed(2)),
    firstYear: dataPoints[0].year,
    lastYear: dataPoints[n - 1].year,
    fittedLine,
  }
}

/**
 * Formulates a cautious, data-grounded natural-language climate insight.
 */
export function generateClimateNarrative(yearlyData, trend, metricKey, locationName) {
  if (!yearlyData?.length || !trend) {
    return 'Insufficient historical records to determine long-term climate trajectory.'
  }

  const { firstYear, lastYear, direction, slope, historicalAvg, recentAvg, difference } = trend
  const metricLabel =
    metricKey === 'avgTemp'
      ? 'annual average temperature'
      : metricKey === 'avgMaxTemp'
      ? 'daytime peak temperature'
      : metricKey === 'totalRainfall'
      ? 'annual rainfall'
      : metricKey === 'avgHumidity'
      ? 'relative humidity'
      : 'wind speed'

  const unit =
    metricKey === 'totalRainfall'
      ? 'mm'
      : metricKey === 'avgHumidity'
      ? '%'
      : metricKey === 'avgWindSpeed'
      ? 'km/h'
      : '°C'

  let narrative = ''

  if (metricKey.includes('Temp')) {
    if (direction === 'Increasing') {
      narrative = `Over the ${firstYear}–${lastYear} period, ${locationName}'s ${metricLabel} shows a gradual upward trend (+${slope}${unit}/year). The recent average (${recentAvg}${unit}) is approximately ${Math.abs(difference)}${unit} higher than the ${firstYear}–${lastYear} historical baseline (${historicalAvg}${unit}).`
    } else if (direction === 'Decreasing') {
      narrative = `Over the ${firstYear}–${lastYear} period, ${locationName}'s ${metricLabel} exhibits a mild downward trend (${slope}${unit}/year). Recent years averaged ${recentAvg}${unit}, compared to the overall baseline of ${historicalAvg}${unit}.`
    } else {
      narrative = `Between ${firstYear} and ${lastYear}, ${locationName}'s ${metricLabel} has remained relatively steady around an average of ${historicalAvg}${unit}, with minor year-to-year natural variance.`
    }
  } else if (metricKey === 'totalRainfall') {
    if (direction === 'Increasing') {
      narrative = `Annual precipitation in ${locationName} shows an upward tendency over ${firstYear}–${lastYear} (+${slope.toFixed(1)} mm/year), with recent years averaging ${recentAvg} mm compared to the historical baseline of ${historicalAvg} mm.`
    } else if (direction === 'Decreasing') {
      narrative = `Annual rainfall has experienced a declining trend in ${locationName} between ${firstYear} and ${lastYear} (${slope.toFixed(1)} mm/year). The recent period averaged ${recentAvg} mm, down from the ${firstYear}–${lastYear} mean of ${historicalAvg} mm.`
    } else {
      narrative = `Rainfall in ${locationName} has varied noticeably between years with no consistent upward or downward direction, centering on an annual average of ${historicalAvg} mm.`
    }
  } else {
    narrative = `Historical analysis indicates that ${locationName}'s ${metricLabel} has followed a ${direction.toLowerCase()} pattern over the ${firstYear}–${lastYear} timeframe (recent average: ${recentAvg}${unit}, historical baseline: ${historicalAvg}${unit}).`
  }

  return narrative
}
