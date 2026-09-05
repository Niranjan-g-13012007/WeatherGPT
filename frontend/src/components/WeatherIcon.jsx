import { Sun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning } from 'lucide-react'
import { getWeatherCondition } from '../utils/weatherCode.js'

const ICONS = {
  clear: Sun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
}

export default function WeatherIcon({ code, size = 24, strokeWidth = 1.8, className = '' }) {
  const { category } = getWeatherCondition(code)
  const Icon = ICONS[category] ?? Cloud
  return <Icon size={size} strokeWidth={strokeWidth} className={className} />
}
