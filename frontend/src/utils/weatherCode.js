// Maps Open-Meteo WMO weather codes to human-readable conditions and
// a category used to pick an icon / color treatment.
// Reference: https://open-meteo.com/en/docs (WMO Weather interpretation codes)

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

export function getWeatherCondition(code) {
  return CODE_MAP[code] ?? { label: 'Unknown', category: 'cloudy' }
}

export function isRainCategory(category) {
  return category === 'rain' || category === 'drizzle' || category === 'storm'
}
