// Prototype-only risk heuristic. These thresholds are illustrative and
// are NOT official IMD or government warning levels — they exist only
// to demonstrate the product's UX until a real ML risk model is connected.

export const RISK_LEVELS = {
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
  EXTREME: 'EXTREME',
}

export function evaluateRisk(snapshot) {
  if (!snapshot) {
    return {
      level: RISK_LEVELS.LOW,
      title: 'No data yet',
      description: 'Weather data has not loaded for this location.',
      recommendation: 'Try refreshing once the connection is restored.',
    }
  }

  const { weatherCode, precipitationProbability = 0, windSpeed = 0, rain = 0 } = snapshot
  const isStorm = weatherCode === 95 || weatherCode === 96 || weatherCode === 99
  const isHeavyRainCode = weatherCode === 65 || weatherCode === 82

  if (isStorm || (rain >= 10 && precipitationProbability >= 70)) {
    return {
      level: RISK_LEVELS.EXTREME,
      title: 'Thunderstorm risk in the area',
      description:
        'Conditions point to thunderstorm activity with a high chance of heavy rain. Lightning and gusty winds are possible.',
      recommendation: 'Avoid open areas and non-essential travel until conditions ease.',
    }
  }

  if (isHeavyRainCode || (precipitationProbability >= 70 && rain >= 4) || windSpeed >= 40) {
    return {
      level: RISK_LEVELS.HIGH,
      title: 'Heavy rain or strong wind likely',
      description:
        'Precipitation intensity or wind speed is elevated enough to disrupt travel and outdoor plans.',
      recommendation: 'Keep an umbrella handy and check conditions again before heading out.',
    }
  }

  if (precipitationProbability >= 40 || windSpeed >= 25) {
    return {
      level: RISK_LEVELS.MODERATE,
      title: 'Some rain or breezy conditions expected',
      description: 'There is a reasonable chance of rain or noticeably breezy weather during the day.',
      recommendation: 'Outdoor plans are fine, but keep a backup indoor option in mind.',
    }
  }

  return {
    level: RISK_LEVELS.LOW,
    title: 'Conditions look settled',
    description: 'No significant rain, wind, or storm signals in the current data.',
    recommendation: 'A good window for outdoor activity or travel.',
  }
}
